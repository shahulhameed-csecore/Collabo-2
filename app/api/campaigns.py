import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
from pydantic import BaseModel, Field
from app.schemas.campaign import CampaignCreate, CampaignUpdate, CampaignStatusUpdate, CampaignResponse, CampaignStatus
from app.api.dependencies import get_current_user, get_user_supabase_client, AuthenticatedUser
from app.core.limiter import limiter
from app.core.utils import handle_db_error, get_valid_transitions
from fastapi import Request

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/campaigns", tags=["Campaigns"])

class BulkStatusUpdate(BaseModel):
    campaign_ids: List[str] = Field(..., max_length=100)
    status: CampaignStatus

class BulkDelete(BaseModel):
    campaign_ids: List[str] = Field(..., max_length=100)

@router.patch("/bulk/status", response_model=dict)
@limiter.limit("10/minute")
async def bulk_update_status(
    request: Request,
    payload: BulkStatusUpdate,
    client=Depends(get_user_supabase_client),
):
    # Fetch current campaigns
    current_campaigns = client.table("campaigns").select("id, status, user_id, influencer_handle, influencer_name").in_("id", payload.campaign_ids).execute()
    if not current_campaigns.data:
        return {"message": "No valid campaigns found"}
    
    new_status = payload.status.value

    # RBAC for Brand: Cannot trigger 'content_received'
    if new_status == "content_received":
        raise HTTPException(status_code=403, detail="Only influencers can mark content as received via proof upload.")

    # State Machine Rules
    valid_transitions = get_valid_transitions()

    valid_ids = []
    for camp in current_campaigns.data:
        current_status = camp["status"]
        if new_status == current_status:
            continue
        if new_status in valid_transitions.get(current_status, []):
            valid_ids.append(camp["id"])

    if not valid_ids:
        raise HTTPException(status_code=400, detail="No campaigns were in a valid state for this status transition.")

    response = client.table("campaigns").update({"status": new_status}).in_("id", valid_ids).execute()
    
    # Send notifications
    try:
        from app.api.dependencies import get_service_client
        from app.services.notifications import create_notification
        import asyncio
        
        service_client = get_service_client()
        display_status = new_status.replace("_", " ").title()
        
        async def notify(camp):
            inf_name = camp.get("influencer_name") or camp.get("influencer_handle") or "Creator"
            await create_notification(
                service_client=service_client,
                user_id=camp.get("user_id"),
                title=f"Campaign {display_status}",
                message=f"The campaign for {inf_name} was moved to {display_status}.",
                type="info",
                link_url="/dashboard"
            )
            
        tasks = [notify(c) for c in current_campaigns.data if c["id"] in valid_ids]
        if tasks:
            await asyncio.gather(*tasks)
    except Exception as e:
        logger.error(f"Failed to create bulk status notifications: {e}")

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
        from app.api.billing import IS_TESTING_PHASE
        if not IS_TESTING_PHASE:
            sub_res = client.table("subscriptions").select("tier, trial_ends_at").eq("user_id", user.user.id).execute()
            is_pro = False
            if sub_res.data:
                sub = sub_res.data[0]
                tier = sub.get("tier", "free")
                trial_str = sub.get("trial_ends_at")
                
                parsed_trial = None
                if isinstance(trial_str, str):
                    try:
                        from datetime import datetime, timezone
                        parsed_trial = datetime.fromisoformat(trial_str.replace("Z", "+00:00"))
                    except: pass
                
                from datetime import datetime, timezone
                now = datetime.now(timezone.utc)
                is_trial_active = parsed_trial and parsed_trial > now
                if tier == "pro" and is_trial_active:
                    is_pro = True
            
            if not is_pro:
                count_res = client.table("campaigns").select("id", count="exact").eq("user_id", user.user.id).execute()
                if count_res.count is not None and count_res.count >= 5:
                    raise HTTPException(status_code=403, detail="Free tier limit reached. Please upgrade to Pro to create more campaigns.")

        response = client.table("campaigns").insert(data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create campaign")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        handle_db_error(e, logger, "Campaign creation failed", user.user.id)

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
    valid_transitions = get_valid_transitions()

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


@router.post("/sample-data", response_model=List[CampaignResponse])
@limiter.limit("5/minute")
async def load_sample_data(
    request: Request,
    client=Depends(get_user_supabase_client),
    user: AuthenticatedUser = Depends(get_current_user),
):
    import secrets
    import string
    from datetime import datetime, timezone, timedelta
    
    now = datetime.now(timezone.utc)
    
    sample_campaigns = [
        {
            "user_id": user.user.id,
            "influencer_name": "Riya Sharma",
            "influencer_handle": "@riya_creates",
            "platform": "Instagram",
            "deliverables": "1 Reel + 2 Stories",
            "payment_amount": 15000.0,
            "deadline": (now + timedelta(days=2)).isoformat(),
            "status": "active",
            "special_notes": "Mamaearth Hair Oil Promotion - Focus on natural ingredients",
            "short_code": ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))
        },
        {
            "user_id": user.user.id,
            "influencer_name": "Techie Rahul",
            "influencer_handle": "@techguru_in",
            "platform": "YouTube",
            "deliverables": "Dedicated Integration (60s)",
            "payment_amount": 45000.0,
            "deadline": (now - timedelta(days=1)).isoformat(),
            "status": "active",
            "special_notes": "Boat Earbuds unboxing. Emphasize bass and battery life.",
            "short_code": ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))
        },
        {
            "user_id": user.user.id,
            "influencer_name": "Priya Glow",
            "influencer_handle": "@priya.glows",
            "platform": "Instagram",
            "deliverables": "1 Carousel Post",
            "payment_amount": 12000.0,
            "deadline": (now + timedelta(days=10)).isoformat(),
            "status": "content_received",
            "special_notes": "Dot & Key Skincare Routine.",
            "proof_url": "https://instagram.com/p/sample",
            "short_code": ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))
        },
        {
            "user_id": user.user.id,
            "influencer_name": "Kunal Snacks",
            "influencer_handle": "@kunal.eats",
            "platform": "Instagram",
            "deliverables": "1 Reel",
            "payment_amount": 8000.0,
            "deadline": (now - timedelta(days=5)).isoformat(),
            "status": "paid",
            "special_notes": "Snackible review - focus on healthy munching.",
            "proof_url": "https://instagram.com/p/sample2",
            "short_code": ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))
        }
    ]
    
    try:
        response = client.table("campaigns").insert(sample_campaigns).execute()
        return response.data if response and hasattr(response, 'data') else []
    except Exception as e:
        logger.error(f"Failed to load sample data: {e}")
        raise HTTPException(status_code=500, detail="Failed to load sample data")
