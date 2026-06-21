import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
from app.schemas.campaign import CampaignCreate, CampaignUpdate, CampaignStatusUpdate, CampaignResponse
from app.api.dependencies import get_current_user, get_user_supabase_client, AuthenticatedUser
from app.core.limiter import limiter
from fastapi import Request

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/campaigns", tags=["Campaigns"])


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
