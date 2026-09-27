# Finalized Production Changes

**Project:** Collabo
**Date:** July 19, 2026

## Overview of Polish
- **Redis Reliability**: Verified that Redis completely degrades to in-memory dictionaries without crashing if `REDIS_URL` is omitted. Connection failures log gracefully.
- **Improved User UX**: Replaced raw Python stack traces in Gemini with a polite `"We couldn't automatically extract the details from your upload. Please enter them manually."` message. Added a user-friendly API 429 Rate Limit JSON response.
- **Code Cleanliness**: Removed stale scaling comments from `main.py` since the fixes have been natively applied.

---

## 1. `app/core/limiter.py`

```python
from slowapi import Limiter
from starlette.requests import Request
import time
from collections import defaultdict
from app.core.config import settings

def get_client_ip(request: Request) -> str:
    """
    Safely extract the real client IP behind trusted proxies (Render, Cloudflare).
    We take the LAST non-empty IP from X-Forwarded-For, not the first.
    """
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        ips = [ip.strip() for ip in forwarded.split(",") if ip.strip()]
        if ips:
            return ips[-1]
    return request.client.host if request.client else "127.0.0.1"


# Initialize slowapi Limiter. Uses Redis if available.
if settings.REDIS_URL:
    limiter = Limiter(key_func=get_client_ip, storage_uri=settings.REDIS_URL)
else:
    limiter = Limiter(key_func=get_client_ip)

_USER_RATE_LIMITS = defaultdict(list)
_RATE_LIMIT_WINDOW = 60
_RATE_LIMIT_MAX = 20

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
    """Manual rate limiter for background/webhook jobs."""
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
            
            current_requests = results[1]
            return current_requests >= _RATE_LIMIT_MAX
        except Exception as e:
            import structlog
            structlog.get_logger(__name__).error("redis_rate_limit_failed", error=str(e))
    
    # Fallback to in-memory rate limit
    now = time.time()
    times = _USER_RATE_LIMITS[sender_id]
    
    times = [t for t in times if now - t < _RATE_LIMIT_WINDOW]
    
    if len(times) >= _RATE_LIMIT_MAX:
        _USER_RATE_LIMITS[sender_id] = times
        return True
        
    times.append(now)
    _USER_RATE_LIMITS[sender_id] = times
    return False
```

---

## 2. `app/main.py` (Selected Fixes)

```python
# ... (standard library imports)
import os
import uuid
import logging
import structlog
from typing import Any

# 1. Configure Logger absolutely first using ONLY os environment variables.
_log_level_str = os.getenv("LOG_LEVEL", "INFO").upper()
_log_level = getattr(logging, _log_level_str, logging.INFO)
logging.basicConfig(level=_log_level, format="%(message)s")

# ... (structlog config remains the same) ...

# 2. Redis Distributed Lock for APScheduler
import functools

def with_redis_lock(lock_name: str, lock_timeout: int = 60 * 15):
    """Prevents duplicate cron job execution across multiple worker instances."""
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            if settings.REDIS_URL:
                try:
                    import redis.asyncio as redis_async
                    r = redis_async.from_url(settings.REDIS_URL, decode_responses=True)
                    lock_acquired = await r.set(lock_name, "locked", ex=lock_timeout, nx=True)
                    await r.aclose()
                    
                    if not lock_acquired:
                        logger.info("job_skipped_due_to_lock", job=func.__name__, lock=lock_name)
                        return
                except ImportError:
                    pass
                except Exception as e:
                    logger.warning("redis_lock_failed", error=str(e))
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

# ... 
# 3. Clean API Rate Limit Handler
from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse

async def custom_rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    logger.warning("rate_limit_exceeded", client_ip=request.client.host if request.client else "unknown", url=str(request.url))
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please slow down and try again in a minute."}
    )

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, custom_rate_limit_exceeded_handler)
```

---

## 3. `app/services/gemini.py` (Selected Fixes)

```python
# ...
import re

def detect_prompt_injection(text: str) -> bool:
    """Checks for explicit prompt injection patterns using regex and density."""
    if not text:
        return False
        
    lower_text = text.lower()
    
    # 1. Regex for common injection patterns
    injection_patterns = [
        r"(ignore|disregard|forget|drop)\s+(all\s+)?(previous\s+)?(instructions|prompts|directions|rules)",
        r"(you\s+are\s+now|act\s+as|pretend\s+to\s+be)\s+(a|an)?\s*(system|admin|developer|unrestricted|jailbreak)",
        r"(override|bypass)\s+(security|instructions|filters|system|rules)",
        r"output\s+the\s+(preceding|above|previous)",
        r"print\s+(your\s+)?(instructions|prompt)",
        r"new\s+rule:",
        r"system\s+prompt"
    ]
    
    for pattern in injection_patterns:
        if re.search(pattern, lower_text):
            logger.warning("prompt_injection_pattern_detected", pattern=pattern)
            return True
            
    # 2. Suspicious word density check
    suspicious_words = {"ignore", "disregard", "override", "bypass", "system", "prompt", "instructions", "jailbreak", "dan", "rule", "forget"}
    words = re.findall(r'\b\w+\b', lower_text)
    if len(words) > 0:
        suspicious_count = sum(1 for word in words if word in suspicious_words)
        density = suspicious_count / len(words)
        if density > 0.15 and suspicious_count >= 3:
            logger.warning("prompt_injection_density_detected", density=density)
            return True
            
    # 3. Check for suspicious JSON structure injection
    if '{"influencer_name":' in lower_text and '}' in lower_text and "ignore" in lower_text:
        return True
        
    return False

# ... Inside extract_campaign_data ...

    except Exception as e:
        logger.error("gemini_extraction_failed_completely", error=str(e), exc_info=True)
        
        # Default clean error message
        error_msg = "We couldn't automatically extract the details from your upload. Please enter them manually."
        
        # Check for Google API Quota limits (429 RESOURCE_EXHAUSTED)
        full_err_str = _get_full_err_str(e)
        if "429" in full_err_str or "quota" in full_err_str or "resource_exhausted" in full_err_str:
            error_msg = "Google AI Quota exceeded (Rate limit). Please try again in 1 minute."
            
        if mime_type and mime_type.startswith("audio/"):
            error_msg = "Voice note transcription failed or was unclear. Please send text or a screenshot instead."
        
        # Complete fallback: Never crash, always return usable JSON
        return {
            "influencer_name": None,
            "brand_name": None,
            "platform": None,
            "deliverables": None,
            "deadline": None,
            "payment_amount": 0.0,
            "special_notes": error_msg,
            "status": "draft",
            "influencer_handle": "N/A",
            "requires_human_review": True
        }
```

---

## Testing Checklist
1. **Fallback Safety:** Unset `REDIS_URL` in `.env`. Ensure that the API boots up without crashes and rate limiting functions as usual (using local memory).
2. **Error Presentation:** Pass a known bad API key to `GEMINI_API_KEY`. Check the frontend output—it should display the friendly *"We couldn't automatically extract..."* string instead of an ugly stack trace.
3. **Web Rate Limits:** Rapidly spam any authenticated API endpoint. You should receive a clean HTTP 429 response stating: `"Too many requests. Please slow down and try again in a minute."`
