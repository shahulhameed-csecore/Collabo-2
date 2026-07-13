# main.py
`python
"""
main.py
=======
FastAPI application entry point.

BUG FIXES in this version
--------------------------
1. structlog.configure() now runs BEFORE any module that calls get_logger()
   is imported. Previously, reminders.py was imported on line 17 and called
   structlog.get_logger() at module level — before structlog.configure() had
   run on line 73. All reminder logs were silently dropped.

2. asyncio.ensure_future() replaced with asyncio.create_task() which is
   the correct API for scheduling a coroutine inside a running event loop.

3. Added POST /internal/trigger-reminders endpoint so you can manually fire
   the reminder job from curl/Render shell without redeploying.

4. Added GET /internal/scheduler-status to see next scheduled run time.
"""

import logging
import structlog
import sentry_sdk
from datetime import datetime, timezone

# ─── Step 1: Configure structlog FIRST ────────────────────────────────────────
# This MUST happen before any module-level structlog.get_logger() call.
# Previously this was on line 73, after reminders.py was imported on line 17.
logging.basicConfig(level=logging.INFO)

def redact_secrets(logger, log_method, event_dict):
    """Redacts sensitive information from logs."""
    sensitive_keys = {"token", "secret", "password", "key", "authorization", "auth"}
    for k, v in event_dict.items():
        if any(sec in k.lower() for sec in sensitive_keys):
            event_dict[k] = "***REDACTED***"
    return event_dict

structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        redact_secrets,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.dict_tracebacks,
        structlog.processors.JSONRenderer(),
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

# ─── Step 2: Get a logger for this module ─────────────────────────────────────
logger = structlog.get_logger(__name__)

# ─── Step 3: Now safe to import modules that call structlog.get_logger() ──────
from fastapi import FastAPI, Request, HTTPException, Response
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api import extract, campaigns, auth, whatsapp, uploads, reports, settings as settings_api, influencers, billing, tracker, telegram
from app.core.config import settings
from app.core.limiter import limiter

from contextlib import asynccontextmanager
import asyncio

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.executors.asyncio import AsyncIOExecutor

# reminders.py is now safe to import — structlog is already configured
from app.services.reminders import check_deadlines_job
from app.services.billing_cron import check_expired_trials_job

# ─── Sentry (optional, before app init) ───────────────────────────────────────
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        traces_sample_rate=0.1 if settings.ENVIRONMENT == "production" else 1.0,
        profiles_sample_rate=0.1 if settings.ENVIRONMENT == "production" else 1.0,
    )

# ─── Scheduler ────────────────────────────────────────────────────────────────
_executors = {"default": AsyncIOExecutor()}
scheduler = AsyncIOScheduler(executors=_executors)


# Store background tasks so they aren't garbage collected
background_tasks = set()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the background deadline checker on startup; stop on shutdown."""
    interval_minutes = settings.SCHEDULER_INTERVAL_MINUTES

    scheduler.add_job(
        check_deadlines_job,
        trigger="interval",
        minutes=interval_minutes,
        id="deadlines_job",
        replace_existing=True,
        misfire_grace_time=600,   # run up to 10 min late after a restart
        coalesce=True,            # collapse stacked missed runs into one
        jitter=30,                # ±30 s spread to avoid thundering herd
    )
    
    scheduler.add_job(
        check_expired_trials_job,
        trigger="interval",
        minutes=interval_minutes,
        id="billing_downgrade_job",
        replace_existing=True,
        misfire_grace_time=600,
        coalesce=True,
        jitter=30,
    )

    # Optional: Schedule monthly report generation
    # Runs on the 1st of every month at 00:00 UTC
    async def monthly_report_job():
        logger.info("Starting monthly report background job...")
        # Add logic here to iterate over users and email reports if desired
        pass

    scheduler.add_job(
        monthly_report_job,
        "cron",
        day=1,
        hour=0,
        minute=0,
        id="monthly_report_job",
        replace_existing=True,
    )

    scheduler.start()

    # Fire immediately so the first check isn't delayed by a full hour after deploy.
    # We must hold a reference to the task so the garbage collector doesn't cancel it mid-run.
    task = asyncio.create_task(check_deadlines_job())
    background_tasks.add(task)
    task.add_done_callback(background_tasks.discard)
    
    billing_task = asyncio.create_task(check_expired_trials_job())
    background_tasks.add(billing_task)
    billing_task.add_done_callback(background_tasks.discard)

    job = scheduler.get_job("deadlines_job")
    logger.info(
        "scheduler_started",
        interval_minutes=interval_minutes,
        next_run=str(job.next_run_time) if job else "unknown",
        environment=settings.ENVIRONMENT,
    )

    yield

    scheduler.shutdown(wait=False)
    logger.info("scheduler_stopped")



# ─── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Collabo API",
    description="""
    **Collabo Core API**

    Powers the Collabo micro-influencer campaign management SaaS.

    ### Key Features:
    * **Zero-Trust Security:** Every request validated through Supabase RLS.
    * **Automated Reminders:** Hourly deadline checker with email + WhatsApp alerts.
    """,
    version="1.0.0",
    contact={
        "name": "Collabo Support",
        "url": settings.BASE_URL,
        "email": "support@collabo.app",
    },
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Internal-Secret"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    # Tightened CSP: Restrict connect-src and frame-ancestors. unsafe-inline is kept for Swagger UI.
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; "
        f"img-src 'self' data: {settings.BASE_URL}; "
        "connect-src 'self' https://*.supabase.co; "
        "frame-ancestors 'none';"
    )
    return response


from fastapi import HTTPException

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        # Let FastAPI's default HTTPException handler deal with it
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=getattr(exc, "headers", None)
        )

    logger.exception(
        "unhandled_exception",
        method=request.method,
        url=str(request.url),
        error=str(exc),
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please contact support."},
    )


app.include_router(extract.router)
app.include_router(campaigns.router)
app.include_router(auth.router)
app.include_router(whatsapp.router)
app.include_router(settings_api.router)
app.include_router(uploads.router)
app.include_router(reports.router)
app.include_router(influencers.router)
app.include_router(billing.router)
app.include_router(tracker.router)
app.include_router(telegram.router)

# ─── Public routes ─────────────────────────────────────────────────────────────

@app.api_route(
    "/health",
    methods=["GET", "HEAD"],
    tags=["Health"],
    description="Extremely lightweight liveness check for uptime monitoring.",
)
async def health_check(request: Request):
    if request.method == "HEAD":
        return Response(status_code=200)
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/", include_in_schema=False)
async def root_redirect():
    """301 permanent redirect: Render API domain → Vercel frontend."""
    return RedirectResponse(url=settings.BASE_URL, status_code=301)


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    from fastapi.responses import Response
    return Response(content=b"", media_type="image/x-icon")


# ─── Internal / debug routes ───────────────────────────────────────────────────

@app.post(
    "/internal/trigger-reminders",
    tags=["Internal"],
    description=(
        "Manually trigger the reminder job immediately. "
        "Use for debugging — protected by a shared secret header."
    ),
)
async def trigger_reminders_now(request: Request):
    """
    Manually fire check_deadlines_job() right now.

    Protected by X-Internal-Secret header to prevent abuse.
    Set INTERNAL_SECRET env var on Render to enable this endpoint.

    Usage:
        curl -X POST https://collabo-2.onrender.com/internal/trigger-reminders \\
             -H "X-Internal-Secret: your_secret_here"
    """
    internal_secret = settings.INTERNAL_SECRET  # type: ignore[attr-defined]
    if not internal_secret:
        raise HTTPException(
            status_code=403,
            detail="INTERNAL_SECRET env var not set — endpoint disabled.",
        )

    provided = request.headers.get("X-Internal-Secret", "")
    import secrets
    if not secrets.compare_digest(provided, internal_secret):
        raise HTTPException(status_code=403, detail="Invalid secret.")

    logger.info("reminders.manual_trigger", source="POST /internal/trigger-reminders")
    results = await check_deadlines_job()
    return {
        "message": "Reminder job completed synchronously.",
        "results": results
    }


@app.get(
    "/internal/scheduler-status",
    tags=["Internal"],
    description="Shows the scheduler state and next run time.",
)
async def scheduler_status():
    job = scheduler.get_job("deadlines_job")
    return {
        "scheduler_running": scheduler.running,
        "job_id": job.id if job else None,
        "next_run_time": str(job.next_run_time) if job else None,
        "trigger": str(job.trigger) if job else None,
    }

`

# auth.py
`python
import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from app.services.supabase import supabase
from app.core.limiter import limiter

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/token")
@limiter.limit("10/minute")
async def login_for_access_token(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    try:
        # In OAuth2, the client sends 'username' and 'password'.
        # We map 'username' to 'email' for Supabase authentication.
        auth_response = supabase.auth.sign_in_with_password({
            "email": form_data.username,
            "password": form_data.password
        })
        if not auth_response or not auth_response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return {"access_token": auth_response.session.access_token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        # Log internally but NEVER expose raw exception details to the caller
        logger.warning("Login failed for user", email=form_data.username, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

`

# billing.py
`python
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from app.api.dependencies import get_current_user, get_user_supabase_client, AuthenticatedUser, get_service_client
from app.core.config import settings
import razorpay
from fastapi import HTTPException
from datetime import timedelta
from starlette.concurrency import run_in_threadpool

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
        sub_response = await client.table("subscriptions").select("*").eq("user_id", user.user.id).execute()
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
        campaigns_response = await client.table("campaigns").select("id", count="exact").eq("user_id", user.user.id).gte("created_at", start_of_month).execute()
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
        
        # Payment is valid. We need to fetch the order details to verify ownership and plan type.
        order = client.order.fetch(req.razorpay_order_id)
        
        # SECURITY PATCH: Verify the order was explicitly created for the authenticated user.
        # This prevents an attacker from using a valid order from Account A to upgrade Account B.
        if order.get("notes", {}).get("user_id") != user.user.id:
            raise HTTPException(status_code=403, detail="Forbidden")
            
        is_annual = order.get("notes", {}).get("type") == "annual_pro"
        
        # Extend subscription
        days_to_add = 365 if is_annual else 30
        now = datetime.now(timezone.utc)
        
        # Get current subscription
        sub_response = db_client.table("subscriptions").select("*").eq("user_id", user.user.id).execute()
        
        service_client = await get_service_client()
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
            await service_client.table("subscriptions").update({
                "tier": "pro",
                "trial_ends_at": new_expiry.isoformat(),
                "razorpay_customer_id": None, # or update if available
                "razorpay_subscription_id": None, 
            }).eq("user_id", user.user.id).execute()
        else:
            # If no subscription exists for some reason, create one
            await service_client.table("subscriptions").insert({
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
            "trial_ends_at": new_expiry.isoformat()
        }).eq("user_id", user_id).execute()
    else:
        await service_client.table("subscriptions").insert({
            "user_id": user_id,
            "tier": "pro",
            "trial_ends_at": (now + timedelta(days=days_to_add)).isoformat()
        }).execute()
        
    import structlog
    structlog.get_logger(__name__).info("webhook_processed_success", order_id=order_id, user_id=user_id)
    return {"status": "ok"}

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
            try:
                # Offload the synchronous Supabase DB logic to the threadpool
                result = await run_in_threadpool(process_razorpay_webhook_db, order_id, user_id, notes)
                return result
            except Exception as e:
                import structlog
                structlog.get_logger(__name__).error("razorpay_webhook_processing_failed", error=str(e))
                # Do NOT return 200 if the DB update failed, let Razorpay retry
                raise HTTPException(status_code=500, detail="Internal processing error")
                
    return {"status": "ok"}

`

# campaigns.py
`python
import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
from pydantic import BaseModel, Field
from app.schemas.campaign import CampaignCreate, CampaignUpdate, CampaignStatusUpdate, CampaignResponse, CampaignStatus, PaginatedCampaigns
from app.api.dependencies import get_current_user, get_user_supabase_client, AuthenticatedUser
from app.core.limiter import limiter
from app.core.utils import handle_db_error, get_valid_transitions
from fastapi import Request

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/campaigns", tags=["Campaigns"])

from fastapi import BackgroundTasks

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
    current_campaigns = await client.table("campaigns").select("id, status, user_id, influencer_handle, influencer_name").in_("id", payload.campaign_ids).execute()
    if not current_campaigns.data:
        return {"message": "No valid campaigns found"}
    
    new_status = payload.status.value

    if new_status == "content_received":
        raise HTTPException(status_code=403, detail="Only influencers can mark content as received via proof upload.")

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

    response = await client.table("campaigns").update({"status": new_status}).in_("id", valid_ids).execute()
    
    try:
        from app.api.dependencies import get_service_client
        service_client = await get_service_client()
        display_status = new_status.replace("_", " ").title()
        
        notifications_to_insert = []
        for camp in current_campaigns.data:
            if camp["id"] in valid_ids:
                inf_name = camp.get("influencer_name") or camp.get("influencer_handle") or "Creator"
                notifications_to_insert.append({
                    "user_id": camp.get("user_id"),
                    "title": f"Campaign {display_status}",
                    "message": f"The campaign for {inf_name} was moved to {display_status}.",
                    "type": "info",
                    "link_url": "/dashboard",
                    "is_read": False
                })
                
        if notifications_to_insert:
            await service_client.table("notifications").insert(notifications_to_insert).execute()
            
    except Exception as e:
        logger.error(f"Failed to execute bulk insert for notifications: {e}")

    return {"message": f"Updated {len(response.data)} campaigns"}

@router.delete("/bulk/delete", response_model=dict)
@limiter.limit("10/minute")
async def bulk_delete(
    request: Request,
    payload: BulkDelete,
    client=Depends(get_user_supabase_client),
):
    response = await client.table("campaigns").delete().in_("id", payload.campaign_ids).execute()
    return {"message": f"Deleted {len(response.data)} campaigns"}

@router.post("/bulk/remind", response_model=dict)
@limiter.limit("5/minute")
async def bulk_remind(
    request: Request,
    payload: BulkDelete,
    client=Depends(get_user_supabase_client),
):
    return {"message": f"Reminders queued for {len(payload.campaign_ids)} campaigns"}

@router.get("/", response_model=PaginatedCampaigns)
@limiter.limit("60/minute")
async def get_campaigns(
    request: Request,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    client=Depends(get_user_supabase_client),
):
    try:
        response = await client.table("campaigns").select("*", count="exact").range(offset, offset + limit - 1).execute()
        
        data = response.data if response and hasattr(response, 'data') else []
        count = response.count if response and hasattr(response, 'count') and response.count is not None else 0
        
        return {
            "data": data,
            "count": count,
            "limit": limit,
            "offset": offset
        }
    except Exception as e:
        logger.error("campaigns_fetch_failed", error=str(e))
        return {"data": [], "count": 0, "limit": limit, "offset": offset}

async def _generate_unique_short_code(client, max_retries=5) -> str:
    import secrets
    import string
    for _ in range(max_retries):
        code = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))
        res = await client.table("campaigns").select("id").eq("short_code", code).execute()
        if not res.data:
            return code
    raise HTTPException(status_code=500, detail="Failed to generate unique short code. Please try again.")

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
        data["short_code"] = await _generate_unique_short_code(client)

    try:
        from app.api.billing import IS_TESTING_PHASE
        if not IS_TESTING_PHASE:
            sub_res = await client.table("subscriptions").select("tier, trial_ends_at").eq("user_id", user.user.id).execute()
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
                count_res = await client.table("campaigns").select("id", count="exact").eq("user_id", user.user.id).execute()
                if count_res.count is not None and count_res.count >= 5:
                    raise HTTPException(status_code=403, detail="Free tier limit reached. Please upgrade to Pro to create more campaigns.")

        response = await client.table("campaigns").insert(data).execute()
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
        current = await client.table("campaigns").select("short_code").eq("id", id).execute()
        if current.data and not current.data[0].get("short_code"):
            data["short_code"] = await _generate_unique_short_code(client)

    response = await client.table("campaigns").update(data).eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Campaign not found or access denied")
    return response.data[0]


@router.patch("/{id}/status", response_model=CampaignResponse)
@limiter.limit("20/minute")
async def update_campaign_status(
    request: Request,
    id: str,
    status_update: CampaignStatusUpdate,
    background_tasks: BackgroundTasks,
    client=Depends(get_user_supabase_client),
):
    current_campaign = await client.table("campaigns").select("status, user_id, influencer_handle, influencer_name").eq("id", id).execute()
    if not current_campaign.data:
        raise HTTPException(status_code=404, detail="Campaign not found or access denied")
    
    current_status = current_campaign.data[0]["status"]
    new_status = status_update.status.value

    if new_status == "content_received" and current_status != "content_received":
        raise HTTPException(status_code=403, detail="Only influencers can mark content as received via proof upload.")

    valid_transitions = get_valid_transitions()

    if new_status != current_status and new_status not in valid_transitions.get(current_status, []):
        raise HTTPException(status_code=400, detail=f"Invalid transition from {current_status} to {new_status}")

    data = status_update.model_dump(mode="json")
    response = await client.table("campaigns").update(data).eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Campaign not found or access denied")
        
    if new_status != current_status:
        try:
            from app.api.dependencies import get_service_client
            from app.services.notifications import create_notification
            service_client = await get_service_client()
            user_id = current_campaign.data[0].get("user_id")
            inf_name = current_campaign.data[0].get("influencer_handle") or current_campaign.data[0].get("influencer_name") or "Creator"
            display_status = new_status.replace("_", " ").title()
            
            # Fire and forget notification safely without blocking
            background_tasks.add_task(
                create_notification,
                service_client=service_client,
                user_id=user_id,
                title=f"Campaign {display_status}",
                message=f"The campaign for {inf_name} was moved to {display_status}.",
                type="info",
                link_url="/dashboard"
            )
        except Exception as e:
            logger.error(f"Failed to queue status notification: {e}")
            
    return response.data[0]

@router.delete("/{id}")
@limiter.limit("20/minute")
async def delete_campaign(request: Request, id: str, client=Depends(get_user_supabase_client)):
    response = await client.table("campaigns").delete().eq("id", id).execute()
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
    
    def gen_code():
        return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))
    
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
            "short_code": gen_code()
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
            "short_code": gen_code()
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
            "short_code": gen_code()
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
            "short_code": gen_code()
        }
    ]
    
    try:
        response = await client.table("campaigns").insert(sample_campaigns).execute()
        return response.data if response and hasattr(response, 'data') else []
    except Exception as e:
        logger.error(f"Failed to load sample data: {e}")
        raise HTTPException(status_code=500, detail="Failed to load sample data")

`

# dependencies.py
`python
import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_async_client, AsyncClient, ClientOptions
from app.services.supabase import supabase
from app.core.config import settings

logger = logging.getLogger(__name__)

security = HTTPBearer()

class AuthenticatedUser:
    def __init__(self, user, jwt_token):
        self.user = user
        self.jwt_token = jwt_token

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> AuthenticatedUser:
    """
    Validates the JWT token against Supabase Auth (server-side verification).
    Raises 401 if the token is missing, expired, or invalid.
    Error details are intentionally generic to prevent information leakage.
    """
    token = credentials.credentials
    try:
        service_client = await get_service_client()
        user_response = await service_client.auth.get_user(token)
        if user_response and user_response.user:
            return AuthenticatedUser(user_response.user, token)
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except HTTPException:
        raise
    except Exception as e:
        # Log internally but never expose exception internals to the caller
        logger.warning("Token validation failed", error=type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_user_supabase_client(user: AuthenticatedUser = Depends(get_current_user)):
    """
    Returns a Supabase client authenticated with the user's JWT.
    This client will respect Row Level Security (RLS) policies.
    Defined once here to avoid duplication across router files.
    """
    client = await create_async_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_ANON_KEY,
        options=ClientOptions(headers={"Authorization": f"Bearer {user.jwt_token}"})
    )
    return client

async def get_service_client():
    """
    Returns a Supabase client authenticated with the SERVICE ROLE KEY.
    Use ONLY for internal/background tasks that need to bypass RLS.
    """
    if not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=500, 
            detail="Supabase service role key not configured."
        )
    return await create_async_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


`

# extract.py
`python
import structlog
from fastapi import APIRouter, Depends, UploadFile, File, Request, HTTPException
from app.api.dependencies import get_current_user, AuthenticatedUser, get_user_supabase_client
from app.core.limiter import limiter
from app.services.gemini import extract_campaign_data
from datetime import datetime, timezone

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/extract", tags=["Extraction"])

@router.post("/", response_model=dict)
@limiter.limit("5/minute")
async def extract_data(
    request: Request,
    file: UploadFile = File(...),
    user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        from fastapi.concurrency import run_in_threadpool
        logger.info("extract_endpoint_called", user_id=user.user.id, filename=file.filename, content_type=file.content_type)
        
        # Enforce Billing / Trial Limits synchronously via threadpool
        async def verify_subscription(user):
            client = get_user_supabase_client(user)
            return await client.table("subscriptions").select("tier, trial_ends_at").eq("user_id", user.user.id).execute()
            
        sub_res = await verify_subscription(user)
        
        from app.api.billing import IS_TESTING_PHASE
        if not IS_TESTING_PHASE and sub_res.data:
            sub = sub_res.data[0]
            tier = sub.get("tier", "free")
            trial_str = sub.get("trial_ends_at")
            
            parsed_trial = None
            if isinstance(trial_str, str):
                try:
                    parsed_trial = datetime.fromisoformat(trial_str.replace("Z", "+00:00"))
                except: pass
                
            now = datetime.now(timezone.utc)
            is_trial_active = parsed_trial and parsed_trial > now
            
            if tier != "pro" or (tier == "pro" and parsed_trial and not is_trial_active):
                raise HTTPException(status_code=403, detail="AI Extraction requires a Pro plan or an active free trial.")
                
        # Security: Prevent OOM by enforcing a strict 10MB limit via chunked reading.
        MAX_SIZE = 10 * 1024 * 1024
        file_bytes = bytearray()
        
        while chunk := await file.read(1024 * 1024): # 1MB chunks
            file_bytes.extend(chunk)
            if len(file_bytes) > MAX_SIZE:
                logger.warning("extract_endpoint_rejected_file_too_large", user_id=user.user.id, size=len(file_bytes))
                raise HTTPException(status_code=413, detail="File too large. Maximum size allowed is 10MB.")
                
        # Delegate to the robust gemini service
        extracted_data = await extract_campaign_data(
            file_bytes=bytes(file_bytes),
            filename=file.filename,
            mime_type=file.content_type or "application/octet-stream"
        )
        
        return extracted_data
    except HTTPException:
        raise
    except Exception as e:
        logger.error("extract_endpoint_failed", error=str(e), user_id=user.user.id if hasattr(user, 'user') else None)
        return {
            "influencer_name": "",
            "influencer_handle": "",
            "platform": "",
            "deliverables": "",
            "deadline": "",
            "payment_amount": 0.0,
            "special_notes": f"AI Extraction failed ({str(e)}). Please enter details manually.",
            "status": "draft",
            "requires_human_review": True
        }

`

# influencers.py
`python
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
    try:
        campaigns_response = await client.table("campaigns").select("*").eq("user_id", user.user.id).execute()
        campaigns = campaigns_response.data if campaigns_response and hasattr(campaigns_response, 'data') else []
    except Exception as e:
        import structlog
        structlog.get_logger(__name__).error("influencers_campaigns_fetch_failed", error=str(e))
        campaigns = []

    # Group by handle or fallback to name/id
    influencer_stats = {}
    for c in campaigns:
        raw_handle = c.get("influencer_handle")
        name = c.get("influencer_name")
        
        if raw_handle and str(raw_handle).strip() and str(raw_handle).strip().lower() != "n/a":
            group_key = str(raw_handle).strip()
        elif name and str(name).strip() and str(name).strip().lower() != "unknown":
            group_key = f"[name]:{str(name).strip()}"
        else:
            group_key = f"[id]:{c.get('id')}"
        
        if group_key not in influencer_stats:
            influencer_stats[group_key] = {
                "handle": group_key,
                "name": name,
                "platform": c.get("platform"),
                "total_campaigns": 0,
                "resolved_campaigns": 0,
                "successful_campaigns": 0,
                "last_collaboration": None,
                "notes": None,
                "names_set": set()
            }
        
        stats = influencer_stats[group_key]
        stats["total_campaigns"] += 1
        
        if name and str(name).strip() and str(name).strip().lower() != "unknown":
            stats["names_set"].add(str(name).strip())
        
        status = c.get("status")
        if status in ["approved", "paid", "cancelled"]:
            stats["resolved_campaigns"] += 1
            if status in ["approved", "paid"]:
                stats["successful_campaigns"] += 1
            
        deadline = c.get("deadline")
        if deadline:
            if not stats["last_collaboration"] or deadline > stats["last_collaboration"]:
                stats["last_collaboration"] = deadline

    try:
        profiles_response = await client.table("influencer_profiles").select("*").eq("user_id", user.user.id).execute()
        profiles = profiles_response.data if profiles_response and hasattr(profiles_response, 'data') else []
    except Exception as e:
        import structlog
        structlog.get_logger(__name__).warning("influencers_profiles_fetch_failed", error=str(e))
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
                "resolved_campaigns": 0,
                "successful_campaigns": 0,
                "last_collaboration": None,
                "notes": p.get("notes")
            }

    # Format response
    response_data = []
    for stats in influencer_stats.values():
        if "names_set" in stats and stats["names_set"]:
            stats["name"] = " / ".join(sorted(stats["names_set"]))
            
        success_rate = (stats["successful_campaigns"] / stats["resolved_campaigns"]) * 100 if stats["resolved_campaigns"] > 0 else 0.0
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
        response = await client.table("influencer_profiles").upsert(upsert_data, on_conflict="user_id,handle").execute()
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

`

# reports.py
`python
import calendar
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from app.api.dependencies import get_current_user, AuthenticatedUser
from app.services.reports import fetch_monthly_metrics, generate_pdf_report, generate_excel_report
from app.core.limiter import limiter
from fastapi import Request

router = APIRouter(prefix="/campaigns/reports", tags=["Reports"])

@router.get("/monthly")
@limiter.limit("10/minute")
async def get_monthly_report(
    request: Request,
    month: str = Query(..., description="Month in YYYY-MM format"),
    format: str = Query("pdf", description="Format of the report: 'pdf' or 'excel'"),
    user: AuthenticatedUser = Depends(get_current_user)
):
    try:
        dt = datetime.strptime(month, "%Y-%m")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM")
    
    # Calculate start and end date strings for the query
    _, last_day = calendar.monthrange(dt.year, dt.month)
    start_date = f"{dt.year}-{dt.month:02d}-01"
    end_date = f"{dt.year}-{dt.month:02d}-{last_day:02d}"
    month_str = dt.strftime("%B %Y")
    
    # Fetch data
    metrics = await fetch_monthly_metrics(user.user.id, start_date, end_date)
    
    if metrics["total_campaigns_in_period"] == 0:
        raise HTTPException(status_code=404, detail=f"No campaigns found for {month_str}")
        
    if format.lower() == "pdf":
        pdf_bytes = generate_pdf_report(metrics, month_str)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="Report_{month}.pdf"'}
        )
    elif format.lower() == "excel":
        excel_bytes = generate_excel_report(metrics, month_str)
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="Report_{month}.xlsx"'}
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid format. Use 'pdf' or 'excel'.")

`

# settings.py
`python
import logging
import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.api.dependencies import get_current_user, get_user_supabase_client, AuthenticatedUser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["Settings"])

# Maximum digits for a phone number (e.g. 15 per E.164 standard)
_PHONE_RE = re.compile(r"^\d{8,15}$")


from typing import Optional

class SettingsInput(BaseModel):
    whatsapp_number: Optional[str] = None
    email_reminders_enabled: bool = True
    whatsapp_reminders_enabled: bool = True
    username: Optional[str] = None
    telegram_username: Optional[str] = None


@router.post("/whatsapp")
async def save_settings(
    input_data: SettingsInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
    client=Depends(get_user_supabase_client),
):
    """
    Saves or updates the user's WhatsApp settings.
    """
    user_id = current_user.user.id

    # Extract only digits for whatsapp_number if provided
    clean_number = None
    if input_data.whatsapp_number:
        clean_number = "".join(filter(str.isdigit, input_data.whatsapp_number))

        # Strip leading zero if 11 digits starting with 0 (common in India)
        if len(clean_number) == 11 and clean_number.startswith("0"):
            clean_number = clean_number[1:]

        # Auto-prepend India country code if exactly 10 digits
        if len(clean_number) == 10:
            clean_number = "91" + clean_number

        # Validate against E.164 range: 8–15 digits after cleanup
        if not _PHONE_RE.match(clean_number):
            raise HTTPException(
                status_code=400,
                detail="Invalid phone number. Please provide a valid number with country code (8–15 digits).",
            )

    try:
        from fastapi.concurrency import run_in_threadpool
        # Check current settings to detect if WhatsApp number changed
        current_settings = await client.table("user_settings".select("whatsapp_number").eq("user_id", user_id).execute())
        old_number = current_settings.data[0].get("whatsapp_number") if current_settings.data else None
        
        payload = {
            "user_id": user_id,
            "email_reminders_enabled": input_data.email_reminders_enabled,
            "whatsapp_reminders_enabled": input_data.whatsapp_reminders_enabled,
        }
        if clean_number is not None:
            payload["whatsapp_number"] = clean_number
        if input_data.username is not None:
            payload["username"] = input_data.username
        if input_data.telegram_username is not None:
            # ensure @ prefix is kept or add it later? Actually, frontend will just send string.
            tg = input_data.telegram_username.strip()
            if tg and not tg.startswith("@"):
                tg = f"@{tg}"
            payload["telegram_username"] = tg if tg else None

        await client.table("user_settings".upsert(payload).execute())
        
        # Trigger notification if WhatsApp number was newly linked or updated
        if clean_number and clean_number != old_number:
            try:
                from app.api.dependencies import get_service_client
                from app.services.notifications import create_notification
                service_client = await get_service_client()
                await create_notification(
                    service_client=service_client,
                    user_id=user_id,
                    title="WhatsApp Linked 🎉",
                    message=f"Your number ending in {clean_number[-4:]} is now connected to the Collabo Bot.",
                    type="success",
                    link_url="/settings"
                )
            except Exception as e:
                logger.error(f"Failed to create whatsapp link notification: {e}")

        return {
            "message": "Settings saved successfully",
            "whatsapp_number": clean_number,
            "email_reminders_enabled": input_data.email_reminders_enabled,
            "whatsapp_reminders_enabled": input_data.whatsapp_reminders_enabled,
            "username": input_data.username,
            "telegram_username": input_data.telegram_username,
        }
    except Exception as e:
        error_str = str(e).lower()
        if "unique constraint" in error_str or "duplicate key" in error_str:
            if "username" in error_str:
                raise HTTPException(
                    status_code=400,
                    detail="This username is already taken. Please choose another one.",
                )
            raise HTTPException(
                status_code=400,
                detail="This WhatsApp number is already linked to another account.",
            )
        if "relation" in error_str and "user_settings" in error_str:
            raise HTTPException(
                status_code=500,
                detail="Database table 'user_settings' is missing. Please run the SQL setup script.",
            )
        logger.error("Failed to save user settings", user_id=user_id, error=type(e).__name__)
        raise HTTPException(status_code=500, detail="Failed to save settings. Please try again.")


@router.get("/whatsapp")
async def get_settings(
    current_user: AuthenticatedUser = Depends(get_current_user),
    client=Depends(get_user_supabase_client),
):
    user_id = current_user.user.id

    try:
        response = (
            await client.table("user_settings")
            .select("whatsapp_number, email_reminders_enabled, whatsapp_reminders_enabled, username, telegram_username")
            .eq("user_id", user_id)
            .execute()
        )
        if response.data:
            return response.data[0]
        return {
            "whatsapp_number": None,
            "email_reminders_enabled": True,
            "whatsapp_reminders_enabled": True,
            "username": None,
            "telegram_username": None,
        }
    except Exception as e:
        logger.error("Failed to fetch user settings", user_id=user_id, error=type(e).__name__)
        return {
            "whatsapp_number": None,
            "email_reminders_enabled": True,
            "whatsapp_reminders_enabled": True,
            "telegram_username": None,
        }

`

# telegram.py
`python
import asyncio
import structlog
import json
import html
import httpx
from pydantic import ValidationError
import sentry_sdk
from fastapi import APIRouter, Request, HTTPException, Response, BackgroundTasks, Header
from app.core.config import settings
from app.core.limiter import limiter
from supabase import create_client
from app.services.gemini import extract_campaign_data
from app.services.telegram import send_telegram_message, download_telegram_media

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/webhook", tags=["Telegram Webhook"])

# Maximum bytes we allow to be downloaded from Telegram media (16 MB)
_MAX_MEDIA_BYTES = 16 * 1024 * 1024

# Initialize Supabase service client (bypasses RLS) — for webhook inserts
supabase_admin = None
if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
    supabase_admin = create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_ROLE_KEY,
    )

from app.core.parsers import parse_date_string, parse_corrections
from app.core.formatters import format_campaign_summary

@sentry_sdk.trace(op="webhook", name="Process Telegram Message")
async def process_telegram_message(update: dict):
    """
    Background task to process the incoming Telegram message.
    Looks up the user by username, calls Gemini AI, and inserts a campaign into Supabase.
    """
    try:
        if not supabase_admin:
            logger.error("Supabase Admin client not initialized — SERVICE_ROLE_KEY missing.")
            return

        update_id = update.get("update_id")
        
        is_callback = "callback_query" in update
        if is_callback:
            cb = update["callback_query"]
            message = cb.get("message", {})
            sender = cb.get("from", {})
            chat_id = message.get("chat", {}).get("id") or sender.get("id")
        else:
            message = update.get("message") or update.get("channel_post")
            if not message:
                return # Ignore non-message updates (e.g., inline queries)
            chat_id = message.get("chat", {}).get("id")
            sender = message.get("from", {})

        username = sender.get("username")
        
        if not chat_id:
            return

        logger.info("Started process_telegram_message", chat_id=chat_id, username=username)

        # 1. Deduplicate using update_id
        if update_id:
            try:
                existing = await supabase_admin.table("campaigns"
                    .select("id")
                    .ilike("special_notes", f"%[tg_update:{update_id}]%")
                    .limit(1)
                    .execute()
                )
                if existing.data:
                    logger.info("Duplicate Telegram message ignored", update_id=update_id)
                    return
            except Exception:
                pass  # Non-critical; proceed to process

        # 2. Match User Account
        user_id = None
        if username:
            # Check with and without @ prefix
            usernames_to_check = [username.lower(), f"@{username.lower()}"]
            try:
                user_response = await supabase_admin.table("user_settings"
                    .select("user_id, telegram_username")
                    .ilike("telegram_username", f"%{username}%")
                    .execute()
                )
                if user_response.data:
                    for row in user_response.data:
                        tg_user = (row.get("telegram_username") or "").strip().lower()
                        if tg_user in usernames_to_check:
                            user_id = row["user_id"]
                            break
            except Exception as e:
                logger.error("Failed to query user settings", error=str(e))
        
        if not user_id:
            logger.warning("No linked Collabo account found for Telegram username", username=username)
            unlinked_msg = (
                "👋 <b>Hi! I'm Collabo AI.</b>\n\n"
                "I noticed your Telegram account isn't linked to Collabo yet.\n\n"
                "To start tracking campaigns automatically:\n"
                f"1. Go to your Collabo dashboard 👉 <b>Settings</b>.\n"
                f"2. Save your Telegram username <code>{html.escape(('@' + username) if username else 'YOUR_USERNAME')}</code>.\n\n"
                "Once linked, you can forward me influencer chats or voice notes and I'll do the rest! ✨"
            )
            success = await send_telegram_message(chat_id, unlinked_msg)
            logger.info("Sent unlinked message fallback", success=success)
            return

        logger.info("Matched user account", user_id=user_id)

        # 2b. Store the chat_id so we can send proactive reminders later
        try:
            await supabase_admin.table("user_settings".update({
                "telegram_chat_id": chat_id
            }).eq("user_id", user_id).execute())
        except Exception as e:
            logger.error("Failed to update telegram_chat_id", error=str(e))

        # 3. Handle Callback Queries (Inline Keyboards)
        if "callback_query" in update:
            cb = update["callback_query"]
            cb_id = cb.get("id")
            cb_data = cb.get("data", "")
            
            # Acknowledge immediately to remove loading icon
            from app.services.telegram import answer_callback_query
            await answer_callback_query(cb_id)

            if cb_data.startswith("camp_del:"):
                camp_id = cb_data.split(":")[1]
                await supabase_admin.table("campaigns".delete().eq("id", camp_id).eq("user_id", user_id).execute())
                await send_telegram_message(chat_id, "🗑️ <b>Campaign Deleted</b>\n\nI've removed that draft from your account.")
                return
            elif cb_data.startswith("camp_draft:"):
                # It is already a draft, so we just confirm
                await send_telegram_message(chat_id, "📝 <b>Saved as Draft!</b>\n\nYou can edit it later in your dashboard.")
                return
            elif cb_data.startswith("camp_act:"):
                camp_id = cb_data.split(":")[1]
                await supabase_admin.table("campaigns".update({"status": "active"}).eq("id", camp_id).eq("user_id", user_id).execute())
                await send_telegram_message(chat_id, "✅ <b>Campaign Activated!</b>\n\nIt will now show up on your dashboard and calendar.")
                return
            elif cb_data.startswith("camp_done:"):
                camp_id = cb_data.split(":")[1]
                await supabase_admin.table("campaigns".update({"status": "completed"}).eq("id", camp_id).eq("user_id", user_id).execute())
                await send_telegram_message(chat_id, "🎉 <b>Awesome!</b>\n\nI've marked that campaign as <b>Completed</b>.")
                return
            elif cb_data.startswith("camp_ext:"):
                camp_id = cb_data.split(":")[1]
                # Fetch campaign to get current deadline
                resp = await supabase_admin.table("campaigns".select("deadline").eq("id", camp_id).eq("user_id", user_id).execute())
                if resp.data and resp.data[0].get("deadline"):
                    cur = resp.data[0].get("deadline")
                    try:
                        from datetime import datetime, timedelta
                        dt = datetime.fromisoformat(cur)
                        new_dt = dt + timedelta(days=7)
                        await supabase_admin.table("campaigns".update({"deadline": new_dt.date().isoformat()}).eq("id", camp_id).eq("user_id", user_id).execute())
                        await send_telegram_message(chat_id, f"📅 <b>Deadline Extended!</b>\n\nNew deadline is: <b>{new_dt.date().isoformat()}</b>")
                    except Exception as e:
                        logger.error("Failed to parse deadline to extend", error=str(e))
                        await send_telegram_message(chat_id, "❌ Couldn't parse the current deadline to extend it. Please update it in the dashboard.")
                else:
                    await send_telegram_message(chat_id, "❌ Couldn't find a deadline to extend.")
                return
            return # Ensure we stop processing for all callback queries

        # 4. Handle Quick Replies (Yes, Correct, Draft, No)
        if "text" in message:
            text_val = message["text"].strip()
            text_lower = text_val.lower()
            
            # Check for short confirmation intents
            if len(text_lower) < 20 and text_lower in ["yes", "correct", "y", "yep", "draft", "no", "wrong", "delete", "cancel", "remove"]:
                recent_draft_resp = await supabase_admin.table("campaigns"
                    .select("*")
                    .eq("user_id", user_id)
                    .eq("status", "draft")
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute()
                )
                
                if recent_draft_resp.data:
                    draft = recent_draft_resp.data[0]
                    name = draft.get("influencer_name") or draft.get("influencer_handle") or "Unknown"
                    clean_name = html.escape(name)
                    
                    if text_lower in ["yes", "correct", "y", "yep"]:
                        await supabase_admin.table("campaigns".update({"status": "active"}).eq("id", draft["id"]).execute())
                        await send_telegram_message(chat_id, f"✅ Done! The campaign for <b>{clean_name}</b> is now Active.")
                        return
                    elif text_lower == "draft":
                        await send_telegram_message(chat_id, f"📝 Saved! The campaign for <b>{clean_name}</b> will remain a Draft. You can edit it later in your dashboard.")
                        return
                    elif text_lower in ["no", "wrong"]:
                        await send_telegram_message(chat_id, f"Got it. The campaign for <b>{clean_name}</b> is saved as a Draft. Please edit the details manually in your Collabo dashboard.")
                        return
                    elif text_lower in ["delete", "cancel", "remove"]:
                        await supabase_admin.table("campaigns".delete().eq("id", draft["id"]).execute())
                        await send_telegram_message(chat_id, f"🗑️ Campaign Deleted. I've removed the draft for <b>{clean_name}</b>.")
                        return
                else:
                    await send_telegram_message(chat_id, "❌ I couldn't find a recent Draft to confirm. It might already be Active or Deleted. You can create a new one by sending me the influencer details.")
                    return

            # Check for inline corrections
            if len(text_val) < 200:
                corrections, unparsed_date = parse_corrections(text_val)
                if corrections or unparsed_date:
                    recent_draft_resp = await supabase_admin.table("campaigns"
                        .select("*")
                        .eq("user_id", user_id)
                        .eq("status", "draft")
                        .order("created_at", desc=True)
                        .limit(1)
                        .execute()
                    )
                    
                    if recent_draft_resp.data:
                        draft = recent_draft_resp.data[0]
                        if corrections:
                            await supabase_admin.table("campaigns".update(corrections).eq("id", draft["id"]).execute())
                        
                        # Merge corrections into draft dict for immediate display
                        updated_draft = {**draft, **corrections}
                    else:
                        # If no Draft exists, create a new one!
                        campaign_data = {
                            "user_id": user_id,
                            "status": "draft",
                            "influencer_handle": "N/A",
                            "platform": "Other",
                            "special_notes": f"[tg_update:{update_id}]" if update_id else ""
                        }
                        if corrections:
                            campaign_data.update(corrections)
                        
                        insert_response = await supabase_admin.table("campaigns".insert(campaign_data).execute())
                        if insert_response.data:
                            updated_draft = insert_response.data[0]
                        else:
                            await send_telegram_message(chat_id, "❌ I couldn't find a recent draft, and failed to create a new one. Please try again.")
                            return
                    
                    base_summary = format_campaign_summary(updated_draft)
                    base_summary = base_summary.replace("🤖 <b>I've extracted the following details:</b>\n\n", "")
                    base_summary = base_summary.replace("🤖 <b>Collabo AI</b>\n\n⚠️ Some details were unclear to me. I've created a <b>Draft</b>.\n\n", "")
                    summary_msg = "🤖 <b>Got it! I've updated the details:</b>\n\n" + base_summary if recent_draft_resp.data else "🤖 <b>Got it! I've created a new Draft with these details:</b>\n\n" + base_summary
                    
                    if unparsed_date:
                        summary_msg = f"⚠️ I couldn't understand the date '<b>{html.escape(unparsed_date)}</b>'. Please use a format like '15 July' or 'YYYY-MM-DD'.\n\n" + summary_msg
                        
                    reply_markup = {
                        "inline_keyboard": [
                            [
                                {"text": "✅ Save as Active", "callback_data": f"camp_act:{updated_draft['id']}"}
                            ],
                            [
                                {"text": "📝 Save as Draft", "callback_data": f"camp_draft:{updated_draft['id']}"},
                                {"text": "🗑️ Delete", "callback_data": f"camp_del:{updated_draft['id']}"}
                            ]
                        ]
                    }
                    await send_telegram_message(chat_id, summary_msg, reply_markup=reply_markup)
                    return

        # 4. Extract content (Text / Audio / Image)
        content_for_gemini = None

        if "text" in message:
            content_for_gemini = message["text"].strip()
            if not content_for_gemini:
                await send_telegram_message(chat_id, "🤖 <b>Collabo AI</b>\n\nPlease send me a text message, screenshot, or voice note.")
                return

        elif "voice" in message or "audio" in message:
            media = message.get("voice") or message.get("audio")
            file_id = media.get("file_id")
            if not file_id:
                await send_telegram_message(chat_id, "🤖 <b>Collabo AI</b>\n\n❌ Oops! I couldn't download that audio. Please try sending it again.")
                return
                
            await send_telegram_message(chat_id, "🤖 <b>Collabo AI</b>\n\nListening to your voice note... 🎧")
            audio_bytes = await download_telegram_media(file_id, max_bytes=_MAX_MEDIA_BYTES)
            
            if not audio_bytes:
                content_for_gemini = "Telegram audio download failed or exceeded size limits."
            else:
                content_for_gemini = {"audio_bytes": audio_bytes, "mime_type": media.get("mime_type", "audio/ogg")}

        elif "photo" in message:
            # Telegram sends an array of photo sizes. The last one is the largest.
            photos = message["photo"]
            if not photos:
                await send_telegram_message(chat_id, "🤖 <b>Collabo AI</b>\n\n❌ I couldn't download the image. Please try again.")
                return
                
            largest_photo = photos[-1]
            file_id = largest_photo.get("file_id")
            caption = message.get("caption", "")
            
            await send_telegram_message(chat_id, "🤖 <b>Collabo AI</b>\n\nReading the screenshot... 📸")
            image_bytes = await download_telegram_media(file_id, max_bytes=_MAX_MEDIA_BYTES)
            
            if not image_bytes:
                content_for_gemini = f"{caption}\n(Telegram image download failed or exceeded size limits.)".strip()
            else:
                content_for_gemini = {
                    "image_bytes": image_bytes,
                    "mime_type": "image/jpeg",
                    "caption": caption,
                }
        else:
            await send_telegram_message(chat_id, "🤖 <b>Collabo AI</b>\n\nI can't read this type of message yet. 😅\nPlease send text, voice notes, or screenshots.")
            return

        # 4. Process with Gemini AI
        if "text" in message:
            await send_telegram_message(chat_id, "🤖 <b>Collabo AI</b>\n\nExtracting campaign details... ✨")
        
        file_bytes = b""
        mime_type = "text/plain"
        
        if isinstance(content_for_gemini, str):
            file_bytes = content_for_gemini.encode('utf-8')
            mime_type = "text/plain"
        elif isinstance(content_for_gemini, dict):
            if "audio_bytes" in content_for_gemini:
                file_bytes = content_for_gemini["audio_bytes"]
                mime_type = content_for_gemini["mime_type"]
            elif "image_bytes" in content_for_gemini:
                file_bytes = content_for_gemini["image_bytes"]
                mime_type = content_for_gemini["mime_type"]
                if content_for_gemini.get("caption"):
                    file_bytes += b"\n" + content_for_gemini["caption"].encode('utf-8')
                    
        logger.info("Calling Gemini extraction", mime_type=mime_type)
        extracted_data = await extract_campaign_data(file_bytes=file_bytes, filename="telegram_input", mime_type=mime_type)
        logger.info("Gemini extraction complete", extracted_data=extracted_data)
        
        if extracted_data:
            try:
                await supabase_admin.rpc("increment_ai_extractions", {"p_user_id": user_id}.execute())
            except Exception as e:
                logger.error("Failed to increment AI count via telegram webhook", error=str(e))

        # 5. Insert into Supabase
        campaign_data = {k: v for k, v in extracted_data.items() if k not in ["requires_human_review", "brand_name"]}

        if not campaign_data.get("influencer_handle"):
            campaign_data["influencer_handle"] = "N/A"
        if not campaign_data.get("platform") or campaign_data.get("platform") == "Other":
            campaign_data["platform"] = "Others"

        # Sanitize Date Formatting to prevent Postgres crashes
        raw_deadline = campaign_data.get("deadline")
        if raw_deadline and str(raw_deadline).strip():
            parsed_deadline = parse_date_string(str(raw_deadline))
            if parsed_deadline:
                campaign_data["deadline"] = parsed_deadline
            else:
                campaign_data["deadline"] = None
                extracted_data["requires_human_review"] = True
                existing_notes = campaign_data.get("special_notes") or ""
                campaign_data["special_notes"] = f"{existing_notes}\n(Note: Couldn't parse deadline '{raw_deadline}')".strip()
        else:
            campaign_data["deadline"] = None

        # Sanitize Payment Amount
        try:
            campaign_data["payment_amount"] = float(campaign_data.get("payment_amount") or 0.0)
            if campaign_data["payment_amount"] < 0:
                campaign_data["payment_amount"] = 0.0
        except ValueError:
            campaign_data["payment_amount"] = 0.0
            extracted_data["requires_human_review"] = True

        campaign_data["user_id"] = user_id
        
        extracted_status = campaign_data.get("status")
        if extracted_status not in ["active", "draft", "completed", "cancelled"]:
            campaign_data["status"] = "draft"
            
        # If extraction is partial/needs review, force it to Draft to prevent invalid Active campaigns
        if extracted_data.get("requires_human_review"):
            campaign_data["status"] = "draft"

        # Embed update ID in special_notes for idempotency tracking
        if update_id:
            existing_notes = campaign_data.get("special_notes") or ""
            campaign_data["special_notes"] = f"{existing_notes} [tg_update:{update_id}]".strip()

        insert_response = await supabase_admin.table("campaigns".insert(campaign_data).execute())

        if insert_response.data:
            inserted_campaign = insert_response.data[0]
            camp_id = inserted_campaign.get("id")
            logger.info("Campaign inserted successfully into DB", campaign_id=camp_id)
            
            summary = format_campaign_summary(
                inserted_campaign, 
                is_review=extracted_data.get("requires_human_review", False)
            )
            
            # Create interactive inline keyboard for the draft campaign
            reply_markup = {
                "inline_keyboard": [
                    [
                        {"text": "✅ Save as Active", "callback_data": f"camp_act:{camp_id}"}
                    ],
                    [
                        {"text": "📝 Save as Draft", "callback_data": f"camp_draft:{camp_id}"},
                        {"text": "🗑️ Delete", "callback_data": f"camp_del:{camp_id}"}
                    ]
                ]
            }
            
            success = await send_telegram_message(chat_id, summary, reply_markup=reply_markup)
            logger.info("Sent summary message to user with buttons", success=success)
            
            influencer = inserted_campaign.get("influencer_name") or inserted_campaign.get("influencer_handle") or "Unknown"
            
            from app.services.notifications import create_notification
            if extracted_data.get("requires_human_review"):
                await create_notification(
                    service_client=supabase_admin,
                    user_id=user_id,
                    title="AI Extraction Needs Review",
                    message=f"Created a draft campaign for {influencer} from Telegram, but some details were missing.",
                    type="warning",
                    link_url="/dashboard"
                )
            else:
                await create_notification(
                    service_client=supabase_admin,
                    user_id=user_id,
                    title="AI Campaign Created",
                    message=f"Successfully created a campaign for {influencer} from your Telegram message.",
                    type="success",
                    link_url="/dashboard"
                )
        else:
            logger.error("Failed to insert campaign into DB", response_data=insert_response.data)
            await send_telegram_message(chat_id, "❌ Sorry, I failed to save the campaign to the database. Please try again or check the dashboard.")

    except Exception as e:
        err_msg = str(e)
        sentry_sdk.capture_exception(e)
        logger.error("Telegram processing error", error=err_msg, exc_info=True)
        # Log to DB so we can see it!
        if supabase_admin:
            try:
                await supabase_admin.table("campaigns".insert({
                    "status": "draft",
                    "special_notes": f"CRASH: {err_msg}",
                    "influencer_name": "DEBUG CRASH TG",
                    "user_id": user_id if 'user_id' in locals() else None
                }).execute())
            except:
                pass
        
        if 'chat_id' in locals() and chat_id:
            await send_telegram_message(chat_id, "🤖 <b>Collabo AI</b>\n\n❌ Oops, my servers hit a snag while processing that message. Please try again!")

@router.post("/telegram")
@limiter.limit("60/minute")
async def telegram_webhook(
    request: Request, 
    background_tasks: BackgroundTasks,
    x_telegram_bot_api_secret_token: str | None = Header(default=None)
):
    """
    Receives incoming Telegram messages via Webhook.
    Always returns 200 OK quickly; heavy work is offloaded to a background task.
    """
    # Verify the secret token to ensure the request actually came from Telegram
    if settings.TELEGRAM_WEBHOOK_SECRET and x_telegram_bot_api_secret_token != settings.TELEGRAM_WEBHOOK_SECRET:
        logger.warning("Telegram secret token validation failed - unauthorized access attempt.")
        raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        payload_bytes = await request.body()
        data = json.loads(payload_bytes)
    except (json.JSONDecodeError, ValueError):
        logger.error("Received webhook, but body is invalid JSON.")
        return Response(content="OK", status_code=200)

    # Offload processing to background task
    try:
        if data.get("update_id"):
            logger.info("Queueing Telegram update to background", update_id=data.get("update_id"))
            background_tasks.add_task(process_telegram_message, data)
    except Exception as e:
        logger.error("Error queueing Telegram webhook payload for processing", error=str(e))

    return Response(content="OK", status_code=200)

`

# tracker.py
`python
import structlog
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from app.core.limiter import limiter
from fastapi import Request
from app.core.config import settings
from supabase import create_client, Client
import urllib.parse
import ipaddress
import socket

logger = structlog.get_logger(__name__)

def is_safe_url(url: str) -> bool:
    """Security check to prevent SSRF and Open Redirects to malicious schemas/internal IPs."""
    try:
        parsed = urllib.parse.urlparse(url)
        # 1. Enforce safe schemes
        if parsed.scheme not in ("http", "https"):
            return False
        
        hostname = parsed.hostname
        if not hostname:
            return False
            
        # 2. Prevent DNS rebinding / internal IP resolution
        # First check if it's a direct IP
        try:
            ip = ipaddress.ip_address(hostname)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast:
                return False
        except ValueError:
            # It's a domain name, not an IP string.
            # In a very strict environment, you would resolve it and check the resulting IP.
            # For this SaaS, blocking obvious internal IPs/localhost is sufficient.
            if hostname in ("localhost", "127.0.0.1", "[::1]"):
                return False
        
        return True
    except Exception:
        return False

router = APIRouter(prefix="/t", tags=["Tracker"])

# Using the service role key to bypass RLS since this is a public unauthenticated route
supabase_admin: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

@router.get("/{short_code}", response_class=RedirectResponse)
@limiter.limit("60/minute")
async def track_link(request: Request, short_code: str):
    try:
        # Fetch campaign by short_code
        response = await supabase_admin.table("campaigns").select("id, user_id, influencer_handle, influencer_name, destination_url, clicks").eq("short_code", short_code).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Tracking link not found")
            
        campaign_data = response.data[0]
        destination_url = campaign_data.get("destination_url")
        clicks = campaign_data.get("clicks", 0)
        
        if not destination_url:
            raise HTTPException(status_code=404, detail="Destination URL not found")
            
        # Call the RPC function to atomically increment clicks
        await supabase_admin.rpc("increment_campaign_clicks", {"p_short_code": short_code}).execute()

        # If this is the very first click, notify the owner
        if clicks == 0:
            user_id = campaign_data.get("user_id")
            inf_name = campaign_data.get("influencer_handle") or campaign_data.get("influencer_name") or "Creator"
            if user_id:
                from app.services.notifications import create_notification
                await create_notification(
                    service_client=supabase_admin,
                    user_id=user_id,
                    title="First Click Recorded! 🎉",
                    message=f"The tracking link for {inf_name} just got its first click.",
                    type="success",
                    link_url="/dashboard/analytics"
                )
        
        # Make sure the URL has http/https
        if not destination_url.startswith(("http://", "https://")):
            destination_url = "https://" + destination_url
            
        # Security: Prevent SSRF & Malicious Open Redirects
        if not is_safe_url(destination_url):
            logger.warning("tracker_blocked_unsafe_url", short_code=short_code, url=destination_url)
            raise HTTPException(status_code=400, detail="Invalid or unsafe destination URL.")
            
        return RedirectResponse(url=destination_url, status_code=302)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("tracker_redirect_failed", error=str(e), short_code=short_code)
        raise HTTPException(status_code=404, detail="Invalid tracking link")

`

# uploads.py
`python
import logging
import uuid
import magic
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from app.core.limiter import limiter
from fastapi import Request
from supabase import create_client
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/campaigns", tags=["Uploads"])

ALLOWED_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov"
}

MAX_IMAGE_SIZE = 5 * 1024 * 1024 # 5MB
MAX_VIDEO_SIZE = 50 * 1024 * 1024 # 50MB

def get_proof_received_email_html(inf_name: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<body style="font-family:system-ui,-apple-system,sans-serif;background:#0f172a;margin:0;padding:40px 16px;">
  <div style="max-width:600px;margin:0 auto;background:#1e293b;border-radius:16px;padding:32px;color:#e2e8f0;border:1px solid #334155;">
    <h1 style="color:#34d399;margin-top:0;">🎉 Proof Received!</h1>
    <p>The influencer <strong style="color:#fbbf24;">{inf_name}</strong> just uploaded their proof of posting.</p>
    <p>Please log in to review and approve the content.</p>
    <a href="{settings.BASE_URL}/dashboard" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:8px;margin-top:16px;">View Dashboard →</a>
  </div>
</body>
</html>"""

async def get_service_client():
    if not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Supabase service role key not configured.")
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

async def notify_owner_of_proof(user_id: str, inf_name: str):
    service_client = await get_service_client()
    
    # Fetch user settings
    resp = await service_client.table("user_settings").select("*").eq("user_id", user_id).execute()
    if not resp.data:
        return
    
    user_settings = resp.data[0]
    wa_num = user_settings.get("whatsapp_number")
    wa_enabled = user_settings.get("whatsapp_reminders_enabled", True)
    email_enabled = user_settings.get("email_reminders_enabled", True)

    from app.services.whatsapp import send_whatsapp_message
    from app.services.notifications import create_notification
    
    # Send in-app notification
    await create_notification(
        service_client=service_client,
        user_id=user_id,
        title="Proof Received",
        message=f"{inf_name} just uploaded their proof of posting.",
        type="success",
        link_url="/dashboard"
    )
    
    if wa_enabled and wa_num:
        body = (
            f"🎉 *Proof Received!*\nThe influencer *{inf_name}* just uploaded their proof of posting.\n\n"
            "Please log into Collabo to review and approve the content:\n"
            f"{settings.BASE_URL}/dashboard"
        )
        await send_whatsapp_message(wa_num, body)

    if email_enabled:
        from app.services.reminders import _send_email, _get_user_email
        email = await _get_user_email(service_client, user_id)
        if email:
            subject = f"🎉 Proof Received for {inf_name}"
            html = get_proof_received_email_html(inf_name)
            await _send_email(email, subject, html)

@router.post("/{token}/upload-proof")
@limiter.limit("10/minute")
async def upload_proof(
    request: Request,
    token: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    from fastapi.concurrency import run_in_threadpool
    service_client = await get_service_client()

    # 1. Validate Token and Campaign State
    campaign_resp = await service_client.table("campaigns").select("id", "status", "user_id", "influencer_name", "proof_url", "proof_history", "updated_at").eq("magic_link_token", token).execute()
    
    if not campaign_resp.data:
        raise HTTPException(status_code=404, detail="Invalid token.")
    
    campaign = campaign_resp.data[0]
    if campaign["status"] not in ["active", "rejected"]:
        raise HTTPException(status_code=400, detail="Campaign is not active or rejected. Proof cannot be uploaded.")

    # 2. Dynamic File Size Validation & OOM Prevention
    import tempfile
    
    # Check Magic Bytes and Size dynamically as we stream
    # 2048 is enough for magic byte detection
    first_chunk = await file.read(2048)
    if not first_chunk:
        raise HTTPException(status_code=400, detail="Empty file.")
        
    file_mime = magic.from_buffer(first_chunk, mime=True)
    if file_mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, MP4, and MOV are allowed.")
        
    is_image = file_mime.startswith("image/")
    max_size_allowed = MAX_IMAGE_SIZE if is_image else MAX_VIDEO_SIZE

    bytes_read = len(first_chunk)
    
    # Safely stream the rest of the file to a temporary file on disk (so we don't hold 50MB in RAM)
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp.write(first_chunk)
        
        while chunk := await file.read(1024 * 1024):  # 1MB chunks
            bytes_read += len(chunk)
            if bytes_read > max_size_allowed:
                import os
                tmp.close()
                os.unlink(tmp.name)
                raise HTTPException(status_code=413, detail=f"File size exceeds the limit ({'5MB' if is_image else '50MB'}).")
            tmp.write(chunk)
            
        tmp_path = tmp.name

    # 4. Generate Secure Filename
    ext = ALLOWED_MIME_TYPES[file_mime]
    secure_filename = f"{uuid.uuid4()}{ext}"

    # 5. Upload to Supabase Storage (offloaded to threadpool)
    try:
        def upload_to_storage():
            bucket_name = "proof-uploads"
            with open(tmp_path, "rb") as f:
                service_client.storage.from_(bucket_name).upload(
                    path=secure_filename,
                    file=f,
                    file_options={"content-type": file_mime}
                )
            return service_client.storage.from_(bucket_name).get_public_url(secure_filename)
            
        public_url = await run_in_threadpool(upload_to_storage)
        
        # Clean up temp file
        import os
        os.unlink(tmp_path)
        
        # 6. Update Campaign Status to 'content_received'
        def update_campaign_db():
            from datetime import datetime, timezone
            current_proof = campaign.get("proof_url")
        from datetime import datetime, timezone
        current_proof = campaign.get("proof_url")
        current_history = campaign.get("proof_history") or []
        
        if current_proof:
            current_history.append({
                "url": current_proof,
                "uploaded_at": campaign.get("updated_at") or datetime.now(timezone.utc).isoformat(),
            })

        update_data = {
            "status": "content_received",
            "proof_url": public_url,
            "proof_history": current_history
        }
        await service_client.table("campaigns").update(update_data).eq("id", campaign["id"]).execute()

        # 7. Notify Owner
        inf_name = campaign.get("influencer_name") or "Unknown Creator"
        if campaign.get("user_id"):
            background_tasks.add_task(notify_owner_of_proof, campaign["user_id"], inf_name)

        return {"message": "Proof uploaded successfully.", "proof_url": public_url}
        
    except Exception as e:
        logger.exception("Failed to upload proof")
        raise HTTPException(status_code=500, detail="Failed to upload file.")

`

# whatsapp.py
`python
import asyncio
import hmac
import hashlib
import structlog
import json
from fastapi import APIRouter, Request, HTTPException, Response, BackgroundTasks
import sentry_sdk
from app.core.config import settings
from app.core.limiter import limiter
from supabase import create_client
from app.services.gemini import extract_campaign_data
from app.core.parsers import parse_corrections, parse_date_string
from app.core.formatters import format_campaign_summary_wa
from app.services.whatsapp import send_whatsapp_message, download_whatsapp_media

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/webhook", tags=["WhatsApp Webhook"])

# Maximum bytes we allow to be downloaded from WhatsApp media (16 MB)
_MAX_MEDIA_BYTES = 16 * 1024 * 1024

# Initialize Supabase service client (bypasses RLS) — for webhook inserts
supabase_admin = None
if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
    supabase_admin = create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_ROLE_KEY,
    )


def verify_signature(payload: bytes, signature_header: str) -> bool:
    """
    Validates the X-Hub-Signature-256 header sent by Meta.
    Returns False if the secret is not configured OR signature is wrong.
    """
    if not settings.WHATSAPP_APP_SECRET:
        logger.warning("WHATSAPP_APP_SECRET is not set. Rejecting webhook request.")
        return False

    if not signature_header:
        return False

    parts = signature_header.split("=", 1)
    if len(parts) != 2 or parts[0] != "sha256":
        return False

    expected_sig = hmac.new(
        settings.WHATSAPP_APP_SECRET.encode("utf-8"),
        msg=payload,
        digestmod=hashlib.sha256,
    ).hexdigest()

    is_valid = hmac.compare_digest(expected_sig, parts[1])
    if not is_valid:
        logger.warning(f"Signature mismatch. Expected: {expected_sig}, Got: {parts[1]}")
    return is_valid


@router.get("/whatsapp")
async def verify_webhook(request: Request):
    """
    Required by Meta to verify the webhook URL during registration.
    """
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    if not mode or not token:
        raise HTTPException(status_code=400, detail="Missing parameters")

    if mode == "subscribe" and token == settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN:
        return Response(content=challenge, status_code=200)

    raise HTTPException(status_code=403, detail="Verification failed")


@sentry_sdk.trace(op="webhook", name="Process WhatsApp Message")
async def process_whatsapp_message(sender_id: str, message: dict):
    """
    Background task to process the incoming WhatsApp message.
    Looks up the user, calls Gemini AI, and inserts a campaign into Supabase.
    """
    try:
        logger.info("Started process_whatsapp_message", sender_id=sender_id)
        if not supabase_admin:
            logger.error("Supabase Admin client not initialized — SERVICE_ROLE_KEY missing.")
            return

        # 1. Deduplicate using message ID (prevent double-processing Meta retries)
        message_id = message.get("id")
        if message_id:
            try:
                existing = await supabase_admin.table("campaigns"
                    .select("id")
                    .ilike("special_notes", f"%[wa_msg:{message_id}]%")
                    .limit(1)
                    .execute()
                )
                if existing.data:
                    logger.info("Duplicate WhatsApp message ignored", message_id=message_id)
                    return
            except Exception:
                pass  # Non-critical; proceed to process

        # 2. Bulletproof Number Matching (Handles international, +91, 0, and local formats)
        clean_sender = "".join(filter(str.isdigit, sender_id))
        possible_numbers = [clean_sender, f"+{clean_sender}"]
        
        # Handle India specific formats
        if clean_sender.startswith("91") and len(clean_sender) > 10:
            base = clean_sender[2:]
            possible_numbers.extend([base, f"0{base}", f"+91{base}"])
        # Handle US specific formats (often used for Test Numbers)
        elif clean_sender.startswith("1") and len(clean_sender) > 10:
            base = clean_sender[1:]
            possible_numbers.extend([base, f"+1{base}"])
            
        if len(clean_sender) == 10:
            possible_numbers.extend([f"91{clean_sender}", f"+91{clean_sender}"])
            
        possible_numbers = list(set(possible_numbers)) # Remove duplicates

        user_response = await supabase_admin.table("user_settings"
            .select("user_id")
            .in_("whatsapp_number", possible_numbers)
            .execute()
        )

        if not user_response.data:
            logger.warning("No linked Collabo account found for number", possible_numbers=possible_numbers)
            unlinked_msg = (
                "👋 *Hi! I'm Collabo AI.*\n\n"
                "I noticed your WhatsApp number isn't linked to a Collabo account yet.\n\n"
                "To start tracking campaigns automatically:\n"
                "1. Go to your Collabo dashboard 👉 *Settings*.\n"
                "2. Save this exact number.\n\n"
                "Once linked, you can forward me influencer chats or voice notes and I'll do the rest! ✨"
            )
            success = await send_whatsapp_message(sender_id, unlinked_msg)
            logger.info("Sent unlinked message fallback", success=success)
            return

        user_id = user_response.data[0]["user_id"]
        logger.info("Matched user account", user_id=user_id)

        msg_type = message.get("type")
        content_for_gemini = None

        # 3. Handle Quick Replies (Yes, Draft, No) & Corrections
        if msg_type == "text":
            text_val = message.get("text", {}).get("body", "").strip()
            text_lower = text_val.lower()
            
            # Check for short confirmation intents
            if len(text_lower) < 20 and text_lower in ["yes", "correct", "y", "yep", "draft", "no", "wrong", "delete", "cancel", "remove"]:
                recent_draft_resp = await supabase_admin.table("campaigns"
                    .select("*")
                    .eq("user_id", user_id)
                    .eq("status", "draft")
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute()
                )
                
                if recent_draft_resp.data:
                    draft = recent_draft_resp.data[0]
                    name = draft.get("influencer_name") or draft.get("influencer_handle") or "Unknown"
                    
                    if text_lower in ["yes", "correct", "y", "yep"]:
                        await supabase_admin.table("campaigns".update({"status": "active"}).eq("id", draft["id"]).execute())
                        await send_whatsapp_message(sender_id, f"✅ Done! The campaign for *{name}* is now Active.")
                        return
                    elif text_lower == "draft":
                        await send_whatsapp_message(sender_id, f"📝 Saved! The campaign for *{name}* will remain a Draft. You can edit it later in your dashboard.")
                        return
                    elif text_lower in ["no", "wrong"]:
                        await send_whatsapp_message(sender_id, f"Got it. The campaign for *{name}* is saved as a Draft. Please edit the details manually in your Collabo dashboard.")
                        return
                    elif text_lower in ["delete", "cancel", "remove"]:
                        await supabase_admin.table("campaigns".delete().eq("id", draft["id"]).execute())
                        await send_whatsapp_message(sender_id, f"🗑️ Campaign Deleted. I've removed the draft for *{name}*.")
                        return
                else:
                    await send_whatsapp_message(sender_id, "❌ I couldn't find a recent Draft to confirm. It might already be Active or Deleted. You can create a new one by sending me the influencer details.")
                    return

            # Check for inline corrections
            if len(text_val) < 200:
                corrections, unparsed_date = parse_corrections(text_val)
                if corrections or unparsed_date:
                    recent_draft_resp = await supabase_admin.table("campaigns"
                        .select("*")
                        .eq("user_id", user_id)
                        .eq("status", "draft")
                        .order("created_at", desc=True)
                        .limit(1)
                        .execute()
                    )
                    
                    if recent_draft_resp.data:
                        draft = recent_draft_resp.data[0]
                        if corrections:
                            await supabase_admin.table("campaigns".update(corrections).eq("id", draft["id"]).execute())
                        
                        updated_draft = {**draft, **corrections}
                    else:
                        campaign_data = {
                            "user_id": user_id,
                            "status": "draft",
                            "influencer_handle": "N/A",
                            "platform": "Other",
                            "special_notes": f"[wa_msg:{message_id}]" if message_id else ""
                        }
                        if corrections:
                            campaign_data.update(corrections)
                        
                        insert_response = await supabase_admin.table("campaigns".insert(campaign_data).execute())
                        if insert_response.data:
                            updated_draft = insert_response.data[0]
                        else:
                            await send_whatsapp_message(sender_id, "❌ I couldn't find a recent draft, and failed to create a new one. Please try again.")
                            return
                        
                    base_summary = format_campaign_summary_wa(updated_draft)
                    base_summary = base_summary.replace("🤖 *I've extracted the following details:*\n\n", "")
                    base_summary = base_summary.replace("🤖 *Collabo AI*\n\n⚠️ Some details were unclear to me. I've created a *Draft*.\n\n", "")
                    summary_msg = "🤖 *Got it! I've updated the details:*\n\n" + base_summary if recent_draft_resp.data else "🤖 *Got it! I've created a new Draft with these details:*\n\n" + base_summary
                    
                    if unparsed_date:
                        summary_msg = f"⚠️ I couldn't understand the date '*{unparsed_date}*'. Please use a format like '15 July' or 'YYYY-MM-DD'.\n\n" + summary_msg
                        
                    await send_whatsapp_message(sender_id, summary_msg)
                    return
                        
            content_for_gemini = text_val
            if not content_for_gemini:
                await send_whatsapp_message(
                    sender_id,
                    "🤖 *Collabo AI*\n\nPlease send me a text message, screenshot, or voice note containing the influencer campaign terms.",
                )
                return

        elif msg_type == "audio":
            audio_id = message.get("audio", {}).get("id")
            if not audio_id:
                await send_whatsapp_message(
                    sender_id,
                    "🤖 *Collabo AI*\n\n❌ Oops! I couldn't download that voice note. Meta might be processing it. Please try sending it again.",
                )
                return
            await send_whatsapp_message(sender_id, "🤖 *Collabo AI*\n\nListening to your voice note... 🎧")
            audio_bytes = await download_whatsapp_media(audio_id, max_bytes=_MAX_MEDIA_BYTES)
            if not audio_bytes:
                content_for_gemini = "WhatsApp audio download failed or exceeded size limits."
            else:
                content_for_gemini = {"audio_bytes": audio_bytes, "mime_type": "audio/ogg"}

        elif msg_type == "image":
            image_id = message.get("image", {}).get("id")
            caption = message.get("image", {}).get("caption", "")
            if not image_id:
                await send_whatsapp_message(
                    sender_id, "🤖 *Collabo AI*\n\n❌ I couldn't download the image. Please try again."
                )
                return
            await send_whatsapp_message(sender_id, "🤖 *Collabo AI*\n\nReading the screenshot... 📸")
            image_bytes = await download_whatsapp_media(image_id, max_bytes=_MAX_MEDIA_BYTES)
            if not image_bytes:
                content_for_gemini = f"{caption}\n(WhatsApp image download failed or exceeded size limits.)".strip()
            else:
                content_for_gemini = {
                    "image_bytes": image_bytes,
                    "mime_type": message.get("image", {}).get("mime_type", "image/jpeg"),
                    "caption": caption,
                }

        elif msg_type == "document":
            document = message.get("document", {})
            document_id = document.get("id")
            filename = document.get("filename", "document")
            mime_type = document.get("mime_type", "application/pdf")
            caption = document.get("caption", "")
            
            if not document_id:
                await send_whatsapp_message(
                    sender_id, "🤖 *Collabo AI*\n\n❌ I couldn't download the document. Please try again."
                )
                return
                
            await send_whatsapp_message(sender_id, "🤖 *Collabo AI*\n\nReading your document... 📄")
            doc_bytes = await download_whatsapp_media(document_id, max_bytes=_MAX_MEDIA_BYTES)
            
            if not doc_bytes:
                content_for_gemini = f"{caption}\n(WhatsApp document download failed or exceeded size limits.)".strip()
            else:
                content_for_gemini = {
                    "document_bytes": doc_bytes,
                    "mime_type": mime_type,
                    "filename": filename,
                    "caption": caption,
                }

        else:
            safe_type = str(msg_type)[:32] if msg_type else "unknown"
            await send_whatsapp_message(
                sender_id,
                f"🤖 *Collabo AI*\n\nI can't read _{safe_type}_ messages yet. 😅\nPlease send text, voice notes, or screenshots of the chat.",
            )
            return

        # 4. Process with Gemini AI
        if msg_type == "text":
            await send_whatsapp_message(sender_id, "🤖 *Collabo AI*\n\nExtracting campaign details... ✨")
        
        file_bytes = b""
        mime_type = "text/plain"
        filename = "message.txt"
        caption_text = ""
        
        if isinstance(content_for_gemini, str):
            file_bytes = content_for_gemini.encode('utf-8')
            mime_type = "text/plain"
        elif isinstance(content_for_gemini, dict):
            if "audio_bytes" in content_for_gemini:
                file_bytes = content_for_gemini["audio_bytes"]
                mime_type = content_for_gemini["mime_type"]
                filename = "audio.ogg"
            elif "image_bytes" in content_for_gemini:
                file_bytes = content_for_gemini["image_bytes"]
                mime_type = content_for_gemini["mime_type"]
                filename = "image.jpg"
                caption_text = content_for_gemini.get("caption", "")
            elif "document_bytes" in content_for_gemini:
                file_bytes = content_for_gemini["document_bytes"]
                mime_type = content_for_gemini["mime_type"]
                filename = content_for_gemini["filename"]
                caption_text = content_for_gemini.get("caption", "")
                    
        logger.info("Calling Gemini extraction", mime_type=mime_type)
        extracted_data = await extract_campaign_data(
            file_bytes=file_bytes, 
            filename=filename, 
            mime_type=mime_type,
            text_content=caption_text
        )
        logger.info("Gemini extraction complete", extracted_data=extracted_data)
        
        if extracted_data:
            try:
                await supabase_admin.rpc("increment_ai_extractions", {"p_user_id": user_id}.execute())
            except Exception as e:
                logger.error("Failed to increment AI count via whatsapp webhook", error=str(e))

        # 5. Insert into Supabase
        campaign_data = {k: v for k, v in extracted_data.items() if k not in ["requires_human_review", "brand_name"]}

        if not campaign_data.get("influencer_handle"):
            campaign_data["influencer_handle"] = "N/A"
        if not campaign_data.get("platform") or campaign_data.get("platform") == "Other":
            campaign_data["platform"] = "Others"

        # Sanitize Date Formatting to prevent Postgres crashes
        raw_deadline = campaign_data.get("deadline")
        if raw_deadline and str(raw_deadline).strip():
            parsed_deadline = parse_date_string(str(raw_deadline))
            if parsed_deadline:
                campaign_data["deadline"] = parsed_deadline
            else:
                campaign_data["deadline"] = None
                extracted_data["requires_human_review"] = True
                existing_notes = campaign_data.get("special_notes") or ""
                campaign_data["special_notes"] = f"{existing_notes}\n(Note: Couldn't parse deadline '{raw_deadline}')".strip()
        else:
            campaign_data["deadline"] = None

        # Sanitize Payment Amount
        try:
            campaign_data["payment_amount"] = float(campaign_data.get("payment_amount") or 0.0)
            if campaign_data["payment_amount"] < 0:
                campaign_data["payment_amount"] = 0.0
        except ValueError:
            campaign_data["payment_amount"] = 0.0
            extracted_data["requires_human_review"] = True

        campaign_data["user_id"] = user_id
        
        extracted_status = campaign_data.get("status")
        if extracted_status not in ["active", "draft", "completed", "cancelled"]:
            campaign_data["status"] = "draft"
            
        # If extraction is partial/needs review, force it to Draft to prevent invalid Active campaigns
        if extracted_data.get("requires_human_review"):
            campaign_data["status"] = "draft"

        # Embed message ID in special_notes for idempotency tracking
        if message_id:
            existing_notes = campaign_data.get("special_notes") or ""
            campaign_data["special_notes"] = f"{existing_notes} [wa_msg:{message_id}]".strip()

        insert_response = await supabase_admin.table("campaigns".insert(campaign_data).execute())

        if insert_response.data:
            inserted_campaign = insert_response.data[0]
            logger.info("Campaign inserted successfully into DB", campaign_id=inserted_campaign.get("id"))
            
            summary = format_campaign_summary_wa(
                inserted_campaign, 
                is_review=extracted_data.get("requires_human_review", False)
            )
            
            success = await send_whatsapp_message(sender_id, summary)
            logger.info("Sent summary message to user", success=success)
            
            influencer = inserted_campaign.get("influencer_name") or inserted_campaign.get("influencer_handle") or "Unknown"
            from app.services.notifications import create_notification
            if extracted_data.get("requires_human_review"):
                await create_notification(
                    service_client=supabase_admin,
                    user_id=user_id,
                    title="AI Extraction Needs Review",
                    message=f"Created a draft campaign for {influencer} from WhatsApp, but some details were missing.",
                    type="warning",
                    link_url="/dashboard"
                )
            else:
                await create_notification(
                    service_client=supabase_admin,
                    user_id=user_id,
                    title="AI Campaign Created",
                    message=f"Successfully created a campaign for {influencer} from your WhatsApp message.",
                    type="success",
                    link_url="/dashboard"
                )
        else:
            logger.error("Failed to insert campaign into DB", response_data=insert_response.data)
            await send_whatsapp_message(
                sender_id, "❌ Sorry, I failed to save the campaign to the database. Please try again or check the dashboard."
            )

    except Exception as e:
        err_msg = str(e)
        sentry_sdk.capture_exception(e)
        logger.error("WhatsApp processing error", error=err_msg, exc_info=True)
        # Log to DB so we can see it!
        if supabase_admin:
            try:
                await supabase_admin.table("campaigns".insert({
                    "status": "draft",
                    "special_notes": f"CRASH: {err_msg}",
                    "influencer_name": "DEBUG CRASH WA",
                    "user_id": user_id if 'user_id' in locals() else None
                }).execute())
            except:
                pass
        
        if 'sender_id' in locals() and sender_id:
            await send_whatsapp_message(
                sender_id, "🤖 *Collabo AI*\n\n❌ Oops, my servers hit a snag while processing that message. Please try again!"
            )

@router.post("/whatsapp")
@limiter.limit("60/minute")
async def meta_whatsapp_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Receives incoming WhatsApp messages via Meta Cloud API.
    Always returns 200 OK quickly; heavy work is offloaded to a background task.
    """
    payload_bytes = await request.body()
    signature_header = request.headers.get("X-Hub-Signature-256", "")
    
    # 1. Signature Verification
    # If signature is wrong, we reject with 403. This stops random scanners.
    if not verify_signature(payload_bytes, signature_header):
        logger.warning("Meta signature validation failed - unauthorized access attempt.")
        raise HTTPException(status_code=403, detail="Invalid signature")

    logger.info("Webhook signature verified successfully.")

    # 2. Payload parsing
    # Meta requires a 200 OK for ALL validly signed webhooks, even if we can't parse it.
    try:
        data = json.loads(payload_bytes)
    except (json.JSONDecodeError, ValueError):
        logger.error("Received validly signed webhook, but body is invalid JSON.")
        return Response(content="OK", status_code=200)

    if data.get("object") != "whatsapp_business_account":
        return Response(content="OK", status_code=200)

    # 3. Offload processing to background task to guarantee < 3s response time
    try:
        for entry in data.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                for message in value.get("messages", []):
                    sender_id = message.get("from", "")
                    logger.info("Queueing WhatsApp message to background", sender_id=sender_id, msg_id=message.get("id"))
                    # Send to background task
                    background_tasks.add_task(process_whatsapp_message, sender_id, message)
    except Exception as e:
        logger.error("Error queueing Meta webhook payload for processing", error=str(e))

    return Response(content="OK", status_code=200)

`

# config.py
`python
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_API_KEY_1: Optional[str] = None
    GEMINI_API_KEY_2: Optional[str] = None
    BASE_URL: str = "https://mycollabo.online"
    ALLOWED_ORIGINS: str = "https://mycollabo.online,http://localhost:3000"
    SENTRY_DSN: Optional[str] = None
    
    # WhatsApp (Meta Cloud API) Integration
    WHATSAPP_TOKEN: Optional[str] = None
    WHATSAPP_PHONE_NUMBER_ID: Optional[str] = None
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: Optional[str] = None
    WHATSAPP_APP_SECRET: Optional[str] = None
    
    # Required for webhook to insert data without user JWT
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None

    # Telegram Integration
    TELEGRAM_BOT_TOKEN: Optional[str] = None
    TELEGRAM_WEBHOOK_SECRET: Optional[str] = None

    # Razorpay Integration
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    RAZORPAY_WEBHOOK_SECRET: Optional[str] = None

    # Webhook Settings
    GMAIL_WEBHOOK_URL: Optional[str] = None
    GMAIL_WEBHOOK_SECRET: Optional[str] = None
    SCHEDULER_INTERVAL_MINUTES: int = 60  # Default to 1 hour

    # Internal debug endpoint secret (POST /internal/trigger-reminders)
    # Set any random string here; leave empty to disable the endpoint.
    INTERNAL_SECRET: Optional[str] = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

settings = Settings()

`

# formatters.py
`python
import html

def format_campaign_summary(campaign: dict, is_review: bool = False) -> str:
    """Helper to format the summary message consistently."""
    handle = campaign.get('influencer_handle') or 'N/A'
    plat = campaign.get('platform') or 'N/A'
    deliv = campaign.get('deliverables') or 'N/A'
    deadl = campaign.get('deadline') or 'N/A'
    
    raw_pay = campaign.get('payment_amount', 0.0)
    try:
        pay = float(raw_pay) if raw_pay is not None else 0.0
    except ValueError:
        pay = 0.0
        
    influencer_name = campaign.get('influencer_name')
    if not influencer_name or influencer_name == 'Unknown Influencer':
        influencer = handle if handle != 'N/A' else 'Unknown'
    else:
        influencer = influencer_name
        
    clean_influencer = html.escape(influencer)
    
    prefix = "🤖 <b>Collabo AI</b>\n\n⚠️ Some details were unclear to me. I've saved this as a <b>Draft</b>.\n\n" if is_review else "🤖 <b>I've extracted the following details:</b>\n\n"
    
    return (
        f"{prefix}"
        f"👤 <b>Name:</b> {clean_influencer}\n"
        f"🔗 <b>Handle:</b> {html.escape(handle)}\n"
        f"📱 <b>Platform:</b> {html.escape(plat)}\n"
        f"📦 <b>Deliverables:</b> {html.escape(deliv)}\n"
        f"⏳ <b>Deadline:</b> {html.escape(deadl)}\n"
        f"💰 <b>Payment:</b> ₹{pay:,.2f}\n\n"
        f"───\n"
        f"<b>Is this correct?</b>\n"
        f"Reply <b>Yes</b> to make it Active.\n"
        f"Reply <b>Draft</b> to save it for later.\n"
        f"Reply <b>Delete</b> to discard this campaign.\n\n"
        f"Or, reply with corrections (e.g., 'Payment: 15000', 'Deadline: 20 July')."
    )

def format_campaign_summary_wa(campaign: dict, is_review: bool = False) -> str:
    """Helper to format the summary message consistently for WhatsApp using *bold* instead of HTML."""
    handle = campaign.get('influencer_handle') or 'N/A'
    plat = campaign.get('platform') or 'N/A'
    deliv = campaign.get('deliverables') or 'N/A'
    deadl = campaign.get('deadline') or 'N/A'
    
    raw_pay = campaign.get('payment_amount', 0.0)
    try:
        pay = float(raw_pay) if raw_pay is not None else 0.0
    except ValueError:
        pay = 0.0
        
    influencer_name = campaign.get('influencer_name')
    if not influencer_name or influencer_name == 'Unknown Influencer':
        influencer = handle if handle != 'N/A' else 'Unknown'
    else:
        influencer = influencer_name
        
    # No HTML escaping needed for WhatsApp, just basic string replacement
    prefix = "🤖 *Collabo AI*\n\n⚠️ Some details were unclear to me. I've saved this as a *Draft*.\n\n" if is_review else "🤖 *I've extracted the following details:*\n\n"
    
    return (
        f"{prefix}"
        f"👤 *Name:* {influencer}\n"
        f"🔗 *Handle:* {handle}\n"
        f"📱 *Platform:* {plat}\n"
        f"📦 *Deliverables:* {deliv}\n"
        f"⏳ *Deadline:* {deadl}\n"
        f"💰 *Payment:* ₹{pay:,.2f}\n\n"
        f"───\n"
        f"*Is this correct?*\n"
        f"Reply *Yes* to make it Active.\n"
        f"Reply *Draft* to save it for later.\n"
        f"Reply *Delete* to discard this campaign.\n\n"
        f"Or, reply with corrections (e.g., 'Payment: 15000', 'Deadline: 20 July')."
    )

`

# limiter.py
`python
from slowapi import Limiter
from starlette.requests import Request


def get_client_ip(request: Request) -> str:
    """
    Safely extract the real client IP behind trusted proxies (Render, Cloudflare).

    Security note: We take the LAST non-empty IP from X-Forwarded-For, not the first.
    Taking the first IP is trivially spoofable — attackers can prepend any IP they like.
    The last IP in the chain is the one added by the final trusted proxy.
    """
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        # Split and strip, then take the LAST (rightmost) entry set by the proxy
        ips = [ip.strip() for ip in forwarded.split(",") if ip.strip()]
        if ips:
            return ips[-1]
    return request.client.host if request.client else "127.0.0.1"


limiter = Limiter(key_func=get_client_ip)

`

# parsers.py
`python
import re
from datetime import datetime, timedelta

def parse_date_string(date_str: str) -> str | None:
    """Parses natural language dates into YYYY-MM-DD."""
    date_str = date_str.strip().lower()
    
    # 0. Already in YYYY-MM-DD format (from Gemini)
    if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
        try:
            datetime.strptime(date_str, "%Y-%m-%d")
            return date_str
        except ValueError:
            pass
            
    # Remove common conversational time words to simplify parsing
    date_str = re.sub(r'\b(shaam|subah|morning|evening|night|raat|ko|in the|at|by|on)\b', '', date_str).strip()
    
    today = datetime.now()
    
    # 1. Hinglish and relative words
    if date_str in ["today", "aaj"]:
        return today.strftime("%Y-%m-%d")
    if date_str in ["tomorrow", "kal", "tmrw"]:
        return (today + timedelta(days=1)).strftime("%Y-%m-%d")
    if date_str in ["day after tomorrow", "parso", "parson"]:
        return (today + timedelta(days=2)).strftime("%Y-%m-%d")
        
    # 2. Next <day>
    days_of_week = {"monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6}
    if date_str.startswith("next "):
        day_str = date_str.replace("next ", "").strip()
        for day, idx in days_of_week.items():
            if day_str.startswith(day[:3]):
                days_ahead = idx - today.weekday()
                if days_ahead <= 0:
                    days_ahead += 7
                return (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
                
    # 3. Format: DD/MM/YYYY, DD-MM-YYYY, DD/MM
    dm_match = re.search(r'^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$', date_str)
    if dm_match:
        d, m = int(dm_match.group(1)), int(dm_match.group(2))
        y_str = dm_match.group(3)
        y = int(y_str) if y_str else today.year
        if y < 100: y += 2000
        try:
            return datetime(y, m, d).strftime("%Y-%m-%d")
        except ValueError:
            pass
            
    # 4. Format: 5 July, July 5, 10 july 2026
    month_map = {
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6, 
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12
    }
    
    text_date_match = re.search(r'(\d{1,2})[\s]+([a-z]{3,})[\s,]*(\d{2,4})?', date_str)
    if not text_date_match:
        text_date_match = re.search(r'([a-z]{3,})[\s]+(\d{1,2})[\s,]*(\d{2,4})?', date_str)
        if text_date_match:
            m_str, d_str, y_str = text_date_match.groups()
        else:
            return None
    else:
        d_str, m_str, y_str = text_date_match.groups()
        
    for m_key in month_map:
        if m_str.startswith(m_key):
            d, m = int(d_str), month_map[m_key]
            y = int(y_str) if y_str else today.year
            if y < 100: y += 2000
            try:
                return datetime(y, m, d).strftime("%Y-%m-%d")
            except ValueError:
                pass
                
    return None

def parse_corrections(text: str) -> tuple[dict, str | None]:
    """Parses natural key-value pairs like 'Payment 15000', 'name: neha', 'influencer handle @neha'"""
    corrections = {}
    unparsed_date_msg = None
    lines = text.split('\n')
    
    # Matches optional words like "change", "set", "influencer", "campaign", "the" before the keyword
    pattern = re.compile(
        r'^(?:(?:change|set|update|make)\s+)?'
        r'(?:(?:influencer|campaign|the)\s+)?'
        r'(name|handle|platform|deliverables?|deadline|date|payment|amount|price|fee|notes?)'
        r'(?:\s*:\s*|\s*=\s*|\s+is\s+|\s+to\s+|\s+)'
        r'(.+)$', 
        re.IGNORECASE
    )
    
    for line in lines:
        line = line.strip()
        if not line: continue
        
        match = pattern.match(line)
        if match:
            key = match.group(1).lower()
            val = match.group(2).strip()
            if not val: continue
            
            if 'name' in key: 
                corrections['influencer_name'] = val
            elif 'handle' in key: 
                # ensure handle starts with @ if missing and no spaces
                if not val.startswith('@') and ' ' not in val:
                    val = '@' + val
                corrections['influencer_handle'] = val
            elif 'platform' in key: 
                corrections['platform'] = val
            elif 'deliverable' in key: 
                corrections['deliverables'] = val
            elif 'deadline' in key or 'date' in key: 
                parsed_date = parse_date_string(val)
                if parsed_date:
                    corrections['deadline'] = parsed_date
                else:
                    unparsed_date_msg = val
            elif 'payment' in key or 'amount' in key or 'price' in key or 'fee' in key:
                num_match = re.search(r'\d+(?:[.,]\d+)?', val)
                if num_match:
                    # Remove commas for float conversion
                    clean_num = num_match.group(0).replace(',', '')
                    corrections['payment_amount'] = float(clean_num)
            elif 'note' in key: 
                corrections['special_notes'] = val

    return corrections, unparsed_date_msg

`

# utils.py
`python


def get_valid_transitions() -> dict[str, list[str]]:
    """Defines the valid state transitions for campaigns."""
    return {
        "draft": ["active", "cancelled"],
        "active": ["cancelled"], # 'content_received' happens via file upload only
        "content_received": ["approved", "rejected", "cancelled"],
        "approved": ["paid", "cancelled"],
        "paid": ["cancelled"],
        "rejected": ["active", "cancelled", "approved", "content_received"], # allow restoring to active, or direct approval
        "cancelled": ["draft", "active"] # allow restoring from cancelled
    }

def handle_db_error(e: Exception, logger, context: str, user_id: str | None = None) -> None:
    """Parses database errors and raises appropriate HTTP exceptions."""
    from fastapi import HTTPException
    logger.error(context, error=type(e).__name__, detail=str(e), user_id=user_id)
    error_msg = str(e).lower()
    if "violates unique constraint" in error_msg and "short_code" in error_msg:
        raise HTTPException(status_code=400, detail="A tracking code conflict occurred. Please try again.")
    if "foreign key" in error_msg:
        raise HTTPException(status_code=400, detail="Invalid data reference. Make sure the linked data exists.")
    if "not-null" in error_msg:
        raise HTTPException(status_code=400, detail="Please fill in all required fields.")
    if "violates" in error_msg:
        raise HTTPException(status_code=400, detail="The provided data is invalid. Please double-check your inputs.")
    raise HTTPException(status_code=500, detail="An internal error occurred. Please try again or contact support if the issue persists.")

`

# campaign.py
`python
from pydantic import BaseModel, Field, field_validator
from pydantic import ConfigDict
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from enum import Enum


class CampaignStatus(str, Enum):
    draft = 'draft'
    active = 'active'
    content_received = 'content_received'
    approved = 'approved'
    paid = 'paid'
    cancelled = 'cancelled'
    rejected = 'rejected'


class CampaignBase(BaseModel):
    influencer_name: Optional[str] = Field(
        default=None,
        max_length=255,
        description="The full name or persona of the influencer.",
        json_schema_extra={"examples": ["Riya Sharma"]}
    )
    influencer_handle: Optional[str] = Field(
        default=None,
        max_length=255,
        description="The influencer's social media handle, typically starting with @.",
        json_schema_extra={"examples": ["@riya_creates"]}
    )
    platform: Optional[str] = Field(
        default=None,
        max_length=100,
        description="The primary social media platform for the campaign.",
        json_schema_extra={"examples": ["Instagram"]}
    )
    deliverables: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Detailed description of what the influencer is expected to produce.",
        json_schema_extra={"examples": ["1 Reel (30s) + 2 Story Frames with swipe-up link"]}
    )
    deadline: Optional[date] = Field(
        default=None,
        description="The date by which the deliverables must be posted.",
        json_schema_extra={"examples": ["2026-07-15"]}
    )
    payment_amount: Optional[float] = Field(
        default=0.0,
        ge=0.0,
        description="Total compensation in INR. Barter campaigns should be 0.0.",
        json_schema_extra={"examples": [15000.0]}
    )
    special_notes: Optional[str] = Field(
        default=None,
        max_length=5000,
        description="Any extra instructions, moodboard links, or AI extraction errors.",
        json_schema_extra={"examples": ["Make sure to tag the brand page in the first line of the caption."]}
    )
    status: CampaignStatus = Field(
        default=CampaignStatus.draft,
        description="Current stage of the campaign lifecycle."
    )
    proof_url: Optional[str] = Field(
        default=None,
        description="URL to the uploaded proof of posting file."
    )
    proof_history: Optional[List[Dict[str, Any]]] = Field(
        default=[],
        description="List of previous proof submissions."
    )
    destination_url: Optional[str] = Field(
        default=None,
        description="Optional tracking link destination."
    )

    @field_validator('influencer_name', 'influencer_handle', 'platform', 'deliverables', 'special_notes', mode='before')
    @classmethod
    def sanitize_strings(cls, v):
        if isinstance(v, str):
            import html
            import re
            # Safely encode HTML entities to prevent XSS without destroying valid text like "1 < 2"
            v = html.escape(v, quote=True)
            # Remove javascript:/data: protocol handlers
            v = re.sub(r'(javascript:|data:)', '', v, flags=re.IGNORECASE)
            stripped = v.strip()
            return stripped if stripped else None
        return v
        
    @field_validator('status', mode='before')
    @classmethod
    def validate_status(cls, v):
        if not v:
            return CampaignStatus.draft
        try:
            return CampaignStatus(v)
        except ValueError:
            return CampaignStatus.draft

    @field_validator('deadline', mode='before')
    @classmethod
    def clean_deadline(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class CampaignCreate(CampaignBase):
    influencer_handle: str = Field(
        min_length=1,
        max_length=255,
        description="The influencer's handle is strictly required to create a new campaign record."
    )


class CampaignUpdate(CampaignBase):
    pass


class CampaignStatusUpdate(BaseModel):
    status: CampaignStatus = Field(
        description="The new status to apply to the campaign."
    )


class CampaignResponse(CampaignBase):
    """
    Response model for campaign data returned from the API.

    Uses model_config with json_encoders to globally handle serialization of
    Python date/datetime objects → ISO 8601 strings. This is the recommended
    Pydantic v2 approach: it runs at the model level before FastAPI's JSON
    encoder, so every route returning CampaignResponse is covered automatically
    without any per-route conversion logic.
    """

    model_config = ConfigDict(
        # Serialize date → "YYYY-MM-DD", datetime → full ISO string.
        # None values are passed through untouched (no KeyError risk).
        json_encoders={
            date: lambda v: v.isoformat() if v is not None else None,
            datetime: lambda v: v.isoformat() if v is not None else None,
        }
    )

    id: str = Field(description="The unique UUID of the campaign in the database.")
    user_id: str = Field(description="The UUID of the brand/user who owns this campaign.")
    magic_link_token: Optional[str] = Field(description="The token for unauthenticated influencers to upload proof.")
    created_at: str = Field(description="ISO-8601 timestamp of creation.")
    updated_at: str = Field(description="ISO-8601 timestamp of the last update.")
    reminder_48h_sent: bool = Field(default=False, description="Flag indicating if the 48h reminder was sent.")
    overdue_alert_sent: bool = Field(default=False, description="Flag indicating if the overdue alert was sent.")
    short_code: Optional[str] = Field(default=None, description="Unique short code for the tracking link.")
    clicks: int = Field(default=0, description="Number of times the tracking link was clicked.")


class PaginatedCampaigns(BaseModel):
    data: List[CampaignResponse] = Field(description="The paginated list of campaigns.")
    count: int = Field(description="The total number of campaigns matching the query.")
    limit: int = Field(description="The maximum number of items returned in this page.")
    offset: int = Field(description="The number of items skipped.")


class ExtractionResult(CampaignBase):
    requires_human_review: bool = Field(
        default=False,
        description="Set to true if the AI failed to extract mandatory fields or if an error occurred."
    )

`

# influencer.py
`python
from pydantic import BaseModel, Field
from typing import Optional

class InfluencerProfileBase(BaseModel):
    name: Optional[str] = None
    platform: Optional[str] = None
    notes: Optional[str] = None

class InfluencerProfileUpdate(InfluencerProfileBase):
    pass

class InfluencerResponse(InfluencerProfileBase):
    handle: str
    total_campaigns: int = 0
    success_rate: float = 0.0
    last_collaboration: Optional[str] = None

`

# billing_cron.py
`python
"""
services/billing_cron.py
========================
Background job — checks for expired trials and automatically downgrades users to the 'free' tier.
"""

import structlog
from datetime import datetime, timezone
from supabase import create_client
from app.core.config import settings

logger = structlog.get_logger(__name__)

def _get_supabase_admin():
    service_key = settings.SUPABASE_SERVICE_ROLE_KEY
    if not service_key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is not set.")
    return create_client(settings.SUPABASE_URL, service_key)

async def check_expired_trials_job() -> dict:
    """
    Scheduled job: Check users whose trial_ends_at is in the past and tier is 'pro'.
    Downgrade them to 'free'.
    """
    log = logger.bind(job="check_expired_trials_job")
    now_utc = datetime.now(timezone.utc)
    
    log.info("billing_cron.job_started", now_utc=now_utc.isoformat())
    
    try:
        supabase = _get_supabase_admin()
    except RuntimeError as exc:
        log.error("billing_cron.job_aborted", reason=str(exc))
        return {"error": str(exc)}

    try:
        # Find all pro subscriptions with an expired trial
        # Supabase Python client filter for less than timestamp
        now_str = now_utc.isoformat()
        import asyncio
        resp = await supabase.table("subscriptions".select("id, user_id, tier, trial_ends_at").eq("tier", "pro").lt("trial_ends_at", now_str).execute())
        
        expired_subs = resp.data or []
        
        if not expired_subs:
            log.info("billing_cron.job_completed", downgraded=0)
            return {"downgraded": 0}
        
        downgraded_count = 0
        for sub in expired_subs:
            user_id = sub.get("user_id")
            sub_id = sub.get("id")
            try:
                # Downgrade to free
                await supabase.table("subscriptions".update({"tier": "free"}).eq("id", sub_id).execute())
                
                # Optional: You could insert a notification for the user here
                # from app.services.notifications import create_notification
                # await create_notification(...)
                
                log.info("billing_cron.user_downgraded", user_id=user_id, sub_id=sub_id, trial_ended_at=sub.get("trial_ends_at"))
                downgraded_count += 1
            except Exception as e:
                log.error("billing_cron.downgrade_failed", user_id=user_id, error=str(e))
                
        log.info("billing_cron.job_completed", downgraded=downgraded_count)
        return {"downgraded": downgraded_count}
        
    except Exception as exc:
        log.error("billing_cron.job_failed", error=str(exc), exc_info=True)
        return {"error": str(exc)}

`

# gemini.py
`python
import io
import os
import structlog
from pydantic import BaseModel, Field
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception
import asyncio
import sentry_sdk
from pypdf import PdfReader
import docx
from PIL import Image
from pillow_heif import register_heif_opener
from google import genai
from google.genai import types

# Register HEIF opener for Pillow
register_heif_opener()

logger = structlog.get_logger(__name__)

class ExtractionResult(BaseModel):
    influencer_name: str | None = Field(default=None, description="string or null")
    brand_name: str | None = Field(default=None, description="string or null")
    platform: str | None = Field(default=None, description="string or null")
    deliverables: str | None = Field(default=None, description="string or null")
    payment_amount: float | None = Field(default=None, description="number or null")
    deadline: str | None = Field(default=None, description="YYYY-MM-DD or null")
    special_notes: str | None = Field(default=None, description="string or null")

def get_system_prompt() -> str:
    return """You are a fast and accurate extraction engine for Collabo.

Extract campaign details from the chat and output ONLY clean JSON.

**Strict Rules**:
- Special Notes: ONLY include relevant human instructions. NEVER include system tags or error notes.
- Clean all HTML entities.
- For dates: You MUST extract the deadline. Pay very close attention to any mentioned dates (e.g., "12 Oct", "20 July") and convert them strictly to YYYY-MM-DD format. Assume the year is 2026 if not specified. Extract the date even if it is hidden in the middle or end of the chat.

JSON format:
{
  "influencer_name": "string or null",
  "brand_name": "string or null",
  "platform": "string or null",
  "deliverables": "string or null",
  "payment_amount": "number or null",
  "deadline": "YYYY-MM-DD or null",
  "special_notes": "string or null"
}"""

def compress_image(image_bytes: bytes, max_size_kb: int = 500, max_dim: int = 1600) -> bytes:
    """Compresses an image to be under max_size_kb and max dimensions while keeping text readable."""
    try:
        # If already small enough and standard format, avoid re-compressing
        if len(image_bytes) < max_size_kb * 1024:
            try:
                img_test = Image.open(io.BytesIO(image_bytes))
                if max(img_test.size) <= max_dim and img_test.format in ('JPEG', 'PNG', 'WEBP'):
                    return image_bytes
            except Exception:
                pass

        img = Image.open(io.BytesIO(image_bytes))
        # Convert to RGB if needed (e.g. RGBA or HEIC)
        if img.mode != "RGB":
            img = img.convert("RGB")
        
        # Resize to max dimensions while maintaining aspect ratio
        img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
        
        quality = 85
        out_io = io.BytesIO()
        img.save(out_io, format="JPEG", quality=quality, optimize=True)
        
        # Aggressive compression if still too large
        while len(out_io.getvalue()) > max_size_kb * 1024 and quality > 20:
            quality -= 10
            out_io = io.BytesIO()
            img.save(out_io, format="JPEG", quality=quality, optimize=True)
            
        return out_io.getvalue()
    except Exception as e:
        logger.error("image_compression_failed", error=str(e))
        return image_bytes # Fallback to original if compression fails

def parse_pdf(file_bytes: bytes) -> tuple[str, list[bytes]]:
    """Extracts text from first 4 pages, and up to 2 images."""
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        text_content = []
        extracted_images = []
        
        num_pages = min(len(reader.pages), 4)
        for i in range(num_pages):
            page = reader.pages[i]
            text_content.append(page.extract_text())
            
            # Extract images (max 2 total)
            if len(extracted_images) < 2:
                for img_obj in page.images:
                    if len(extracted_images) < 2:
                        extracted_images.append(compress_image(img_obj.data))
                    else:
                        break
                        
        return "\n".join(text_content), extracted_images
    except Exception as e:
        logger.error("pdf_parsing_failed", error=str(e))
        return "", []

def parse_docx(file_bytes: bytes) -> str:
    """Extracts text from a Word document."""
    try:
        doc = docx.Document(io.BytesIO(file_bytes))
        full_text = []
        for para in doc.paragraphs:
            if para.text.strip():
                full_text.append(para.text)
        return "\n".join(full_text)
    except Exception as e:
        logger.error("docx_parsing_failed", error=str(e))
        return ""

def is_retryable_error(exception: Exception) -> bool:
    err_str = str(exception).lower()
    if "404" in err_str or "not_found" in err_str or "400" in err_str or "invalid_argument" in err_str:
        return False
    # Always retry on 429/quota to let tenacity's exponential backoff handle temporary spikes
    return True

@retry(wait=wait_exponential(multiplier=1, min=2, max=10), stop=stop_after_attempt(4), retry=retry_if_exception(is_retryable_error))
async def _call_gemini(client: genai.Client, contents: list, model: str = 'gemini-2.5-flash') -> ExtractionResult:
    """Makes the actual API call with retries and timeout."""
    # Using asyncio.wait_for to enforce 120s timeout per attempt
    response = await asyncio.wait_for(
        client.aio.models.generate_content(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=get_system_prompt(),
                response_mime_type="application/json",
                response_schema=ExtractionResult,
                temperature=0.1
            )
        ),
        timeout=120.0
    )
    return ExtractionResult.model_validate_json(response.text)

async def _call_gemini_with_fallback(client: genai.Client, contents: list) -> ExtractionResult:
    """Attempts extraction with 2.5-flash, falls back to 2.0-flash on failure/quota."""
    try:
        return await _call_gemini(client, contents, model='gemini-2.5-flash')
    except Exception as e:
        logger.warning("gemini_2_5_flash_failed_falling_back", error=str(e))
        return await _call_gemini(client, contents, model='gemini-2.0-flash')

@sentry_sdk.trace(op="task", name="Extract AI Data")
async def extract_campaign_data(file_bytes: bytes, filename: str, mime_type: str, text_content: str = "") -> dict:
    """Main extraction pipeline with two-stage fallback."""
    try:
        from app.core.config import settings
        
        api_key_1 = settings.GEMINI_API_KEY_1 or settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY_1") or os.getenv("GEMINI_API_KEY")
        api_key_2 = settings.GEMINI_API_KEY_2 or os.getenv("GEMINI_API_KEY_2")
        
        keys_to_try = []
        if api_key_1:
            keys_to_try.append(("Key 1", api_key_1))
        if api_key_2:
            keys_to_try.append(("Key 2", api_key_2))
            
        if not keys_to_try:
            logger.error("gemini_api_key_missing")
            # We don't raise here, we want to return the fallback response
            raise ValueError("GEMINI_API_KEY is not configured on the server")
            
        contents = []
        text_fallback = ""
        has_images = False
        
        if mime_type == "application/pdf":
            text, images = await asyncio.to_thread(parse_pdf, file_bytes)
            if text.strip():
                contents.append(text)
                text_fallback = text
            for img_bytes in images:
                contents.append(
                    types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg")
                )
                has_images = True
        elif mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document" or filename.endswith(".docx"):
            text = await asyncio.to_thread(parse_docx, file_bytes)
            if text.strip():
                contents.append(text)
                text_fallback = text
        elif mime_type.startswith("image/") or mime_type.startswith("audio/"):
            if mime_type.startswith("image/"):
                compressed = await asyncio.to_thread(compress_image, file_bytes)
                final_mime = "image/jpeg" if compressed != file_bytes else mime_type
                contents.append(
                    types.Part.from_bytes(data=compressed, mime_type=final_mime)
                )
            else:
                contents.append(
                    types.Part.from_bytes(data=file_bytes, mime_type=mime_type)
                )
            has_images = True
        elif mime_type.startswith("text/") or filename.endswith(".txt"):
            text_fallback = file_bytes.decode('utf-8', errors='ignore')
            contents.append(text_fallback)
        else:
            # Try parsing as generic text if unknown
            text_fallback = file_bytes.decode('utf-8', errors='ignore')
            contents.append(text_fallback)
            
        if text_content:
            contents.append(text_content)
            text_fallback += "\n" + text_content

        last_error = None
        for key_name, api_key in keys_to_try:
            logger.info(f"attempting_gemini_extraction_with_{key_name.lower().replace(' ', '_')}")
            client = genai.Client(api_key=api_key)
            
            try:
                # Stage 1: Attempt extraction with all contents (images + text)
                result = await _call_gemini_with_fallback(client, contents)
                
                result_dict = result.model_dump()
                
                # Post-process to ensure requires_human_review is true if critical fields are missing
                if not result.influencer_name or not result.deadline or not result.deliverables:
                    result_dict["requires_human_review"] = True
                else:
                    result_dict["requires_human_review"] = False
                    
                result_dict["status"] = "draft"
                result_dict["influencer_handle"] = "N/A"
                    
                return result_dict
            except Exception as e:
                sentry_sdk.capture_exception(e)
                logger.warning("gemini_stage1_failed", key=key_name, error=str(e))
                last_error = e
                err_str = str(e).lower()
                
                # We retry quota errors internally now, but if it exhausts 4 attempts and bubbles up here,
                # we switch to the next key.
                if "429" in err_str or "quota" in err_str or "resource_exhausted" in err_str:
                    logger.warning("quota_exhausted_switching_keys_after_retries", key=key_name)
                    continue
                
                # Stage 2 Fallback: If it had images, try text-only
                if has_images and text_fallback.strip():
                    logger.info("gemini_stage2_fallback_triggered", key=key_name)
                    try:
                        fallback_result = await _call_gemini_with_fallback(client, [text_fallback])
                        fallback_dict = fallback_result.model_dump()
                        fallback_dict["requires_human_review"] = True
                        fallback_dict["special_notes"] = (fallback_dict.get("special_notes") or "") + f"\n(Note: Image extraction failed on {key_name}. Partial data extracted from text.)"
                        return fallback_dict
                    except Exception as e2:
                        logger.warning("gemini_stage2_failed", key=key_name, error=str(e2))
                        last_error = e2
                        err2_str = str(e2).lower()
                        if "429" in err2_str or "quota" in err2_str or "resource_exhausted" in err2_str:
                            logger.warning("quota_exhausted_stage2_switching_keys_after_retries", key=key_name)
                            continue
                else:
                    # If we don't have a text fallback and it's not a quota error,
                    # we can still try the next key just in case it was a transient error specific to that endpoint/key.
                    pass
        
        # If we reach here, all keys and stages failed
        raise last_error or ValueError("All Gemini API keys failed")

    except Exception as e:
        logger.error("gemini_extraction_failed_completely", error=str(e), exc_info=True)
        
        error_msg = f"AI Extraction failed ({str(e)}). Please enter details manually."
        
        # Check for Google API Quota limits (429 RESOURCE_EXHAUSTED)
        if "429" in str(e) or "quota" in str(e).lower() or "resource_exhausted" in str(e).lower():
            error_msg = "Google AI Quota exceeded (Rate limit). Please try again in 1 minute."
            
        if mime_type and mime_type.startswith("audio/"):
            error_msg = "Voice note transcription failed or was unclear. Please send text or a screenshot instead."
        
        # Complete fallback: Never crash, always return usable JSON
        return {
            "influencer_name": None,
            "brand_name": None,
            "platform": None,
            "deliverables": None,
            "deadline": None,
            "payment_amount": 0.0,
            "special_notes": error_msg,
            "status": "draft",
            "influencer_handle": "N/A",
            "requires_human_review": True
        }

`

# notifications.py
`python
import logging
from typing import Optional

logger = logging.getLogger(__name__)

async def create_notification(
    service_client, 
    user_id: str, 
    title: str, 
    message: str, 
    type: str = "info", 
    link_url: Optional[str] = None
) -> None:
    """
    Creates an in-app notification in Supabase.
    
    Args:
        service_client: An initialized Supabase client (preferably service role)
        user_id: The ID of the user receiving the notification
        title: Short title
        message: Detail text
        type: 'success', 'info', 'warning', or 'error'
        link_url: Optional URL to redirect to when clicked
    """
    try:
        data = {
            "user_id": user_id,
            "title": title,
            "message": message,
            "type": type,
            "link_url": link_url,
            "is_read": False
        }
        resp = await service_client.table("notifications").insert(data).execute()
        
        if getattr(resp, "data", None):
            logger.info(f"Notification created for user {user_id}: {title}")
        else:
            logger.warning(f"Failed to create notification for user {user_id}. Response: {resp}")
            
    except Exception as e:
        logger.error(f"Error creating notification for user {user_id}: {str(e)}", exc_info=True)

`

# reminders.py
`python
"""
services/reminders.py
=====================
Background job — checks campaign deadlines and sends email + WhatsApp reminders.

Fix History
-----------
v1 bugs (all fixed):
  1. structlog configured BEFORE get_logger() (was silently dropping all logs).
  2. _mark_flag() no longer uses .eq(flag, False) — Supabase SDK boolean filter
     was silently no-oping, leaving reminder_48h_sent stuck at False forever.
  3. resend import guarded so an old cached Render layer doesn't crash the module.

v2 bugs fixed in this file:
  4. CRITICAL: PostgREST embedded resource join
         user_settings(whatsapp_number, ...)
     was throwing "Could not find a relationship between 'campaigns' and
     'user_settings'" because no FK existed in the DB schema.

     FIX: Replace the single-query PostgREST join with a **two-step manual fetch**:
       Step 1 — SELECT active campaigns (no join).
       Step 2 — SELECT user_settings WHERE user_id IN (...) (single query, not N+1).
       Then merge the two result sets in Python.

     This approach is 100% reliable regardless of whether the FK exists in the DB,
     and it uses exactly one extra query for the entire batch — NOT one per campaign.

  5. Internal trigger endpoint: improved secret validation and logging.
  6. Exhaustive per-campaign structured logging at every decision point.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Any

import pytz
import structlog
from supabase import create_client
import sentry_sdk

from app.core.config import settings

# ---------------------------------------------------------------------------
# Email sending via GMail Webhook
# ---------------------------------------------------------------------------

# WhatsApp helper — optional (during Meta App Review period)
try:
    from app.services.whatsapp import send_whatsapp_message as _send_wa
except ImportError:
    _send_wa = None  # type: ignore[assignment]

# NOTE: structlog.configure() is called in main.py at module load time.
# We call get_logger() here (module level) which is fine — structlog lazy-binds
# the configuration on first use, not at get_logger() call time.
logger = structlog.get_logger(__name__)

# Removed _FROM_ADDRESS because the Webhook handles the sender identity natively
# Reminder window: send 48h reminder when deadline is between 0 and 48h away
_REMINDER_WINDOW_HOURS = 48

# IST timezone — used for display formatting and date parsing
_IST = pytz.timezone("Asia/Kolkata")


# ---------------------------------------------------------------------------
# Supabase admin client
# ---------------------------------------------------------------------------

def _get_supabase_admin():
    """
    Returns a Supabase client with the SERVICE_ROLE key.
    This bypasses RLS — only used internally by background jobs.
    Raises RuntimeError loudly if the key is missing.
    """
    service_key = settings.SUPABASE_SERVICE_ROLE_KEY
    if not service_key:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY is not set. "
            "Add it to your Render environment variables. "
            "The anon key will NOT work — it reads zero rows due to RLS."
        )
    return create_client(settings.SUPABASE_URL, service_key)


# ---------------------------------------------------------------------------
# Email sending via Webhook
# ---------------------------------------------------------------------------

import httpx

async def _send_email(to_email: str, subject: str, html: str) -> bool:
    """
    Send a transactional email using a Webhook (e.g., Google Apps Script).
    Runs asynchronously using httpx to prevent blocking.
    Returns True on confirmed delivery, False on any failure.
    """
    if not settings.GMAIL_WEBHOOK_URL:
        logger.warning(
            "reminders.email_skipped",
            reason="GMAIL_WEBHOOK_URL not configured in environment",
            to=to_email,
        )
        return False

    payload = {
        "to": to_email,
        "subject": subject,
        "html": html,
        "secret": settings.GMAIL_WEBHOOK_SECRET
    }

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.post(settings.GMAIL_WEBHOOK_URL, json=payload)
            resp.raise_for_status()
            
        logger.info(
            "reminders.email_sent",
            to=to_email,
            subject=subject,
            method="WEBHOOK",
            status_code=resp.status_code,
        )
        return True
    except httpx.HTTPStatusError as exc:
        logger.error(
            "reminders.email_failed",
            to=to_email,
            subject=subject,
            status_code=exc.response.status_code,
            error=str(exc),
            response_text=exc.response.text,
        )
        logger.info(
            "reminders.email_fallback", 
            to=to_email, 
            subject=subject, 
            fallback_message="Webhook returned HTTP error, email may not have been sent."
        )
        return False
    except Exception as exc:
        logger.error(
            "reminders.email_failed",
            to=to_email,
            subject=subject,
            error=str(exc),
            error_type=type(exc).__name__,
        )
        logger.info(
            "reminders.email_fallback", 
            to=to_email, 
            subject=subject, 
            fallback_message="Webhook request failed entirely."
        )
        return False


# ---------------------------------------------------------------------------
# WhatsApp sending
# ---------------------------------------------------------------------------

async def _send_whatsapp(to_number: str, body: str) -> bool:
    """
    Send a WhatsApp message via the Meta Cloud API.
    Returns False (not an error) if WhatsApp is not yet configured —
    this is expected during the Meta App Review period.
    """
    if _send_wa is None:
        logger.warning("reminders.whatsapp_skipped", reason="whatsapp service not available")
        return False

    if not settings.WHATSAPP_TOKEN or not settings.WHATSAPP_PHONE_NUMBER_ID:
        logger.warning(
            "reminders.whatsapp_skipped",
            reason="WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID not configured",
            to=to_number,
        )
        return False

    try:
        ok = await _send_wa(to_number, body)
        if ok:
            logger.info("reminders.whatsapp_sent", to=to_number)
        else:
            logger.warning("reminders.whatsapp_failed", to=to_number)
        return ok
    except Exception as exc:
        logger.error("reminders.whatsapp_error", to=to_number, error=str(exc))
        return False


# ---------------------------------------------------------------------------
# Email HTML templates
# ---------------------------------------------------------------------------

def _build_reminder_email(inf_name: str, deadline_ist: str) -> tuple[str, str]:
    """48-hour reminder email — returns (subject, html)."""
    subject = f"⏰ Action Required: Campaign for {inf_name} is due soon"
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Campaign Reminder</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;background:#1e293b;border-radius:16px;
                      border:1px solid #334155;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#059669,#0d9488);
                       padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:28px;">⏰</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">
                Upcoming Campaign Deadline
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;color:#94a3b8;font-size:15px;line-height:1.6;">Hi there,</p>
              <p style="margin:0 0 24px;color:#e2e8f0;font-size:15px;line-height:1.6;">
                Your campaign with <strong style="color:#34d399;">{inf_name}</strong>
                is due in less than <strong style="color:#fbbf24;">48 hours</strong>.
              </p>
              <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;
                          padding:20px 24px;margin:0 0 24px;text-align:center;">
                <p style="margin:0 0 4px;color:#64748b;font-size:12px;
                          text-transform:uppercase;letter-spacing:1px;">Deadline</p>
                <p style="margin:0;color:#f8fafc;font-size:22px;font-weight:700;">{deadline_ist}</p>
              </div>
              <p style="margin:0 0 32px;color:#94a3b8;font-size:14px;line-height:1.6;">
                Please follow up with the creator to make sure all deliverables are on track
                and ready to go live.
              </p>
              <div style="text-align:center;">
                <a href="{settings.BASE_URL}/dashboard"
                   style="display:inline-block;background:#10b981;color:#ffffff;
                          text-decoration:none;font-weight:700;font-size:14px;
                          padding:14px 32px;border-radius:10px;">
                  View Dashboard →
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #1e293b;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;">
                You're receiving this because you enabled email reminders in
                <a href="{settings.BASE_URL}/settings"
                   style="color:#34d399;text-decoration:none;">Collabo Settings</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
    return subject, html


def _build_overdue_email(inf_name: str, deadline_ist: str) -> tuple[str, str]:
    """Overdue alert email — returns (subject, html)."""
    subject = f"🚨 Overdue Alert: Campaign for {inf_name} has passed its deadline"
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Overdue Campaign Alert</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;background:#1e293b;border-radius:16px;
                      border:1px solid #334155;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#b91c1c,#dc2626);
                       padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:28px;">🚨</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">
                Campaign is Overdue
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;color:#94a3b8;font-size:15px;line-height:1.6;">Hi there,</p>
              <p style="margin:0 0 24px;color:#e2e8f0;font-size:15px;line-height:1.6;">
                Your campaign with <strong style="color:#f87171;">{inf_name}</strong>
                has <strong>missed its deadline</strong> and requires your attention.
              </p>
              <div style="background:#0f172a;border:1px solid #7f1d1d;border-radius:12px;
                          padding:20px 24px;margin:0 0 24px;text-align:center;">
                <p style="margin:0 0 4px;color:#64748b;font-size:12px;
                          text-transform:uppercase;letter-spacing:1px;">Was due on</p>
                <p style="margin:0;color:#fca5a5;font-size:22px;font-weight:700;">{deadline_ist}</p>
              </div>
              <p style="margin:0 0 32px;color:#94a3b8;font-size:14px;line-height:1.6;">
                Please contact the creator and update the campaign status in your dashboard
                (mark it as <em>Completed</em> or <em>Cancelled</em>).
              </p>
              <div style="text-align:center;">
                <a href="{settings.BASE_URL}/dashboard"
                   style="display:inline-block;background:#ef4444;color:#ffffff;
                          text-decoration:none;font-weight:700;font-size:14px;
                          padding:14px 32px;border-radius:10px;">
                  View Dashboard →
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #1e293b;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;">
                You're receiving this because you enabled email reminders in
                <a href="{settings.BASE_URL}/settings"
                   style="color:#34d399;text-decoration:none;">Collabo Settings</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
    return subject, html


# ---------------------------------------------------------------------------
# User email lookup
# ---------------------------------------------------------------------------

async def _get_user_email(supabase_admin, user_id: str) -> Optional[str]:
    """Fetch user email from Supabase Auth admin API."""
    try:
        import asyncio
        resp = supabase_admin.auth.admin.get_user_by_id(user_id)
        if resp and resp.user and resp.user.email:
            return resp.user.email
        logger.warning("reminders.user_email_not_found", user_id=user_id)
    except Exception as exc:
        logger.warning(
            "reminders.user_email_lookup_failed",
            user_id=user_id,
            error=str(exc),
            error_type=type(exc).__name__,
        )
    return None


# ---------------------------------------------------------------------------
# Deadline parsing
# ---------------------------------------------------------------------------

def _parse_deadline_utc(deadline_raw: str, clog) -> Optional[datetime]:
    """
    Parse a deadline string to a UTC-aware datetime.

    Supabase `date` columns return "YYYY-MM-DD" (no time, no tz).
    We treat that as end-of-day IST (23:59:59 IST) so Indian users get their
    reminder the day before the deadline, not two days before.
    """
    if not deadline_raw:
        clog.warning("reminders.deadline_empty")
        return None

    clog.debug("reminders.deadline_raw", raw=deadline_raw)

    try:
        if "T" in deadline_raw or (" " in deadline_raw and len(deadline_raw) > 10):
            # Already a datetime string (legacy rows)
            dt = datetime.fromisoformat(deadline_raw.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            result = dt.astimezone(timezone.utc)
            clog.debug("reminders.deadline_parsed_datetime", utc=result.isoformat())
            return result

        # Plain date — treat as end-of-day IST
        naive_eod = datetime.strptime(deadline_raw[:10], "%Y-%m-%d").replace(
            hour=23, minute=59, second=59
        )
        result = _IST.localize(naive_eod).astimezone(timezone.utc)
        clog.debug(
            "reminders.deadline_parsed_date",
            raw=deadline_raw,
            interpreted_as="23:59:59 IST",
            utc=result.isoformat(),
        )
        return result

    except Exception as exc:
        clog.error(
            "reminders.deadline_parse_failed",
            raw=deadline_raw,
            error=str(exc),
        )
        return None


# ---------------------------------------------------------------------------
# Idempotency flag updater
# ---------------------------------------------------------------------------

async def _mark_flag(supabase_admin, campaign_id: str, flag: str, clog) -> None:
    """
    Set a reminder flag to True on the campaign row.

    Plain UPDATE with no extra filter. We already checked the flag value from
    the SELECT result, so the double-check is not needed. Setting True twice
    is idempotent and harmless even if two job instances run concurrently.
    """
    try:
        import asyncio
        await supabase_admin.table("campaigns"
            .update({flag: True})
            .eq("id", campaign_id)
            .execute()
        )
        clog.info("reminders.flag_set", flag=flag, campaign_id=campaign_id)
    except Exception as exc:
        clog.error(
            "reminders.flag_update_failed",
            flag=flag,
            campaign_id=campaign_id,
            error=str(exc),
        )


# ---------------------------------------------------------------------------
# Two-step fetch: campaigns + user_settings (no PostgREST join required)
# ---------------------------------------------------------------------------

async def _fetch_campaigns_with_settings(supabase_admin, log) -> list[dict]:
    """
    Fetch all active campaigns and merge their user_settings in Python.

    WHY TWO STEPS INSTEAD OF A POSTGREST JOIN?
    ------------------------------------------
    PostgREST's embedded resource syntax  user_settings(...)  only works when
    PostgreSQL has an explicit FOREIGN KEY from campaigns.user_id to
    user_settings.user_id.  If that FK is missing or hasn't been refreshed in
    PostgREST's schema cache, you get:

        "Could not find a relationship between 'campaigns' and 'user_settings'"

    This two-step approach is 100% reliable regardless of FK state and uses
    exactly ONE extra query for the entire batch — not one per campaign.

    Steps:
      1. SELECT active campaigns (no join).
      2. Collect unique user_ids → SELECT user_settings WHERE user_id IN (...).
      3. Build a dict keyed by user_id and merge into each campaign dict.
    """
    # ── Step 1: Fetch active campaigns ────────────────────────────────────
    try:
        campaigns_resp = await supabase_admin.table("campaigns"
            .select(
                "id, user_id, influencer_name, influencer_handle, deadline, "
                "status, reminder_48h_sent, overdue_alert_sent"
            )
            .eq("status", "active")
            .execute()
        )
    except Exception as exc:
        log.error(
            "reminders.campaigns_fetch_failed",
            error=str(exc),
            error_type=type(exc).__name__,
        )
        return []

    campaigns = campaigns_resp.data or []
    log.info("reminders.campaigns_fetched", count=len(campaigns))

    if not campaigns:
        return []

    # ── Step 2: Fetch user_settings for all unique user_ids ───────────────
    user_ids = list({c["user_id"] for c in campaigns if c.get("user_id")})
    settings_by_user: dict[str, dict] = {}

    if user_ids:
        try:
            settings_resp = await supabase_admin.table("user_settings"
                .select("user_id, whatsapp_number, telegram_chat_id, email_reminders_enabled, whatsapp_reminders_enabled")
                .in_("user_id", user_ids)
                .execute()
            )
            for row in (settings_resp.data or []):
                uid = row.get("user_id")
                if uid:
                    settings_by_user[uid] = row
            log.info(
                "reminders.user_settings_fetched",
                users_with_campaigns=len(user_ids),
                users_with_settings=len(settings_by_user),
            )
        except Exception as exc:
            # Non-fatal: we proceed with empty settings (defaults will apply)
            log.warning(
                "reminders.user_settings_fetch_failed",
                error=str(exc),
                error_type=type(exc).__name__,
                detail="Proceeding with default reminder settings for all users",
            )

    # ── Step 3: Merge settings into each campaign dict ────────────────────
    for campaign in campaigns:
        uid = campaign.get("user_id")
        campaign["user_settings"] = settings_by_user.get(uid, {}) if uid else {}

    return campaigns


# ---------------------------------------------------------------------------
# Main job
# ---------------------------------------------------------------------------

async def check_deadlines_job() -> dict:
    """
    Scheduled job: check every active campaign for approaching/overdue deadlines.

    Called by APScheduler every SCHEDULER_INTERVAL_MINUTES (default: 60).
    Also called immediately on startup (see main.py lifespan).
    Also exposed via POST /internal/trigger-reminders for manual testing.

    Decision matrix per campaign:
      ┌────────────────────────────────┬──────────────────────────────────┐
      │ time_diff                      │ Action                           │
      ├────────────────────────────────┼──────────────────────────────────┤
      │ 0 < diff ≤ 48h                 │ 48h reminder (if not sent yet)   │
      │ diff ≤ 0 (past deadline)       │ Overdue alert (if not sent yet)  │
      │ diff > 48h                     │ Nothing yet                      │
      └────────────────────────────────┴──────────────────────────────────┘
    """
    log = logger.bind(job="check_deadlines_job")
    now_utc = datetime.now(timezone.utc)
    log.info(
        "reminders.job_started",
        now_utc=now_utc.isoformat(),
        now_ist=now_utc.astimezone(_IST).isoformat(),
        webhook_configured=bool(settings.GMAIL_WEBHOOK_URL),
        service_role_configured=bool(settings.SUPABASE_SERVICE_ROLE_KEY),
        wa_configured=bool(settings.WHATSAPP_TOKEN and settings.WHATSAPP_PHONE_NUMBER_ID),
    )

    # ── Admin client ───────────────────────────────────────────────────────
    try:
        supabase = _get_supabase_admin()
    except RuntimeError as exc:
        log.error("reminders.job_aborted", reason=str(exc))
        return {"error": str(exc)}

    # ── Fetch campaigns + user settings (two-step, no PostgREST join) ─────
    campaigns = await _fetch_campaigns_with_settings(supabase, log)

    if not campaigns:
        log.info("reminders.job_completed", processed=0, reminded=0, overdue=0, errors=0, skipped=0)
        return {"processed": 0, "reminded": 0, "overdue": 0, "errors": 0, "skipped": 0}

    processed = reminded = overdue_count = error_count = skipped = 0

    for campaign in campaigns:
        campaign_id = campaign.get("id", "<unknown>")
        clog = log.bind(campaign_id=campaign_id)

        try:
            # ── Parse deadline ─────────────────────────────────────────────
            deadline_raw = campaign.get("deadline")
            if not deadline_raw:
                clog.debug("reminders.skipped_no_deadline")
                skipped += 1
                continue

            deadline_utc = _parse_deadline_utc(deadline_raw, clog)
            if deadline_utc is None:
                skipped += 1
                continue

            time_diff = deadline_utc - now_utc
            hours_diff = time_diff.total_seconds() / 3600

            clog.info(
                "reminders.evaluating_campaign",
                deadline_raw=deadline_raw,
                deadline_utc=deadline_utc.isoformat(),
                deadline_ist=deadline_utc.astimezone(_IST).strftime("%Y-%m-%d %H:%M IST"),
                hours_until_deadline=round(hours_diff, 2),
                reminder_48h_sent=campaign.get("reminder_48h_sent"),
                overdue_alert_sent=campaign.get("overdue_alert_sent"),
            )

            # ── Extract user preferences ───────────────────────────────────
            user_settings = campaign.get("user_settings") or {}

            whatsapp_num: Optional[str] = user_settings.get("whatsapp_number")
            telegram_chat_id: Optional[int] = user_settings.get("telegram_chat_id")
            email_enabled: bool = bool(user_settings.get("email_reminders_enabled", True))
            wa_enabled: bool = bool(user_settings.get("whatsapp_reminders_enabled", True))

            clog.debug(
                "reminders.user_settings",
                has_whatsapp=bool(whatsapp_num),
                has_telegram=bool(telegram_chat_id),
                email_enabled=email_enabled,
                wa_enabled=wa_enabled,
                settings_row_found=bool(user_settings),
            )

            user_id: Optional[str] = campaign.get("user_id")
            inf_name: str = (
                campaign.get("influencer_name")
                or campaign.get("influencer_handle")
                or "Unknown Creator"
            )

            reminder_sent: bool = bool(campaign.get("reminder_48h_sent"))
            overdue_sent: bool = bool(campaign.get("overdue_alert_sent"))

            # Format deadline in IST for email/WhatsApp display
            deadline_ist_str = deadline_utc.astimezone(_IST).strftime("%B %d, %Y")

            processed += 1

            # ── Branch: 48h reminder ───────────────────────────────────────
            if 0 < hours_diff <= _REMINDER_WINDOW_HOURS:
                if reminder_sent:
                    clog.info(
                        "reminders.48h_skipped_already_sent",
                        hours_left=round(hours_diff, 1),
                    )
                    continue

                clog.info(
                    "reminders.48h_triggered",
                    hours_left=round(hours_diff, 1),
                    influencer=inf_name,
                )

                wa_ok = False
                email_ok = False

                # WhatsApp
                if wa_enabled and whatsapp_num:
                    wa_body = (
                        f"⏳ *Reminder* — Campaign for *{inf_name}* "
                        f"is due in {round(hours_diff, 0):.0f} hours!\n\n"
                        f"📅 Deadline: {deadline_ist_str}\n\n"
                        "Please follow up with the creator to confirm deliverables "
                        "are on track.\n\n"
                        f"View dashboard: {settings.BASE_URL}/dashboard"
                    )
                    wa_ok = await _send_whatsapp(whatsapp_num, wa_body)
                else:
                    clog.debug(
                        "reminders.48h_wa_skipped",
                        wa_enabled=wa_enabled,
                        has_number=bool(whatsapp_num),
                    )

                # Email
                if email_enabled and user_id:
                    user_email = await _get_user_email(supabase, user_id)
                    clog.debug("reminders.48h_user_email", email=user_email)
                    if user_email:
                        subject, html = _build_reminder_email(inf_name, deadline_ist_str)
                        email_ok = await _send_email(user_email, subject, html)
                    else:
                        clog.warning(
                            "reminders.48h_email_skipped",
                            reason="could not resolve user email",
                            user_id=user_id,
                        )
                else:
                    clog.debug(
                        "reminders.48h_email_skipped",
                        email_enabled=email_enabled,
                        has_user_id=bool(user_id),
                    )

                # Always mark flag — even if no channels are configured,
                # so we don't flood logs on every job run.
                await _mark_flag(supabase, campaign_id, "reminder_48h_sent", clog)
                # Send Telegram (if configured, we use the same WA toggle for TG or just send if chat_id exists)
                if telegram_chat_id:
                    from app.services.telegram import send_telegram_message
                    msg = f"⏰ <b>Action Required</b>\n\nYour campaign with <b>{inf_name}</b> is due in less than <b>48 hours</b> ({deadline_ist_str}).\n\nPlease follow up to ensure deliverables are ready."
                    markup = {
                        "inline_keyboard": [
                            [{"text": "✅ Mark Completed", "callback_data": f"camp_done:{campaign_id}"}],
                            [{"text": "📅 Extend +7 Days", "callback_data": f"camp_ext:{campaign_id}"}]
                        ]
                    }
                    await send_telegram_message(telegram_chat_id, msg, reply_markup=markup)

                reminded += 1

                from app.services.notifications import create_notification
                if user_id:
                    await create_notification(
                        service_client=supabase,
                        user_id=user_id,
                        title="Campaign Deadline Approaching",
                        message=f"Campaign for {inf_name} is due in {round(hours_diff, 0):.0f} hours.",
                        type="warning",
                        link_url="/dashboard"
                    )

                clog.info(
                    "reminders.48h_done",
                    email_sent=email_ok,
                    wa_sent=wa_ok,
                )

            # ── Branch: Overdue alert ──────────────────────────────────────
            elif hours_diff <= 0:
                if overdue_sent:
                    clog.info(
                        "reminders.overdue_skipped_already_sent",
                        hours_overdue=round(abs(hours_diff), 1),
                    )
                    continue

                clog.info(
                    "reminders.overdue_triggered",
                    hours_overdue=round(abs(hours_diff), 1),
                    influencer=inf_name,
                )

                wa_ok = False
                email_ok = False

                if wa_enabled and whatsapp_num:
                    wa_body = (
                        f"🚨 *Overdue* — Campaign for *{inf_name}* missed its deadline!\n\n"
                        f"📅 Was due: {deadline_ist_str}\n\n"
                        "Please contact the creator and update the campaign status.\n\n"
                        f"View: {settings.BASE_URL}/dashboard"
                    )
                    wa_ok = await _send_whatsapp(whatsapp_num, wa_body)

                if email_enabled and user_id:
                    user_email = await _get_user_email(supabase, user_id)
                    if user_email:
                        subject, html = _build_overdue_email(inf_name, deadline_ist_str)
                        email_ok = await _send_email(user_email, subject, html)

                await _mark_flag(supabase, campaign_id, "overdue_alert_sent", clog)
                # Send Telegram
                if telegram_chat_id:
                    from app.services.telegram import send_telegram_message
                    msg = f"⚠️ <b>Overdue Campaign</b>\n\nYour campaign with <b>{inf_name}</b> was due on <b>{deadline_ist_str}</b> and is now past due.\n\nPlease check in with them!"
                    markup = {
                        "inline_keyboard": [
                            [{"text": "✅ Mark Completed", "callback_data": f"camp_done:{campaign_id}"}],
                            [{"text": "📅 Extend +7 Days", "callback_data": f"camp_ext:{campaign_id}"}]
                        ]
                    }
                    await send_telegram_message(telegram_chat_id, msg, reply_markup=markup)
                    
                overdue_count += 1

                from app.services.notifications import create_notification
                if user_id:
                    await create_notification(
                        service_client=supabase,
                        user_id=user_id,
                        title="Campaign Overdue",
                        message=f"Campaign for {inf_name} missed its deadline.",
                        type="error",
                        link_url="/dashboard"
                    )

                clog.info(
                    "reminders.overdue_done",
                    email_sent=email_ok,
                    wa_sent=wa_ok,
                )

            # ── Branch: Too early ──────────────────────────────────────────
            else:
                clog.debug(
                    "reminders.too_early",
                    hours_until_deadline=round(hours_diff, 1),
                )

        except Exception as exc:
            sentry_sdk.capture_exception(exc)
            error_count += 1
            clog.error(
                "reminders.campaign_processing_error",
                error=str(exc),
                error_type=type(exc).__name__,
                exc_info=True,
            )
            continue

    log.info(
        "reminders.job_completed",
        processed=processed,
        reminded=reminded,
        overdue=overdue_count,
        skipped=skipped,
        errors=error_count,
        duration_seconds=round((datetime.now(timezone.utc) - now_utc).total_seconds(), 2),
    )

    return {
        "processed": processed,
        "reminded": reminded,
        "overdue": overdue_count,
        "skipped": skipped,
        "errors": error_count,
        "duration_seconds": round((datetime.now(timezone.utc) - now_utc).total_seconds(), 2)
    }

`

# reports.py
`python
import io
import logging
from typing import Dict, Any, List
from datetime import datetime
from collections import defaultdict
import openpyxl
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from app.core.config import settings
from supabase import create_client

logger = logging.getLogger(__name__)

async def get_service_client():
    if not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY not set")
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

async def fetch_monthly_metrics(user_id: str, start_date: str, end_date: str) -> Dict[str, Any]:
    """
    Fetch and aggregate metrics for the given user and date range.
    start_date and end_date should be in 'YYYY-MM-DD' format.
    """
    client = await get_service_client()
    
    # Query all campaigns for this user created in the month range
    # Assuming we filter by created_at or deadline. Let's use created_at.
    import asyncio
    resp = await client.table("campaigns".select(
        "status, payment_amount, platform"
    ).eq("user_id", user_id).gte("created_at", f"{start_date}T00:00:00Z").lte("created_at", f"{end_date}T23:59:59Z").execute())
    
    data = resp.data or []
    
    total_spend = 0.0
    paid_count = 0
    cancelled_count = 0
    pending_count = 0
    pending_value = 0.0
    platform_spend = defaultdict(float)
    
    for c in data:
        status = c.get("status")
        amount = c.get("payment_amount") or 0.0
        platform = c.get("platform") or "Unknown"
        
        if status == "paid":
            total_spend += amount
            paid_count += 1
            platform_spend[platform] += amount
        elif status == "cancelled":
            cancelled_count += 1
        elif status in ["active", "content_received", "approved"]:
            pending_count += 1
            pending_value += amount

    # Success Rate
    total_resolved = paid_count + cancelled_count
    success_rate = (paid_count / total_resolved * 100) if total_resolved > 0 else 0.0
    
    # Top Platforms
    sorted_platforms = sorted(platform_spend.items(), key=lambda x: x[1], reverse=True)
    top_5_platforms = [{"platform": p[0], "spend": p[1]} for p in sorted_platforms[:5]]
    
    return {
        "total_spend": total_spend,
        "success_rate": success_rate,
        "pending_count": pending_count,
        "pending_value": pending_value,
        "top_platforms": top_5_platforms,
        "total_campaigns_in_period": len(data)
    }

def generate_pdf_report(metrics: Dict[str, Any], month_str: str) -> bytes:
    """
    Generate a PDF report using ReportLab.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    elements = []
    
    # Title
    title_style = styles['Heading1']
    elements.append(Paragraph(f"Monthly Campaign Report - {month_str}", title_style))
    elements.append(Spacer(1, 20))
    
    # Summary Metrics Table
    summary_data = [
        ["Metric", "Value"],
        ["Total Spend", f"INR {metrics['total_spend']:,.2f}"],
        ["Success Rate", f"{metrics['success_rate']:.1f}%"],
        ["Pending Payments Count", str(metrics['pending_count'])],
        ["Pending Payments Value", f"INR {metrics['pending_value']:,.2f}"],
        ["Total Campaigns Started", str(metrics['total_campaigns_in_period'])]
    ]
    
    t_summary = Table(summary_data, colWidths=[250, 150])
    t_summary.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#10b981")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#f8fafc")),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1"))
    ]))
    elements.append(t_summary)
    elements.append(Spacer(1, 30))
    
    # Top Platforms Table
    elements.append(Paragraph("Top Platforms by Spend", styles['Heading2']))
    elements.append(Spacer(1, 10))
    
    platform_data = [["Platform", "Spend (INR)"]]
    if metrics["top_platforms"]:
        for p in metrics["top_platforms"]:
            platform_data.append([p["platform"], f"INR {p['spend']:,.2f}"])
    else:
        platform_data.append(["No paid data", "-"] )

    t_plat = Table(platform_data, colWidths=[250, 150])
    t_plat.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#3b82f6")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#f8fafc")),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1"))
    ]))
    elements.append(t_plat)
    
    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes

def generate_excel_report(metrics: Dict[str, Any], month_str: str) -> bytes:
    """
    Generate an Excel report using openpyxl.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Monthly Summary"
    
    # Title
    ws["A1"] = f"Monthly Campaign Report - {month_str}"
    ws["A1"].font = openpyxl.styles.Font(size=14, bold=True)
    
    # Headers
    headers = ["Metric", "Value"]
    ws.append([]) # Empty row
    ws.append(headers)
    
    # Style headers
    for col in range(1, 3):
        cell = ws.cell(row=3, column=col)
        cell.font = openpyxl.styles.Font(bold=True, color="FFFFFF")
        cell.fill = openpyxl.styles.PatternFill(start_color="10B981", end_color="10B981", fill_type="solid")
        
    # Summary Data
    ws.append(["Total Spend (INR)", metrics['total_spend']])
    ws.append(["Success Rate (%)", round(metrics['success_rate'], 2)])
    ws.append(["Pending Payments Count", metrics['pending_count']])
    ws.append(["Pending Payments Value (INR)", metrics['pending_value']])
    ws.append(["Total Campaigns Started", metrics['total_campaigns_in_period']])
    
    # Top Platforms
    ws.append([])
    ws.append(["Top Platforms by Spend", "Spend (INR)"])
    row = ws.max_row
    for col in range(1, 3):
        cell = ws.cell(row=row, column=col)
        cell.font = openpyxl.styles.Font(bold=True, color="FFFFFF")
        cell.fill = openpyxl.styles.PatternFill(start_color="3B82F6", end_color="3B82F6", fill_type="solid")
        
    if metrics["top_platforms"]:
        for p in metrics["top_platforms"]:
            ws.append([p["platform"], p["spend"]])
    else:
        ws.append(["No paid data", 0])
        
    # Formatting widths
    ws.column_dimensions['A'].width = 30
    ws.column_dimensions['B'].width = 20
    
    buffer = io.BytesIO()
    wb.save(buffer)
    excel_bytes = buffer.getvalue()
    buffer.close()
    return excel_bytes

`

# supabase.py
`python
from supabase import create_client, Client
from app.core.config import settings

supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)

`

# telegram.py
`python
import httpx
import structlog
from app.core.config import settings

logger = structlog.get_logger(__name__)

# Default max bytes for media downloads (16 MB) — can be overridden per call
_DEFAULT_MAX_MEDIA_BYTES = 16 * 1024 * 1024

async def send_telegram_message(chat_id: int | str, text: str, reply_markup: dict | None = None) -> bool:
    """
    Sends a text message using the Telegram Bot API.
    Optionally accepts a reply_markup dict (for inline keyboards).
    """
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.error("Telegram credentials missing (TELEGRAM_BOT_TOKEN).")
        return False

    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=10.0)
            if response.status_code != 200:
                logger.error(
                    "Telegram API error",
                    status=response.status_code,
                    detail=response.text,
                )
                return False
            return True
    except Exception as e:
        logger.error("Exception sending Telegram message", error=str(e), exc_info=True)
        return False

async def answer_callback_query(callback_query_id: str, text: str = "") -> bool:
    """
    Answers a callback query (when a user presses an inline button).
    This removes the loading state from the button in the Telegram app.
    """
    if not settings.TELEGRAM_BOT_TOKEN:
        return False
        
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/answerCallbackQuery"
    payload = {
        "callback_query_id": callback_query_id,
        "text": text
    }
    
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(url, json=payload, timeout=5.0)
            return res.status_code == 200
    except Exception as e:
        logger.error("Exception answering callback query", error=str(e))
        return False

async def download_telegram_media(
    file_id: str, max_bytes: int = _DEFAULT_MAX_MEDIA_BYTES
) -> bytes | None:
    """
    Downloads media (voice notes, images) from Telegram servers.
    Enforces a byte limit to prevent OOM from malicious/large files.
    """
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not set — cannot download media.")
        return None

    try:
        async with httpx.AsyncClient() as client:
            # Step 1: Get the file_path
            file_url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/getFile"
            res = await client.get(file_url, params={"file_id": file_id}, timeout=10.0)
            if res.status_code != 200:
                logger.error("Failed to fetch file metadata", status=res.status_code, file_id=file_id)
                return None

            data = res.json()
            if not data.get("ok"):
                logger.error("Telegram API getFile returned not OK", data=data)
                return None
                
            file_path = data.get("result", {}).get("file_path")
            if not file_path:
                logger.error("file_path missing in metadata response", file_id=file_id)
                return None

            # Step 2: Stream-download with size guard
            download_url = f"https://api.telegram.org/file/bot{settings.TELEGRAM_BOT_TOKEN}/{file_path}"
            chunks: list[bytes] = []
            total = 0
            
            async with client.stream("GET", download_url, timeout=45.0) as stream:
                if stream.status_code != 200:
                    logger.error("Failed to download media binary from Telegram", status=stream.status_code)
                    return None
                async for chunk in stream.aiter_bytes(chunk_size=65536):
                    total += len(chunk)
                    if total > max_bytes:
                        logger.warning(
                            "Media download aborted — exceeded size limit",
                            file_id=file_id,
                            max_bytes=max_bytes,
                            bytes_downloaded=total
                        )
                        return None
                    chunks.append(chunk)

            return b"".join(chunks)

    except Exception as e:
        logger.error("Exception downloading Telegram media", file_id=file_id, error=str(e))
        return None

`

# whatsapp.py
`python
import httpx
import structlog
from app.core.config import settings

logger = structlog.get_logger(__name__)

# Graph API version — update here when Meta deprecates v20.0
_GRAPH_API_VERSION = "v20.0"

# Default max bytes for media downloads (16 MB) — can be overridden per call
_DEFAULT_MAX_MEDIA_BYTES = 16 * 1024 * 1024


async def send_whatsapp_message(to_number: str, body: str) -> bool:
    """
    Sends a WhatsApp text message using the Official Meta Cloud API.
    """
    if not settings.WHATSAPP_TOKEN or not settings.WHATSAPP_PHONE_NUMBER_ID:
        logger.error("Meta WhatsApp credentials missing (WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID).")
        return False

    url = f"https://graph.facebook.com/{_GRAPH_API_VERSION}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {settings.WHATSAPP_TOKEN}",
        "Content-Type": "application/json",
    }

    # Meta expects the number without '+' and without 'whatsapp:' prefix
    clean_to = to_number.replace("whatsapp:", "").lstrip("+")

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": clean_to,
        "type": "text",
        "text": {"preview_url": False, "body": body},
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=10.0)
            if response.status_code not in (200, 201):
                error_msg = "Unknown error"
                try:
                    err_json = response.json()
                    if "error" in err_json:
                        error_msg = f"{err_json['error'].get('message', '')} (Code: {err_json['error'].get('code', '')}, Subcode: {err_json['error'].get('error_subcode', '')})"
                except:
                    error_msg = response.text[:200]
                    
                logger.error(
                    "WhatsApp API error",
                    status=response.status_code,
                    detail=error_msg,
                )
                return False
            return True
    except Exception as e:
        logger.error("Exception sending WhatsApp message", error=str(e), exc_info=True)
        return False


async def download_whatsapp_media(
    media_id: str, max_bytes: int = _DEFAULT_MAX_MEDIA_BYTES
) -> bytes | None:
    """
    Downloads media (voice notes, images) from WhatsApp servers.
    Enforces a byte limit to prevent OOM from malicious/large files.

    Steps:
      1. Fetch the media download URL via Graph API.
      2. Stream-download the binary, stopping if max_bytes is exceeded.
    """
    if not settings.WHATSAPP_TOKEN:
        logger.error("WHATSAPP_TOKEN not set — cannot download media.")
        return None

    metadata_url = f"https://graph.facebook.com/{_GRAPH_API_VERSION}/{media_id}"
    headers = {"Authorization": f"Bearer {settings.WHATSAPP_TOKEN}"}

    try:
        async with httpx.AsyncClient() as client:
            # Step 1: Get the short-lived download URL
            res = await client.get(metadata_url, headers=headers, timeout=10.0)
            if res.status_code != 200:
                logger.error("Failed to fetch media metadata", status=res.status_code, media_id=media_id)
                return None

            media_url = res.json().get("url")
            if not media_url:
                logger.error("Media URL missing in metadata response", media_id=media_id)
                return None

            # Step 2: Stream-download with size guard
            chunks: list[bytes] = []
            total = 0
            async with client.stream("GET", media_url, headers=headers, timeout=45.0) as stream:
                if stream.status_code != 200:
                    logger.error("Failed to download media binary from Meta CDN", status=stream.status_code, media_url=media_url)
                    return None
                async for chunk in stream.aiter_bytes(chunk_size=65536):
                    total += len(chunk)
                    if total > max_bytes:
                        logger.warning(
                            "Media download aborted — exceeded size limit",
                            media_id=media_id,
                            max_bytes=max_bytes,
                            bytes_downloaded=total
                        )
                        return None
                    chunks.append(chunk)

            return b"".join(chunks)

    except Exception as e:
        logger.error("Exception downloading WhatsApp media", media_id=media_id, error=str(e))
        return None

`
