from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
from supabase import create_client, ClientOptions
from app.schemas.campaign import CampaignCreate, CampaignUpdate, CampaignStatusUpdate, CampaignResponse
from app.api.dependencies import get_current_user
from app.core.config import settings

router = APIRouter(prefix="/campaigns", tags=["Campaigns"])

def get_user_client(user=Depends(get_current_user)):
    client = create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_ANON_KEY,
        options=ClientOptions(headers={'Authorization': f'Bearer {user.jwt_token}'})
    )
    return client

@router.get("/", response_model=List[CampaignResponse])
async def get_campaigns(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    client = Depends(get_user_client)
):
    response = client.table("campaigns").select("*").range(offset, offset + limit - 1).execute()
    return response.data

@router.post("/", response_model=CampaignResponse)
async def create_campaign(campaign: CampaignCreate, client = Depends(get_user_client), user = Depends(get_current_user)):
    data = campaign.model_dump(exclude_unset=True)
    data["user_id"] = user.user.id
    try:
        response = client.table("campaigns").insert(data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create campaign")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{id}", response_model=CampaignResponse)
async def update_campaign(id: str, campaign: CampaignUpdate, client = Depends(get_user_client)):
    data = campaign.model_dump(exclude_unset=True)
    response = client.table("campaigns").update(data).eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Campaign not found or access denied")
    return response.data[0]

@router.patch("/{id}/status", response_model=CampaignResponse)
async def update_campaign_status(id: str, status_update: CampaignStatusUpdate, client = Depends(get_user_client)):
    data = status_update.model_dump()
    response = client.table("campaigns").update(data).eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Campaign not found or access denied")
    return response.data[0]

@router.delete("/{id}")
async def delete_campaign(id: str, client = Depends(get_user_client)):
    response = client.table("campaigns").delete().eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Campaign not found or access denied")
    return {"message": "Campaign deleted successfully"}
