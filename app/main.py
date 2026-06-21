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
from apscheduler.executors.asyncio import AsyncIOExecutor
from app.services.reminders import check_deadlines_job

# One async executor — runs jobs inside the existing event loop (no threads needed)
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
        # Spread runs across ±30 s to avoid exact-hour thundering herd
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

@app.get("/", tags=["Pages"], description="Temporary landing page for Meta verification", response_class=HTMLResponse)
async def landing_page():
    html_content = """<!DOCTYPE html>
<html lang="en" class="dark scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Collabo - Micro-Influencer Campaigns</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
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
</head>
<body class="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 overflow-x-hidden">
    <!-- Navbar -->
    <header class="fixed top-0 w-full z-50 border-b border-white/5 bg-[#020617]/80 backdrop-blur-md">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <a href="https://collabo-2.vercel.app" class="flex items-center gap-2 group">
          <img src="https://collabo-2.vercel.app/logo-full.png" alt="Collabo Logo" class="h-8 object-contain group-hover:opacity-90 transition-opacity" />
        </a>
        <div class="flex items-center gap-4">
          <a href="https://collabo-2.vercel.app/login" class="text-sm font-medium text-slate-300 hover:text-white transition-colors hidden sm:block">
            Log in
          </a>
          <a href="https://collabo-2.vercel.app/signup" class="inline-flex items-center justify-center rounded-xl font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 disabled:pointer-events-none bg-white text-slate-950 hover:bg-slate-200 h-9 px-4 text-xs shadow-sm">
            Try for Free
          </a>
        </div>
      </div>
    </header>

    <main>
      <!-- Hero Section -->
      <section class="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-emerald-500/20 rounded-full blur-[120px] pointer-events-none opacity-50 mix-blend-screen"></div>
        <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-8 shadow-sm">
            <i data-lucide="sparkles" class="w-4 h-4"></i>
            Built for Indian D2C Brands
          </div>
          <h1 class="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight mb-8 leading-[1.1]">
            Stop managing influencers <br class="hidden sm:block" />
            in <span class="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-600">WhatsApp chaos.</span>
          </h1>
          <p class="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Forward voice notes, negotiations, and deliverables to our AI bot. We instantly extract the data and track it in your campaign dashboard.
          </p>
          <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="https://collabo-2.vercel.app/signup" class="inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 bg-emerald-500 text-white hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] h-12 px-8">
              Try for Free
              <i data-lucide="arrow-right" class="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform"></i>
            </a>
            <a href="https://collabo-2.vercel.app/login" class="inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 bg-slate-900 border border-slate-700 text-slate-100 hover:bg-slate-800 hover:text-white h-12 px-8">
              Login to Dashboard
            </a>
          </div>
          <p class="mt-5 text-sm text-slate-500 flex items-center justify-center gap-2">
            <i data-lucide="shield" class="w-4 h-4"></i> No credit card required. Cancel anytime.
          </p>
        </div>

        <!-- Abstract Dashboard Mockup -->
        <div class="max-w-6xl mx-auto mt-20 px-4 sm:px-6 relative" style="perspective: 1000px">
          <div class="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent z-10 pointer-events-none"></div>
          <div class="relative rounded-2xl border border-slate-800 bg-slate-900/50 shadow-2xl overflow-hidden backdrop-blur-sm transform-gpu transition-all duration-1000 hover:rotate-x-0 hover:scale-100 opacity-90" style="transform-style: preserve-3d; transform: rotateX(12deg) scale(1.05)">
            <div class="h-10 border-b border-slate-800 flex items-center px-4 gap-2 bg-slate-950/50">
              <div class="w-3 h-3 rounded-full bg-rose-500"></div>
              <div class="w-3 h-3 rounded-full bg-amber-500"></div>
              <div class="w-3 h-3 rounded-full bg-emerald-500"></div>
            </div>
            <div class="p-6 grid grid-cols-12 gap-6 h-[400px]">
              <div class="col-span-3 space-y-4">
                <div class="h-8 w-3/4 bg-slate-800 rounded-lg animate-pulse"></div>
                <div class="h-4 w-full bg-slate-800/50 rounded animate-pulse"></div>
                <div class="h-4 w-5/6 bg-slate-800/50 rounded animate-pulse"></div>
                <div class="h-4 w-4/6 bg-slate-800/50 rounded animate-pulse"></div>
              </div>
              <div class="col-span-9 space-y-6">
                <div class="flex gap-4">
                  <div class="h-24 flex-1 bg-emerald-900/20 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                    <div class="text-emerald-400/50 font-mono text-sm">Active Campaigns</div>
                  </div>
                  <div class="h-24 flex-1 bg-slate-800/50 rounded-xl"></div>
                  <div class="h-24 flex-1 bg-slate-800/50 rounded-xl"></div>
                </div>
                <div class="h-full bg-slate-800/30 rounded-xl border border-slate-800"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Logos / Trust Signals -->
      <section class="border-y border-white/5 bg-slate-900/20 py-10">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p class="text-sm font-medium text-slate-500 uppercase tracking-widest mb-6">Trusted by fast-growing brands</p>
          <div class="flex flex-wrap justify-center items-center gap-10 sm:gap-16 opacity-50 grayscale">
             <span class="text-xl font-bold font-serif">Minimalist.</span>
             <span class="text-xl font-black italic">FITNESS+</span>
             <span class="text-xl font-bold tracking-tighter">GLOW</span>
             <span class="text-xl font-light tracking-widest">NATURE</span>
             <span class="text-xl font-bold">KetoInd</span>
          </div>
        </div>
      </section>

      <!-- How It Works -->
      <section class="py-24 relative overflow-hidden">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="text-center mb-20">
            <h2 class="text-3xl sm:text-4xl font-bold text-white mb-4">How Collabo Works</h2>
            <p class="text-slate-400 max-w-2xl mx-auto text-lg">From messy negotiations to perfectly structured campaigns in four simple steps.</p>
          </div>
          <div class="grid md:grid-cols-4 gap-6">
            <div class="group relative bg-slate-900 border border-slate-800 hover:border-emerald-500/30 rounded-2xl p-8 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-1">
              <div class="w-12 h-12 bg-slate-950 rounded-xl flex items-center justify-center mb-6 border border-slate-800 group-hover:border-emerald-500/50 transition-colors">
                <i data-lucide="message-square" class="w-6 h-6 text-emerald-400"></i>
              </div>
              <h3 class="text-lg font-bold text-white mb-3">1. Negotiate on WhatsApp</h3>
              <p class="text-slate-400 text-sm leading-relaxed">Chat with creators normally. Discuss deliverables, timelines, and budgets just like you always do.</p>
            </div>
            <div class="group relative bg-slate-900 border border-slate-800 hover:border-emerald-500/30 rounded-2xl p-8 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-1">
              <div class="w-12 h-12 bg-slate-950 rounded-xl flex items-center justify-center mb-6 border border-slate-800 group-hover:border-emerald-500/50 transition-colors">
                <i data-lucide="smartphone" class="w-6 h-6 text-emerald-400"></i>
              </div>
              <h3 class="text-lg font-bold text-white mb-3">2. Forward to Bot</h3>
              <p class="text-slate-400 text-sm leading-relaxed">Simply forward the voice note, image, or text to our official Collabo WhatsApp Bot.</p>
            </div>
            <div class="group relative bg-slate-900 border border-slate-800 hover:border-emerald-500/30 rounded-2xl p-8 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-1">
              <div class="w-12 h-12 bg-slate-950 rounded-xl flex items-center justify-center mb-6 border border-slate-800 group-hover:border-emerald-500/50 transition-colors">
                <i data-lucide="bot" class="w-6 h-6 text-emerald-400"></i>
              </div>
              <h3 class="text-lg font-bold text-white mb-3">3. AI Extracts Details</h3>
              <p class="text-slate-400 text-sm leading-relaxed">Our Gemini AI instantly reads the chat and extracts dates, costs, and content requirements.</p>
            </div>
            <div class="group relative bg-slate-900 border border-slate-800 hover:border-emerald-500/30 rounded-2xl p-8 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-1">
              <div class="w-12 h-12 bg-slate-950 rounded-xl flex items-center justify-center mb-6 border border-slate-800 group-hover:border-emerald-500/50 transition-colors">
                <i data-lucide="layout-dashboard" class="w-6 h-6 text-emerald-400"></i>
              </div>
              <h3 class="text-lg font-bold text-white mb-3">4. Track in Dashboard</h3>
              <p class="text-slate-400 text-sm leading-relaxed">Your campaign is magically drafted. Approve it, track deadlines, and get automated reminders.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Features / Benefits -->
      <section class="py-24 bg-slate-900/30 border-y border-white/5 relative">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 class="text-3xl sm:text-4xl font-bold text-white mb-6 leading-tight">Scale your influencer marketing, <span class="text-emerald-400">without the headcount.</span></h2>
              <p class="text-slate-400 text-lg mb-10">Collabo acts as your automated campaign manager, so you can focus on building relationships instead of updating spreadsheets.</p>
              <div class="space-y-8">
                <div class="flex gap-4 items-start">
                  <div class="mt-1 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20"><i data-lucide="check-circle" class="w-6 h-6 text-emerald-400"></i></div>
                  <div>
                    <h4 class="text-xl font-bold text-white mb-2">Never Miss a Deliverable</h4>
                    <p class="text-slate-400 leading-relaxed">Automated email and WhatsApp reminders ensure creators post on time. Get notified before a deadline is missed.</p>
                  </div>
                </div>
                <div class="flex gap-4 items-start">
                  <div class="mt-1 bg-blue-500/10 p-2 rounded-lg border border-blue-500/20"><i data-lucide="zap" class="w-6 h-6 text-blue-400"></i></div>
                  <div>
                    <h4 class="text-xl font-bold text-white mb-2">Save 10+ Hours a Week</h4>
                    <p class="text-slate-400 leading-relaxed">Stop manually updating Google Sheets. The AI bot logs data, tracks payments, and organizes deliverables for you.</p>
                  </div>
                </div>
                <div class="flex gap-4 items-start">
                  <div class="mt-1 bg-purple-500/10 p-2 rounded-lg border border-purple-500/20"><i data-lucide="shield" class="w-6 h-6 text-purple-400"></i></div>
                  <div>
                    <h4 class="text-xl font-bold text-white mb-2">Zero-Trust Security</h4>
                    <p class="text-slate-400 leading-relaxed">Your campaign data is encrypted via Supabase RLS. We don't train public AI models on your private negotiations.</p>
                  </div>
                </div>
              </div>
            </div>
            <div class="relative">
              <div class="absolute inset-0 bg-emerald-500/20 blur-[100px] rounded-full pointer-events-none"></div>
              <div class="relative bg-[#020617] border border-slate-800 rounded-3xl p-8 shadow-2xl">
                 <div class="space-y-6">
                    <div class="flex items-start gap-4">
                      <div class="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs shrink-0">CR</div>
                      <div class="bg-slate-800 rounded-2xl rounded-tl-sm p-4 text-sm text-slate-200 shadow-sm border border-slate-700">
                        "Hey! Yes, ₹15,000 works for 1 Reel and 2 Stories. Can post by Friday."
                      </div>
                    </div>
                    <div class="flex justify-center">
                      <div class="bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs px-4 py-2 rounded-full flex items-center gap-2 animate-pulse">
                         <i data-lucide="sparkles" class="w-3 h-3"></i> AI Extracting Details...
                      </div>
                    </div>
                    <div class="bg-slate-900 border border-emerald-500/50 rounded-xl p-5 shadow-[0_0_30px_rgba(16,185,129,0.15)] relative overflow-hidden">
                      <div class="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-2xl"></div>
                      <div class="flex justify-between items-center mb-4">
                        <span class="text-white font-bold">Campaign Drafted</span>
                        <span class="bg-emerald-500 text-white text-xs px-2 py-1 rounded font-semibold shadow-sm">Ready</span>
                      </div>
                      <div class="space-y-3 text-sm relative z-10">
                        <div class="flex justify-between border-b border-slate-800 pb-2">
                          <span class="text-slate-400">Deliverables</span>
                          <span class="text-white font-medium">1 Reel, 2 Stories</span>
                        </div>
                        <div class="flex justify-between border-b border-slate-800 pb-2">
                          <span class="text-slate-400">Budget</span>
                          <span class="text-emerald-400 font-medium">₹15,000</span>
                        </div>
                        <div class="flex justify-between pb-1">
                          <span class="text-slate-400">Deadline</span>
                          <span class="text-white font-medium">Friday</span>
                        </div>
                      </div>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- CTA Section -->
      <section class="py-24 relative overflow-hidden">
        <div class="absolute inset-0 bg-emerald-950/20"></div>
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-[400px] bg-emerald-500/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
          <h2 class="text-4xl sm:text-5xl font-extrabold text-white mb-6 tracking-tight">Ready to bring order to the chaos?</h2>
          <p class="text-xl text-emerald-100/70 mb-10 max-w-2xl mx-auto">
            Join hundreds of D2C brands automating their influencer marketing with Collabo.
          </p>
          <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="https://collabo-2.vercel.app/signup" class="inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 bg-emerald-500 text-white hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] h-12 px-8 scale-100 sm:scale-110 shadow-2xl shadow-emerald-500/20 group">
              Start Your Free Trial
              <i data-lucide="arrow-right" class="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform"></i>
            </a>
          </div>
          <p class="mt-8 text-sm text-slate-400">14-day free trial • ₹599/month after • Cancel anytime</p>
        </div>
      </section>
    </main>

    <!-- Footer -->
    <footer class="border-t border-white/5 bg-[#020617] py-12">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div class="flex items-center gap-2">
          <img src="https://collabo-2.vercel.app/logo-full.png" alt="Collabo Logo" class="h-6 object-contain grayscale opacity-50" />
        </div>
        <div class="flex gap-8 text-sm">
          <a href="https://collabo-2.vercel.app/privacy" class="text-slate-400 hover:text-emerald-400 transition-colors">Privacy Policy</a>
          <a href="https://collabo-2.vercel.app/terms" class="text-slate-400 hover:text-emerald-400 transition-colors">Terms of Service</a>
          <a href="mailto:support@collabo.app" class="text-slate-400 hover:text-emerald-400 transition-colors">Contact</a>
        </div>
        <p class="text-sm text-slate-600">
          © 2026 Collabo. All rights reserved.
        </p>
      </div>
    </footer>
    <script>
      lucide.createIcons();
    </script>
</body>
</html>"""
    return HTMLResponse(content=html_content)

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    from fastapi.responses import Response
    return Response(content=b"", media_type="image/x-icon")
