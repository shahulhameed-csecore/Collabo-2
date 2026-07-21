import structlog
from typing import Optional
from app.core.config import settings

logger = structlog.get_logger(__name__)

try:
    import redis.asyncio as redis
except ImportError:
    redis = None

_redis_client = None

def get_redis():
    """Returns the global Redis client if configured, otherwise None."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
        
    if redis and settings.REDIS_URL:
        try:
            _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
            logger.info("redis.initialized", url_set=True)
            return _redis_client
        except Exception as e:
            logger.error("redis.initialization_failed", error=str(e))
            return None
    return None

async def close_redis():
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        _redis_client = None
