import asyncio
from supabase import create_async_client, AsyncClient
from app.core.config import settings

_supabase_anon: AsyncClient | None = None
_supabase_admin: AsyncClient | None = None
_lock = asyncio.Lock()

async def get_supabase_anon() -> AsyncClient:
    global _supabase_anon
    async with _lock:
        if _supabase_anon is None:
            _supabase_anon = await create_async_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
        return _supabase_anon

async def get_supabase_admin() -> AsyncClient:
    global _supabase_admin
    async with _lock:
        if _supabase_admin is None:
            if not settings.SUPABASE_SERVICE_ROLE_KEY:
                raise ValueError("SUPABASE_SERVICE_ROLE_KEY is not set.")
            _supabase_admin = await create_async_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
        return _supabase_admin
