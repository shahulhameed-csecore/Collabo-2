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
