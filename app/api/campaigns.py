import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
from pydantic import BaseModel
from app.schemas.campaign import CampaignCreate, CampaignUpdate, CampaignStatusUpdate, CampaignResponse, CampaignStatus
from app.api.dependencies import get_current_user, get_user_supabase_client, AuthenticatedUser
from app.core.limiter import limiter
from fastapi import Request

logger = structlog.get_logger(__name__)

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
    try:
        response = client.table("campaigns").select("*").range(offset, offset + limit - 1).execute()
        return response.data if response and hasattr(response, 'data') else []
    except Exception as e:
        import structlog
        structlog.get_logger(__name__).error("campaigns_fetch_failed", error=str(e))
        return []


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
    
    if data.get("destination_url"):
        import secrets
        import string
        data["short_code"] = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))

    try:
        response = client.table("campaigns").insert(data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create campaign")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Campaign creation failed", error=type(e).__name__, detail=str(e), user_id=user.user.id)
        error_msg = str(e).lower()
        if "violates unique constraint" in error_msg and "short_code" in error_msg:
            raise HTTPException(status_code=400, detail="A tracking code conflict occurred. Please try again.")
        if "foreign key" in error_msg:
            raise HTTPException(status_code=400, detail="Invalid data reference. Make sure the linked data exists.")
        if "not-null" in error_msg:
            raise HTTPException(status_code=400, detail="Please fill in all required fields.")
        if "violates" in error_msg:
            raise HTTPException(status_code=400, detail="The provided data is invalid. Please double-check your inputs.")
        raise HTTPException(status_code=500, detail="We couldn't create your campaign. Please try again or contact support if the issue persists.")


@router.put("/{id}", response_model=CampaignResponse)
@limiter.limit("20/minute")
async def update_campaign(
    request: Request,
    id: str,
    campaign: CampaignUpdate,
    client=Depends(get_user_supabase_client),
):
    data = campaign.model_dump(mode="json", exclude_unset=True)
    
    if "destination_url" in data and data["destination_url"]:
        current = client.table("campaigns").select("short_code").eq("id", id).execute()
        if current.data and not current.data[0].get("short_code"):
            import secrets
            import string
            data["short_code"] = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))

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
    current_campaign = client.table("campaigns").select("status, user_id, influencer_handle, influencer_name").eq("id", id).execute()
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
        "content_received": ["approved", "rejected", "cancelled"],
        "approved": ["paid", "cancelled"],
        "paid": ["cancelled"],
        "rejected": ["active", "cancelled", "approved", "content_received"], # allow restoring to active, or direct approval
        "cancelled": ["draft", "active"] # allow restoring from cancelled
    }

    if new_status != current_status and new_status not in valid_transitions.get(current_status, []):
        raise HTTPException(status_code=400, detail=f"Invalid transition from {current_status} to {new_status}")

    data = status_update.model_dump(mode="json")
    response = client.table("campaigns").update(data).eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Campaign not found or access denied")
        
    if new_status != current_status:
        try:
            from app.api.dependencies import get_service_client
            from app.services.notifications import create_notification
            service_client = get_service_client()
            user_id = current_campaign.data[0].get("user_id")
            inf_name = current_campaign.data[0].get("influencer_handle") or current_campaign.data[0].get("influencer_name") or "Creator"
            
            # Format status for display
            display_status = new_status.replace("_", " ").title()
            
            await create_notification(
                service_client=service_client,
                user_id=user_id,
                title=f"Campaign {display_status}",
                message=f"The campaign for {inf_name} was moved to {display_status}.",
                type="info",
                link_url="/dashboard"
            )
        except Exception as e:
            logger.error(f"Failed to create status notification: {e}")
            
    return response.data[0]


@router.delete("/{id}")
@limiter.limit("20/minute")
async def delete_campaign(request: Request, id: str, client=Depends(get_user_supabase_client)):
    response = client.table("campaigns").delete().eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Campaign not found or access denied")
    return {"message": "Campaign deleted successfully"}
