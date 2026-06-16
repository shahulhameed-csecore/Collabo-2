import logging
import structlog
import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api import extract, campaigns, auth, whatsapp, settings as settings_api
from app.core.config import settings
from app.core.limiter import limiter

from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.services.reminders import check_deadlines_job

scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start the scheduler
    interval_minutes = settings.SCHEDULER_INTERVAL_MINUTES
    scheduler.add_job(check_deadlines_job, 'interval', minutes=interval_minutes, id='deadlines_job', replace_existing=True)
    scheduler.start()
    logger.info(f"Background scheduler started with interval {interval_minutes} minutes.")
    
    yield
    
    # Shutdown: Stop the scheduler
    scheduler.shutdown()
    logger.info("Background scheduler stopped.")

# --- Sentry Setup ---
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        traces_sample_rate=1.0,
        profiles_sample_rate=1.0,
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
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net"
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

@app.get("/", tags=["Health"], description="Basic health check to ensure the API and configurations are loaded.")
async def health_check():
    return {"status": "healthy", "service": "InfluencerTrack", "environment": settings.ENVIRONMENT}

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    from fastapi.responses import Response
    return Response(content=b"", media_type="image/x-icon")
