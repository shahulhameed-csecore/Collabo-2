from slowapi import Limiter
from starlette.requests import Request

def get_client_ip(request: Request) -> str:
    # Safely extract IP behind proxies like Render or Cloudflare
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

limiter = Limiter(key_func=get_client_ip)
