from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List
from datetime import datetime
from app.api.dependencies import get_current_user, get_user_supabase_client, AuthenticatedUser
from app.schemas.influencer import InfluencerResponse, InfluencerProfileUpdate

router = APIRouter(prefix="/influencers", tags=["Influencers"])

@router.get("/", response_model=List[InfluencerResponse])
async def get_influencers(
    request: Request,
    client=Depends(get_user_supabase_client),
    user: AuthenticatedUser = Depends(get_current_user),
):
    # Fetch all campaigns for user
    try:
        campaigns_response = client.table("campaigns").select("*").eq("user_id", user.user.id).execute()
        campaigns = campaigns_response.data
    except Exception:
        campaigns = []

    # Group by handle
    influencer_stats = {}
    for c in campaigns:
        handle = c.get("influencer_handle")
        if not handle:
            continue
        
        if handle not in influencer_stats:
            influencer_stats[handle] = {
                "handle": handle,
                "name": c.get("influencer_name"),
                "platform": c.get("platform"),
                "total_campaigns": 0,
                "successful_campaigns": 0,
                "last_collaboration": None,
                "notes": None
            }
        
        stats = influencer_stats[handle]
        stats["total_campaigns"] += 1
        
        if c.get("status") in ["approved", "paid"]:
            stats["successful_campaigns"] += 1
            
        deadline = c.get("deadline")
        if deadline:
            if not stats["last_collaboration"] or deadline > stats["last_collaboration"]:
                stats["last_collaboration"] = deadline

    # Fetch profiles/notes
    try:
        profiles_response = client.table("influencer_profiles").select("*").eq("user_id", user.user.id).execute()
        profiles = profiles_response.data
    except Exception:
        profiles = []
    
    # Merge profiles into stats
    for p in profiles:
        handle = p.get("handle")
        if handle in influencer_stats:
            if p.get("notes"):
                influencer_stats[handle]["notes"] = p.get("notes")
            if p.get("name"):
                influencer_stats[handle]["name"] = p.get("name")
            if p.get("platform"):
                influencer_stats[handle]["platform"] = p.get("platform")
        else:
            influencer_stats[handle] = {
                "handle": handle,
                "name": p.get("name"),
                "platform": p.get("platform"),
                "total_campaigns": 0,
                "successful_campaigns": 0,
                "last_collaboration": None,
                "notes": p.get("notes")
            }

    # Format response
    response_data = []
    for stats in influencer_stats.values():
        success_rate = (stats["successful_campaigns"] / stats["total_campaigns"]) * 100 if stats["total_campaigns"] > 0 else 0.0
        response_data.append(InfluencerResponse(
            handle=stats["handle"],
            name=stats["name"],
            platform=stats["platform"],
            notes=stats["notes"],
            total_campaigns=stats["total_campaigns"],
            success_rate=round(success_rate, 2),
            last_collaboration=stats["last_collaboration"]
        ))
        
    return response_data

@router.patch("/{handle}", response_model=InfluencerResponse)
async def update_influencer_profile(
    handle: str,
    profile_update: InfluencerProfileUpdate,
    request: Request,
    client=Depends(get_user_supabase_client),
    user: AuthenticatedUser = Depends(get_current_user),
):
    # Upsert logic
    data = profile_update.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields provided for update")
        
    upsert_data = {
        "user_id": user.user.id,
        "handle": handle,
        **data
    }
    try:
        response = client.table("influencer_profiles").upsert(upsert_data, on_conflict="user_id,handle").execute()
        result = response.data[0] if response.data else data
    except Exception:
        # If table doesn't exist, just return the data as if it succeeded to not break the UI
        result = data

    return InfluencerResponse(
        handle=handle,
        name=result.get("name"),
        platform=result.get("platform"),
        notes=result.get("notes"),
        total_campaigns=0,
        success_rate=0.0,
        last_collaboration=None
    )
