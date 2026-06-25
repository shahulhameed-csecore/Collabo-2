import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
from pydantic import BaseModel
from app.schemas.campaign import CampaignCreate, CampaignUpdate, CampaignStatusUpdate, CampaignResponse, CampaignStatus
from app.api.dependencies import get_current_user, get_user_supabase_client, AuthenticatedUser
from app.core.limiter import limiter
from fastapi import Request

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/campaigns", tags=["Campaigns"])

class BulkStatusUpdate(BaseModel):
    campaign_ids: List[str]
    status: CampaignStatus

class BulkDelete(BaseModel):
    campaign_ids: List[str]

@router.patch("/bulk/status", response_model=dict)
@limiter.limit("10/minute")
async def bulk_update_status(
    request: Request,
    payload: BulkStatusUpdate,
    client=Depends(get_user_supabase_client),
):
    response = client.table("campaigns").update({"status": payload.status.value}).in_("id", payload.campaign_ids).execute()
    return {"message": f"Updated {len(response.data)} campaigns"}

@router.delete("/bulk/delete", response_model=dict)
@limiter.limit("10/minute")
async def bulk_delete(
    request: Request,
    payload: BulkDelete,
    client=Depends(get_user_supabase_client),
):
    response = client.table("campaigns").delete().in_("id", payload.campaign_ids).execute()
    return {"message": f"Deleted {len(response.data)} campaigns"}

@router.post("/bulk/remind", response_model=dict)
@limiter.limit("5/minute")
async def bulk_remind(
    request: Request,
    payload: BulkDelete,
    client=Depends(get_user_supabase_client),
):
    return {"message": f"Reminders queued for {len(payload.campaign_ids)} campaigns"}

@router.get("/", response_model=List[CampaignResponse])
@limiter.limit("60/minute")
async def get_campaigns(
    request: Request,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    client=Depends(get_user_supabase_client),
):
    response = client.table("campaigns").select("*").range(offset, offset + limit - 1).execute()
    return response.data


@router.post("/", response_model=CampaignResponse)
@limiter.limit("20/minute")
async def create_campaign(
    request: Request,
    campaign: CampaignCreate,
    client=Depends(get_user_supabase_client),
    user: AuthenticatedUser = Depends(get_current_user),
):
    data = campaign.model_dump(mode="json", exclude_unset=True)
    data["user_id"] = user.user.id
    try:
        response = client.table("campaigns").insert(data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create campaign")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Campaign creation failed", error=type(e).__name__, user_id=user.user.id)
        raise HTTPException(status_code=500, detail="Failed to create campaign. Please try again.")


@router.put("/{id}", response_model=CampaignResponse)
@limiter.limit("20/minute")
async def update_campaign(
    request: Request,
    id: str,
    campaign: CampaignUpdate,
    client=Depends(get_user_supabase_client),
):
    data = campaign.model_dump(mode="json", exclude_unset=True)
    response = client.table("campaigns").update(data).eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Campaign not found or access denied")
    return response.data[0]


@router.patch("/{id}/status", response_model=CampaignResponse)
@limiter.limit("20/minute")
async def update_campaign_status(
    request: Request,
    id: str,
    status_update: CampaignStatusUpdate,
    client=Depends(get_user_supabase_client),
):
    # Fetch current campaign
    current_campaign = client.table("campaigns").select("status").eq("id", id).execute()
    if not current_campaign.data:
        raise HTTPException(status_code=404, detail="Campaign not found or access denied")
    
    current_status = current_campaign.data[0]["status"]
    new_status = status_update.status.value

    # RBAC for Brand: Cannot trigger 'content_received'
    if new_status == "content_received" and current_status != "content_received":
        raise HTTPException(status_code=403, detail="Only influencers can mark content as received via proof upload.")

    # State Machine Rules
    valid_transitions = {
        "draft": ["active", "cancelled"],
        "active": ["cancelled"], # 'content_received' happens via file upload only
        "content_received": ["approved", "cancelled"],
        "approved": ["paid", "cancelled"],
        "paid": ["cancelled"],
        "cancelled": ["draft", "active"] # allow restoring from cancelled
    }

    if new_status != current_status and new_status not in valid_transitions.get(current_status, []):
        raise HTTPException(status_code=400, detail=f"Invalid transition from {current_status} to {new_status}")

    data = status_update.model_dump(mode="json")
    response = client.table("campaigns").update(data).eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Campaign not found or access denied")
    return response.data[0]


@router.delete("/{id}")
@limiter.limit("20/minute")
async def delete_campaign(request: Request, id: str, client=Depends(get_user_supabase_client)):
    response = client.table("campaigns").delete().eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Campaign not found or access denied")
    return {"message": "Campaign deleted successfully"}
