import structlog
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from app.core.limiter import limiter
from fastapi import Request
from app.core.config import settings
from supabase import create_client, Client

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/t", tags=["Tracker"])

# Using the service role key to bypass RLS since this is a public unauthenticated route
supabase_admin: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

@router.get("/{short_code}", response_class=RedirectResponse)
@limiter.limit("60/minute")
async def track_link(request: Request, short_code: str):
    try:
        # Fetch campaign by short_code
        response = supabase_admin.table("campaigns").select("destination_url").eq("short_code", short_code).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Tracking link not found")
            
        destination_url = response.data[0].get("destination_url")
        
        if not destination_url:
            raise HTTPException(status_code=404, detail="Destination URL not found")
            
        # Call the RPC function to atomically increment clicks
        supabase_admin.rpc("increment_campaign_clicks", {"p_short_code": short_code}).execute()
        
        # Make sure the URL has http/https
        if not destination_url.startswith(("http://", "https://")):
            destination_url = "https://" + destination_url
            
        return RedirectResponse(url=destination_url, status_code=302)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("tracker_redirect_failed", error=str(e), short_code=short_code)
        raise HTTPException(status_code=404, detail="Invalid tracking link")
