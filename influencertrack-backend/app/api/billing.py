from fastapi import APIRouter, Depends, Request, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
from starlette.concurrency import run_in_threadpool
import razorpay
import structlog

from app.api.dependencies import get_current_user, get_user_supabase_client, AuthenticatedUser, get_service_client
from app.core.config import settings
from app.core.limiter import limiter

logger = structlog.get_logger(__name__)

# Toggle this to False when integrating real payments (Stripe/Razorpay)
# When True, all users get a 'pro' plan by default.

# SCALING NOTE: Razorpay Live Mode Migration
# You are currently using Razorpay in Test Mode, which is perfect and safe for your MVP.
# When you complete business verification and want to process real money:
# 
# 1. Update Render Environment Variables:
#    Change `RAZORPAY_KEY_ID` to your live key (starts with `rzp_live_`).
#    Change `RAZORPAY_KEY_SECRET` to your live secret.
# 
# 2. Update Webhooks in Razorpay Dashboard:
#    Go to Settings -> Webhooks in Razorpay Live mode.
#    Add your endpoint: `https://api.mycollabo.online/billing/razorpay-webhook`
#    Generate a new Webhook Secret and update `RAZORPAY_WEBHOOK_SECRET` in Render.
# 
# No actual code changes are required here. The backend automatically switches 
# based on the environment variables provided.

IS_TESTING_PHASE = False

router = APIRouter(prefix="/billing", tags=["Billing"])

class BillingUsageResponse(BaseModel):
    current_plan: str
    trial_ends_at: Optional[datetime]
    campaigns_this_month: int
    total_campaigns: int = 0
    ai_extractions_used: int
    is_trial: bool = True
    is_paid: bool = False

@router.get("/usage", response_model=BillingUsageResponse)
async def get_billing_usage(
    request: Request,
    client=Depends(get_user_supabase_client),
    user: AuthenticatedUser = Depends(get_current_user),
):
    from app.services.supabase import is_user_pro_or_paid
    is_pro, sub_data = await is_user_pro_or_paid(client, user.user.id)
    
    current_plan = "pro" if is_pro else "free"
    is_paid = bool(sub_data.get("is_paid", False))
    is_trial = not is_paid
    
    trial_ends_at = sub_data.get("trial_ends_at")
    parsed_trial_ends_at = None
    if trial_ends_at:
        if isinstance(trial_ends_at, str):
            try:
                parsed_trial_ends_at = datetime.fromisoformat(trial_ends_at.replace("Z", "+00:00"))
            except Exception:
                parsed_trial_ends_at = None
        elif isinstance(trial_ends_at, datetime):
            parsed_trial_ends_at = trial_ends_at

    ai_extractions_used = sub_data.get("ai_extractions_count", 0)
    
    # Calculate campaigns (total active/tracked and this month)
    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    total_campaigns = 0
    campaigns_this_month = 0
    try:
        total_resp = await client.table("campaigns").select("id", count="exact").eq("user_id", user.user.id).execute()
        if total_resp:
            total_campaigns = total_resp.count if getattr(total_resp, 'count', None) is not None else len(total_resp.data or [])
    except Exception as e:
        try:
            service_client = await get_service_client()
            total_resp = await service_client.table("campaigns").select("id", count="exact").eq("user_id", user.user.id).execute()
            if total_resp:
                total_campaigns = total_resp.count if getattr(total_resp, 'count', None) is not None else len(total_resp.data or [])
        except Exception:
            total_campaigns = 0

    try:
        month_resp = await client.table("campaigns").select("id", count="exact").eq("user_id", user.user.id).gte("created_at", start_of_month).execute()
        if month_resp:
            campaigns_this_month = month_resp.count if getattr(month_resp, 'count', None) is not None else len(month_resp.data or [])
    except Exception as e:
        campaigns_this_month = 0

    return BillingUsageResponse(
        current_plan=current_plan,
        trial_ends_at=parsed_trial_ends_at,
        campaigns_this_month=campaigns_this_month,
        total_campaigns=total_campaigns,
        ai_extractions_used=ai_extractions_used,
        is_trial=is_trial,
        is_paid=is_paid,
    )


class CreateOrderRequest(BaseModel):
    is_annual: bool = False

class VerifyPaymentRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str

@router.post("/create-razorpay-order")
@limiter.limit("10/minute")
async def create_razorpay_order(
    request: Request,
    req: CreateOrderRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=500, detail="Razorpay is not configured")
        
    client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    
    # Dynamic Pricing from Settings
    base_price = settings.PRO_ANNUAL_INR if req.is_annual else settings.PRO_MONTHLY_INR
    amount = base_price * 100  # Amount in paise
    plan_type = "annual_pro" if req.is_annual else "monthly_pro"
    
    data = {
        "amount": amount,
        "currency": "INR",
        "receipt": f"rcpt_{str(user.user.id).replace('-', '')}",
        "notes": {
            "user_id": user.user.id,
            "type": plan_type
        }
    }
    
    try:
        order = await run_in_threadpool(client.order.create, data=data)
        return {"order_id": order["id"], "amount": amount, "currency": "INR"}
    except Exception as e:
        logger.error("razorpay_order_creation_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create order")

@router.post("/verify-payment")
@limiter.limit("10/minute")
async def verify_payment(
    request: Request,
    req: VerifyPaymentRequest,
    db_client=Depends(get_user_supabase_client),
    user: AuthenticatedUser = Depends(get_current_user),
):
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=500, detail="Razorpay is not configured")
        
    client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    
    try:
        # 1. Verify Payment Signature
        await run_in_threadpool(
            client.utility.verify_payment_signature,
            {
                'razorpay_payment_id': req.razorpay_payment_id,
                'razorpay_order_id': req.razorpay_order_id,
                'razorpay_signature': req.razorpay_signature
            }
        )
        
        # 2. Fetch order details to verify ownership and plan type
        order = await run_in_threadpool(client.order.fetch, req.razorpay_order_id)
        
        # Verify the order was explicitly created for the authenticated user
        if order.get("notes", {}).get("user_id") != user.user.id:
            raise HTTPException(status_code=403, detail="Forbidden")
            
        is_annual = order.get("notes", {}).get("type") == "annual_pro"
        days_to_add = 365 if is_annual else 30
        now = datetime.now(timezone.utc)
        
        service_client = await get_service_client()
        tx_inserted = False

        # 3. SEC-02 Idempotency & Replay Prevention
        try:
            await service_client.table("processed_transactions").insert({
                "order_id": req.razorpay_order_id,
                "payment_id": req.razorpay_payment_id,
                "user_id": user.user.id,
                "event_type": "payment.verified"
            }).execute()
            tx_inserted = True
        except Exception as db_err:
            err_str = str(db_err).lower()
            if any(k in err_str for k in ["duplicate key", "unique constraint", "23505"]):
                # Webhook or concurrent call race condition: check if credited for this user
                existing_tx = await service_client.table("processed_transactions").select("user_id").or_(
                    f"order_id.eq.{req.razorpay_order_id},payment_id.eq.{req.razorpay_payment_id}"
                ).execute()
                if existing_tx.data and existing_tx.data[0].get("user_id") == user.user.id:
                    logger.info("payment_already_credited_graceful", order_id=req.razorpay_order_id, user_id=user.user.id)
                    return {"status": "already_credited", "message": "Payment verified and already credited."}
                raise HTTPException(status_code=400, detail="This payment has already been credited or belongs to another user.")
            raise db_err

        # 4. Extend subscription with rollback safety
        try:
            sub_response = await db_client.table("subscriptions").select("*").eq("user_id", user.user.id).execute()
            
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
                    except Exception:
                        new_expiry = now + timedelta(days=days_to_add)
                else:
                    new_expiry = now + timedelta(days=days_to_add)
                    
                await service_client.table("subscriptions").update({
                    "tier": "pro",
                    "trial_ends_at": new_expiry.isoformat(),
                    "is_paid": True,
                    "razorpay_customer_id": None,
                    "razorpay_subscription_id": None, 
                }).eq("user_id", user.user.id).execute()
            else:
                await service_client.table("subscriptions").insert({
                    "user_id": user.user.id,
                    "tier": "pro",
                    "trial_ends_at": (now + timedelta(days=days_to_add)).isoformat(),
                    "is_paid": True,
                }).execute()
                
            return {"status": "success", "message": "Payment verified and tier updated to Pro."}

        except Exception as sub_err:
            # Rollback transaction record so user is not locked out of retrying
            if tx_inserted:
                try:
                    await service_client.table("processed_transactions").delete().eq("order_id", req.razorpay_order_id).execute()
                except Exception as rollback_err:
                    logger.error("failed_to_rollback_processed_tx", error=str(rollback_err))
            raise sub_err

    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("razorpay_verification_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to verify payment")


async def process_razorpay_webhook_db(order_id: str, user_id: str, notes: dict):
    """Database handler for the webhook."""
    from app.api.dependencies import get_service_client
    service_client = await get_service_client()
    
    try:
        await service_client.table("processed_transactions").insert({
            "order_id": order_id,
            "user_id": user_id,
            "event_type": "order.paid"
        }).execute()
    except Exception as db_err:
        err_str = str(db_err).lower()
        if "duplicate key value" in err_str or "unique constraint" in err_str or "23505" in err_str:
            import structlog
            structlog.get_logger(__name__).info("webhook_already_processed", order_id=order_id)
            return {"status": "ok", "message": "Already processed"}
        else:
            raise db_err

    now = datetime.now(timezone.utc)
    sub_response = await service_client.table("subscriptions").select("*").eq("user_id", user_id).execute()
    
    is_annual = notes.get("type") == "annual_pro"
    days_to_add = 365 if is_annual else 30 
    
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
            
        await service_client.table("subscriptions").update({
            "tier": "pro",
            "trial_ends_at": new_expiry.isoformat(),
            "is_paid": True
        }).eq("user_id", user_id).execute()
    else:
        await service_client.table("subscriptions").insert({
            "user_id": user_id,
            "tier": "pro",
            "trial_ends_at": (now + timedelta(days=days_to_add)).isoformat(),
            "is_paid": True
        }).execute()
        
    import structlog
    structlog.get_logger(__name__).info("webhook_processed_success", order_id=order_id, user_id=user_id)
    return {"status": "ok"}

@router.post("/razorpay-webhook")
async def razorpay_webhook(request: Request, background_tasks: BackgroundTasks):
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
        # Offload the cryptographic verification to the threadpool
        await run_in_threadpool(
            client.utility.verify_webhook_signature,
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
        order_id = order.get("id")
        notes = order.get("notes", {})
        user_id = notes.get("user_id")
        
        if user_id and order_id:
            # Offload database update to background task to instantly return 200 OK
            background_tasks.add_task(process_razorpay_webhook_db, order_id, user_id, notes)
                
    return {"status": "ok"}
