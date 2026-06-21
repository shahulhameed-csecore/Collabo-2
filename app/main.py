import logging
import structlog
import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api import extract, campaigns, auth, whatsapp, settings as settings_api
from app.core.config import settings
from app.core.limiter import limiter

from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.executors.asyncio import AsyncIOExecutor
from app.services.reminders import check_deadlines_job

# One async executor â€” runs jobs inside the existing event loop (no threads needed)
_executors = {"default": AsyncIOExecutor()}
scheduler = AsyncIOScheduler(executors=_executors)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan: start/stop the background deadline scheduler."""
    interval_minutes = settings.SCHEDULER_INTERVAL_MINUTES

    scheduler.add_job(
        check_deadlines_job,
        trigger="interval",
        minutes=interval_minutes,
        id="deadlines_job",
        replace_existing=True,
        # If the job was missed (e.g. server was down), allow it to run
        # up to 10 minutes late instead of being skipped entirely.
        misfire_grace_time=600,
        # If multiple runs stacked up (paused scheduler), execute only once.
        coalesce=True,
        # Spread runs across Â±30 s to avoid exact-hour thundering herd
        # on multi-worker Render plans.
        jitter=30,
    )
    scheduler.start()

    # Run immediately on startup so the first check is not delayed a full hour
    # (important after a deploy or server restart).
    import asyncio as _asyncio
    _asyncio.ensure_future(check_deadlines_job())

    logger.info(
        "scheduler_started",
        interval_minutes=interval_minutes,
        next_run=str(scheduler.get_job("deadlines_job").next_run_time),
    )

    yield

    scheduler.shutdown(wait=False)
    logger.info("scheduler_stopped")

# --- Sentry Setup ---
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        # 10% trace sampling in production keeps costs manageable.
        # Increase to 1.0 only during active debugging sessions.
        traces_sample_rate=0.1 if settings.ENVIRONMENT == "production" else 1.0,
        profiles_sample_rate=0.1 if settings.ENVIRONMENT == "production" else 1.0,
    )

# --- Structlog Setup ---
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
logger = structlog.get_logger(__name__)

# --- FastAPI Initialization with OpenAPI Metadata ---
app = FastAPI(
    title="InfluencerTrack API",
    description="""
    **InfluencerTrack Core API**
    
    This backend powers the InfluencerTrack SaaS, processing influencer campaign data from raw images using Google Gemini AI and managing lifecycle states.
    
    ### Key Features:
    * **AI Extraction:** Automagically parses screenshots using Gemini 3.5 Flash.
    * **Zero-Trust Security:** Every request is dynamically validated through Supabase RLS.
    * **Resilience:** Global rate-limiting, error fallbacks, and 5MB payload restrictions.
    """,
    version="1.0.0",
    contact={
        "name": "InfluencerTrack Support",
        "url": "https://influencertrack.io/support",
        "email": "support@influencertrack.io",
    },
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    # Lock to only the methods this API actually uses
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn.tailwindcss.com https://unpkg.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; img-src 'self' data: https://collabo-2.vercel.app;"
    return response

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("unhandled_exception", method=request.method, url=str(request.url), error=str(exc))
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please contact support."}
    )

app.include_router(extract.router)
app.include_router(campaigns.router)
app.include_router(auth.router)
app.include_router(whatsapp.router)
app.include_router(settings_api.router)

@app.get("/health", tags=["Health"], description="Basic health check to ensure the API and configurations are loaded.")
async def health_check():
    return {"status": "healthy", "service": "InfluencerTrack", "environment": settings.ENVIRONMENT}


@app.get(
    "/",
    tags=["Root"],
    description="Permanent redirect to the Collabo web app on Vercel.",
    include_in_schema=False,
)
async def root_redirect():
    """
    301 redirect: collabo-2.onrender.com â†’ collabo-2.vercel.app

    Using a permanent (301) redirect so browsers and search engines
    update their bookmarks/index and stop hitting the API server for
    the landing page on future visits.
    """
    return RedirectResponse(
        url="https://collabo-2.vercel.app",
        status_code=301,
    )


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    """Empty favicon to prevent 404s from browsers probing the API domain."""
    from fastapi.responses import Response
    return Response(content=b"", media_type="image/x-icon")

