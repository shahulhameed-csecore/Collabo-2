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
        response = supabase_admin.table("campaigns").select("id, user_id, influencer_handle, influencer_name, destination_url, clicks").eq("short_code", short_code).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Tracking link not found")
            
        campaign_data = response.data[0]
        destination_url = campaign_data.get("destination_url")
        clicks = campaign_data.get("clicks", 0)
        
        if not destination_url:
            raise HTTPException(status_code=404, detail="Destination URL not found")
            
        # Call the RPC function to atomically increment clicks
        supabase_admin.rpc("increment_campaign_clicks", {"p_short_code": short_code}).execute()

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
