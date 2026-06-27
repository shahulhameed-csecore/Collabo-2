from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from app.api.dependencies import get_current_user, get_user_supabase_client, AuthenticatedUser

router = APIRouter(prefix="/billing", tags=["Billing"])

class BillingUsageResponse(BaseModel):
    current_plan: str
    trial_ends_at: Optional[datetime]
    campaigns_this_month: int
    ai_extractions_used: int

@router.get("/usage", response_model=BillingUsageResponse)
async def get_billing_usage(
    request: Request,
    client=Depends(get_user_supabase_client),
    user: AuthenticatedUser = Depends(get_current_user),
):
    # Get subscription details
    try:
        sub_response = client.table("subscriptions").select("*").eq("user_id", user.user.id).execute()
        sub_data = sub_response.data[0] if sub_response and hasattr(sub_response, 'data') and len(sub_response.data) > 0 else {}
    except Exception as e:
        import structlog
        structlog.get_logger(__name__).error("billing_subscription_fetch_failed", error=str(e))
        sub_data = {}
    
    current_plan = "pro" # HARDCODED FOR TESTING: sub_data.get("tier", "free")
    trial_ends_at = sub_data.get("trial_ends_at")
    ai_extractions_used = sub_data.get("ai_extractions_count", 0)
    
    # Calculate campaigns this month
    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    # Supabase select with count
    try:
        campaigns_response = client.table("campaigns").select("id", count="exact").eq("user_id", user.user.id).gte("created_at", start_of_month).execute()
        campaigns_this_month = campaigns_response.count if campaigns_response and hasattr(campaigns_response, 'count') and campaigns_response.count is not None else 0
    except Exception as e:
        import structlog
        structlog.get_logger(__name__).error("billing_campaigns_fetch_failed", error=str(e))
        campaigns_this_month = 0
    
    # Parse trial string to datetime
    if isinstance(trial_ends_at, str):
        try:
            trial_ends_at = datetime.fromisoformat(trial_ends_at.replace("Z", "+00:00"))
        except:
            trial_ends_at = None
            
    return BillingUsageResponse(
        current_plan=current_plan,
        trial_ends_at=trial_ends_at,
        campaigns_this_month=campaigns_this_month,
        ai_extractions_used=ai_extractions_used
    )
