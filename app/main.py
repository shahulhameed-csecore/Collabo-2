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

# ─── Step 1: Configure structlog FIRST ────────────────────────────────────────
# This MUST happen before any module-level structlog.get_logger() call.
# Previously this was on line 73, after reminders.py was imported on line 17.
structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
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
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api import extract, campaigns, auth, whatsapp, settings as settings_api
from app.core.config import settings
from app.core.limiter import limiter

from contextlib import asynccontextmanager
import asyncio

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.executors.asyncio import AsyncIOExecutor

# reminders.py is now safe to import — structlog is already configured
from app.services.reminders import check_deadlines_job

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
    scheduler.start()

    # Fire immediately so the first check isn't delayed by a full hour after deploy.
    # create_task() is correct here — we're inside an async context with a
    # running event loop. ensure_future() also works but is slightly lower-level.
    asyncio.create_task(check_deadlines_job())

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
    * **AI Extraction:** Parses WhatsApp screenshots/voice notes using Gemini AI.
    * **Zero-Trust Security:** Every request validated through Supabase RLS.
    * **Automated Reminders:** Hourly deadline checker with email + WhatsApp alerts.
    """,
    version="1.0.0",
    contact={
        "name": "Collabo Support",
        "url": "https://collabo-2.vercel.app",
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
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "img-src 'self' data: https://collabo-2.vercel.app;"
    )
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
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


# ─── Routers ───────────────────────────────────────────────────────────────────
app.include_router(extract.router)
app.include_router(campaigns.router)
app.include_router(auth.router)
app.include_router(whatsapp.router)
app.include_router(settings_api.router)


# ─── Public routes ─────────────────────────────────────────────────────────────

@app.get(
    "/health",
    tags=["Health"],
    description="Liveness check — also shows scheduler status.",
)
async def health_check():
    job = scheduler.get_job("deadlines_job")
    return {
        "status": "healthy",
        "service": "Collabo",
        "environment": settings.ENVIRONMENT,
        "scheduler": {
            "running": scheduler.running,
            "next_reminder_check": str(job.next_run_time) if job else None,
        },
    }


@app.get("/", include_in_schema=False)
async def root_redirect():
    """301 permanent redirect: Render API domain → Vercel frontend."""
    return RedirectResponse(url="https://collabo-2.vercel.app", status_code=301)


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
    if provided != internal_secret:
        raise HTTPException(status_code=403, detail="Invalid secret.")

    logger.info("reminders.manual_trigger", source="POST /internal/trigger-reminders")
    asyncio.create_task(check_deadlines_job())
    return {"message": "Reminder job triggered. Check Render logs for results."}


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
