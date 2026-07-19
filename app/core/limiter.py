from slowapi import Limiter
from starlette.requests import Request
import time
from collections import defaultdict
from app.core.config import settings

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


# Initialize slowapi Limiter
# Use Redis if available to support multiple workers/instances
if settings.REDIS_URL:
    limiter = Limiter(key_func=get_client_ip, storage_uri=settings.REDIS_URL)
else:
    limiter = Limiter(key_func=get_client_ip)

# Simple fallback in-memory rate limiter for webhooks (sender_id)
# 20 requests per minute
_USER_RATE_LIMITS = defaultdict(list)
_RATE_LIMIT_WINDOW = 60
_RATE_LIMIT_MAX = 20

# We try to use Redis for webhook rate limiting if configured
_redis_client = None
if settings.REDIS_URL:
    try:
        import redis
        _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    except ImportError:
        pass
    except Exception as e:
        import structlog
        structlog.get_logger(__name__).warning("redis_connection_failed", error=str(e))

def is_webhook_rate_limited(sender_id: str) -> bool:
    if _redis_client:
        try:
            key = f"webhook_rate_limit:{sender_id}"
            now = int(time.time())
            pipeline = _redis_client.pipeline()
            pipeline.zremrangebyscore(key, 0, now - _RATE_LIMIT_WINDOW)
            pipeline.zcard(key)
            pipeline.zadd(key, {str(now): now})
            pipeline.expire(key, _RATE_LIMIT_WINDOW)
            results = pipeline.execute()
            
            # zcard result is at index 1
            current_requests = results[1]
            return current_requests >= _RATE_LIMIT_MAX
        except Exception as e:
            import structlog
            structlog.get_logger(__name__).error("redis_rate_limit_failed", error=str(e))
            # Fall through to memory limiter on failure
    
    # Fallback to in-memory rate limit
    now = time.time()
    times = _USER_RATE_LIMITS[sender_id]
    
    # Prune old
    times = [t for t in times if now - t < _RATE_LIMIT_WINDOW]
    
    if len(times) >= _RATE_LIMIT_MAX:
        _USER_RATE_LIMITS[sender_id] = times
        return True
        
    times.append(now)
    _USER_RATE_LIMITS[sender_id] = times
    return False
