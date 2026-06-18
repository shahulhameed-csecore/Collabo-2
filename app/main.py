import logging
import structlog
import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, HTMLResponse
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

@app.get("/health", tags=["Health"], description="Basic health check to ensure the API and configurations are loaded.")
async def health_check():
    return {"status": "healthy", "service": "InfluencerTrack", "environment": settings.ENVIRONMENT}

@app.get("/", tags=["Pages"], description="Temporary landing page for Meta verification", response_class=HTMLResponse)
async def landing_page():
    html_content = """<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Collabo - Micro-Influencer Campaigns</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        slate: {
                            800: '#1e293b',
                            900: '#0f172a',
                            950: '#020617',
                        },
                        emerald: {
                            400: '#34d399',
                            500: '#10b981',
                            600: '#059669',
                        }
                    }
                }
            }
        }
    </script>
    <style>
        body {
            background-color: #020617; /* slate-950 */
            color: #f8fafc;
        }
    </style>
</head>
<body class="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-slate-950 text-slate-50 font-sans selection:bg-emerald-500/30">
    <!-- Background effects -->
    <div class="absolute inset-0 z-0 pointer-events-none">
        <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl mix-blend-screen"></div>
        <div class="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-emerald-900/20 rounded-full blur-3xl mix-blend-screen"></div>
    </div>

    <!-- Content -->
    <div class="z-10 flex flex-col items-center text-center px-6 max-w-4xl mx-auto mt-[-5vh]">
        <!-- Geometric Logo -->
        <div class="mb-8 flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 shadow-2xl shadow-emerald-900/20">
            <svg viewBox="0 0 100 100" class="w-14 h-14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 15L85 35V75L50 95L15 75V35L50 15Z" stroke="#10b981" stroke-width="4" fill="url(#grad1)"/>
                <path d="M50 15V55M15 35L50 55M85 35L50 55" stroke="#10b981" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M50 55V95" stroke="#10b981" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                <defs>
                    <linearGradient id="grad1" x1="15" y1="15" x2="85" y2="95" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stop-color="#34d399" stop-opacity="0.2" />
                        <stop offset="100%" stop-color="#059669" stop-opacity="0.6" />
                    </linearGradient>
                </defs>
            </svg>
        </div>

        <h1 class="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-6 leading-tight">
            <span class="block mb-2">Collabo</span>
            <span class="block text-2xl md:text-3xl mt-4 font-normal text-slate-300">WhatsApp to Dashboard for<br/>Micro-Influencer Campaigns</span>
        </h1>
        
        <p class="mt-2 text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Manage your campaigns effortlessly. From WhatsApp conversations directly to your analytics dashboard.
        </p>

        <div class="flex flex-col sm:flex-row gap-4 sm:gap-6 w-full sm:w-auto">
            <a href="https://collabo-2.vercel.app" class="group relative inline-flex items-center justify-center px-8 py-3.5 text-base font-medium text-white bg-emerald-600 rounded-xl overflow-hidden transition-all duration-300 hover:bg-emerald-500 hover:scale-105 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 w-full sm:w-auto">
                <span class="relative z-10 font-semibold">Login to Dashboard</span>
            </a>
            
            <a href="https://collabo-2.vercel.app" class="group relative inline-flex items-center justify-center px-8 py-3.5 text-base font-medium text-slate-300 bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl overflow-hidden transition-all duration-300 hover:text-white hover:bg-slate-800 hover:border-slate-600 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-900 w-full sm:w-auto">
                <span class="relative z-10 font-semibold">Sign Up</span>
            </a>
        </div>
    </div>
    
    <!-- Footer -->
    <div class="absolute bottom-8 text-sm text-slate-500 text-center w-full">
        &copy; 2026 Collabo. All rights reserved.
    </div>
</body>
</html>"""
    return HTMLResponse(content=html_content)

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    from fastapi.responses import Response
    return Response(content=b"", media_type="image/x-icon")
