from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from app.api.dependencies import get_current_user, get_user_supabase_client, AuthenticatedUser, get_service_client
from app.core.config import settings
import razorpay
from fastapi import HTTPException
from datetime import timedelta

# Toggle this to False when integrating real payments (Stripe/Razorpay)
# When True, all users get a 'pro' plan by default.
IS_TESTING_PHASE = False

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
    
    
    # Evaluate Trial Status
    raw_tier = sub_data.get("tier", "free")
    trial_ends_at = sub_data.get("trial_ends_at")
    
    # Parse trial string to datetime for evaluation
    parsed_trial_ends_at = None
    if isinstance(trial_ends_at, str):
        try:
            parsed_trial_ends_at = datetime.fromisoformat(trial_ends_at.replace("Z", "+00:00"))
        except:
            pass
            
    now = datetime.now(timezone.utc)
    
    # If they are marked as 'pro' but their trial has expired, and they haven't explicitly paid (we assume paid users won't have an expired trial date limiting their access without being updated to active paid status via webhook), downgrade to free.
    # In a real system, you'd check a 'subscription_status' field from Stripe. Here, we rely on trial_ends_at.
    if raw_tier == "pro" and parsed_trial_ends_at and parsed_trial_ends_at < now:
        current_plan = "free"
    else:
        current_plan = "pro" if IS_TESTING_PHASE else raw_tier

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

class CreateOrderRequest(BaseModel):
    is_annual: bool = False

class VerifyPaymentRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str

@router.post("/create-razorpay-order")
async def create_razorpay_order(
    req: CreateOrderRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=500, detail="Razorpay is not configured")
        
    client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    
    amount = 300 * 100  # Amount in paise (₹300 monthly)
    
    data = {
        "amount": amount,
        "currency": "INR",
        "receipt": f"rcpt_{str(user.user.id).replace('-', '')}",
        "notes": {
            "user_id": user.user.id,
            "type": "monthly_pro"
        }
    }
    
    try:
        order = client.order.create(data=data)
        return {"order_id": order["id"], "amount": amount, "currency": "INR"}
    except Exception as e:
        import structlog
        structlog.get_logger(__name__).error("razorpay_order_creation_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create order")

@router.post("/verify-payment")
async def verify_payment(
    req: VerifyPaymentRequest,
    db_client=Depends(get_user_supabase_client),
    user: AuthenticatedUser = Depends(get_current_user),
):
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=500, detail="Razorpay is not configured")
        
    client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    
    try:
        # Verify Signature
        client.utility.verify_payment_signature({
            'razorpay_payment_id': req.razorpay_payment_id,
            'razorpay_order_id': req.razorpay_order_id,
            'razorpay_signature': req.razorpay_signature
        })
        
        # Payment is valid. We need to fetch the order details to know if it's monthly or annual.
        # Actually, let's just fetch the order from razorpay.
        order = client.order.fetch(req.razorpay_order_id)
        is_annual = order.get("notes", {}).get("type") == "annual_pro"
        
        # Extend subscription
        days_to_add = 365 if is_annual else 30
        now = datetime.now(timezone.utc)
        
        # Get current subscription
        sub_response = db_client.table("subscriptions").select("*").eq("user_id", user.user.id).execute()
        
        service_client = get_service_client()
        if sub_response.data:
            current_sub = sub_response.data[0]
            current_trial = current_sub.get("trial_ends_at")
            if current_trial:
                try:
                    parsed_trial = datetime.fromisoformat(current_trial.replace("Z", "+00:00"))
                    # If still valid, extend from valid date, otherwise from now
                    if parsed_trial > now:
                        new_expiry = parsed_trial + timedelta(days=days_to_add)
                    else:
                        new_expiry = now + timedelta(days=days_to_add)
                except:
                    new_expiry = now + timedelta(days=days_to_add)
            else:
                new_expiry = now + timedelta(days=days_to_add)
                
            # Update DB (Using service client to bypass RLS)
            service_client.table("subscriptions").update({
                "tier": "pro",
                "trial_ends_at": new_expiry.isoformat(),
                "razorpay_customer_id": None, # or update if available
                "razorpay_subscription_id": None, 
            }).eq("user_id", user.user.id).execute()
        else:
            # If no subscription exists for some reason, create one
            service_client.table("subscriptions").insert({
                "user_id": user.user.id,
                "tier": "pro",
                "trial_ends_at": (now + timedelta(days=days_to_add)).isoformat()
            }).execute()
            
        return {"status": "success", "message": "Payment verified and tier updated to Pro."}

    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    except Exception as e:
        import structlog
        structlog.get_logger(__name__).error("razorpay_verification_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to verify payment")


@router.post("/razorpay-webhook")
async def razorpay_webhook(request: Request):
    if not settings.RAZORPAY_WEBHOOK_SECRET:
        import structlog
        structlog.get_logger(__name__).error("razorpay_webhook_secret_missing")
        raise HTTPException(status_code=500, detail="Webhook secret not configured")
        
    payload_body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature")
    
    if not signature:
        raise HTTPException(status_code=400, detail="Missing signature")
        
    client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    
    try:
        # Verify Webhook Signature
        client.utility.verify_webhook_signature(
            payload_body.decode('utf-8'),
            signature,
            settings.RAZORPAY_WEBHOOK_SECRET
        )
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
        
    import json
    payload = json.loads(payload_body)
    
    event = payload.get("event")
    if event == "order.paid":
        order = payload.get("payload", {}).get("order", {}).get("entity", {})
        notes = order.get("notes", {})
        user_id = notes.get("user_id")
        
        if user_id:
            try:
                from app.api.dependencies import get_service_client
                service_client = get_service_client()
                
                now = datetime.now(timezone.utc)
                sub_response = service_client.table("subscriptions").select("*").eq("user_id", user_id).execute()
                days_to_add = 30 # Monthly
                
                if sub_response.data:
                    current_sub = sub_response.data[0]
                    current_trial = current_sub.get("trial_ends_at")
                    if current_trial:
                        try:
                            parsed_trial = datetime.fromisoformat(current_trial.replace("Z", "+00:00"))
                            if parsed_trial > now:
                                new_expiry = parsed_trial + timedelta(days=days_to_add)
                            else:
                                new_expiry = now + timedelta(days=days_to_add)
                        except:
                            new_expiry = now + timedelta(days=days_to_add)
                    else:
                        new_expiry = now + timedelta(days=days_to_add)
                        
                    service_client.table("subscriptions").update({
                        "tier": "pro",
                        "trial_ends_at": new_expiry.isoformat()
                    }).eq("user_id", user_id).execute()
                else:
                    service_client.table("subscriptions").insert({
                        "user_id": user_id,
                        "tier": "pro",
                        "trial_ends_at": (now + timedelta(days=days_to_add)).isoformat()
                    }).execute()
            except Exception as e:
                import structlog
                structlog.get_logger(__name__).error("razorpay_webhook_db_update_failed", error=str(e))
                
    return {"status": "ok"}

