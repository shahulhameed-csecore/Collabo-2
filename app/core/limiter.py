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

import time
from collections import defaultdict

# Simple in-memory rate limiter for webhooks (sender_id)
# 20 requests per minute
_USER_RATE_LIMITS = defaultdict(list)
_RATE_LIMIT_WINDOW = 60
_RATE_LIMIT_MAX = 20

def is_webhook_rate_limited(sender_id: str) -> bool:
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
