import structlog
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from app.core.limiter import limiter
from fastapi import Request
from app.core.config import settings
from app.services.supabase import get_supabase_admin
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
        # Hardcoded bypass list
        if hostname.lower() in ("localhost", "127.0.0.1", "[::1]", "::1"):
            return False

        # Attempt to detect decimal, octal, or hex encoded IP addresses
        # socket.inet_aton natively understands these obfuscated formats (unlike ipaddress)
        try:
            # This converts '0x7f000001' or '2130706433' into '127.0.0.1'
            normalized_ip = socket.inet_ntoa(socket.inet_aton(hostname))
            ip = ipaddress.ip_address(normalized_ip)
            
            # Block private, loopback, link-local, and multicast
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast:
                return False
        except OSError:
            # It's a standard domain name (e.g. amazon.com)
            pass
        
        return True
    except Exception:
        return False

router = APIRouter(prefix="/t", tags=["Tracker"])

# Supabase admin client is initialized lazily via get_supabase_admin()

@router.get("/{short_code}", response_class=RedirectResponse)
@limiter.limit("60/minute")
async def track_link(request: Request, short_code: str):
    try:
        supabase_admin = await get_supabase_admin()
        # Fetch campaign by short_code
        response = await supabase_admin.table("campaigns").select("id, user_id, influencer_handle, influencer_name, destination_url, clicks").eq("short_code", short_code).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Tracking link not found")
            
        campaign_data = response.data[0]
        destination_url = campaign_data.get("destination_url")
        clicks = campaign_data.get("clicks", 0)
        
        if not destination_url:
            raise HTTPException(status_code=404, detail="Destination URL not found")
            
        # [FIX 1] Normalize and Validate Security FIRST
        if not destination_url.startswith(("http://", "https://")):
            destination_url = "https://" + destination_url
            
        if not is_safe_url(destination_url):
            logger.warning("tracker_blocked_unsafe_url", short_code=short_code, url=destination_url)
            raise HTTPException(status_code=400, detail="Invalid or unsafe destination URL.")
            
        # [FIX 2] Check for bots
        raw_ua = request.headers.get("User-Agent")
        is_bot = False
        
        # If there is no User-Agent at all, it's a script/scraper, not a browser.
        if not raw_ua:
            is_bot = True
            logger.info("tracker_bot_detected", short_code=short_code, reason="empty_user_agent")
        else:
            user_agent = raw_ua.lower()
            bot_keywords = [
                # Social Media Previews
                "bot", "crawler", "spider", "whatsapp", "telegram", "facebookexternalhit",
                "twitterbot", "linkedinbot", "slackbot", "discordbot", "skypeuripreview",
                # Search Engines & Ecosystems
                "applebot", "googlebot", "bingbot", "yandex", "duckduckbot", "baiduspider",
                # Programmatic / CLI
                "curl", "wget", "python-requests", "headless", "puppeteer"
            ]
            for keyword in bot_keywords:
                if keyword in user_agent:
                    is_bot = True
                    logger.info("tracker_bot_detected", short_code=short_code, keyword=keyword)
                    break
                
        if not is_bot:
            await supabase_admin.rpc("increment_campaign_clicks", {"p_short_code": short_code}).execute()

            # [FIX 3] Use Redis to prevent thundering herd notification spam on viral links
            if clicks == 0:
                from app.core.redis import get_redis
                redis_client = get_redis()
                lock_acquired = True
                
                if redis_client:
                    # Try to set a lock for 30 days. Only the first concurrent request succeeds.
                    lock_acquired = await redis_client.set(f"notif_first_click:{short_code}", "1", ex=2592000, nx=True)
                
                if lock_acquired:
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
                        
        return RedirectResponse(url=destination_url, status_code=302)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("tracker_redirect_failed", error=str(e), short_code=short_code)
        raise HTTPException(status_code=404, detail="Invalid tracking link")
