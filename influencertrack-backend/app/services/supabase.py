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


async def is_user_pro_or_paid(service_client, user_id: str) -> tuple[bool, dict]:
    """
    Single source of truth for user Pro / subscription status across the backend.
    Returns (is_active_pro, subscription_dict).

    A user is considered to have active Pro access if:
    1. IS_TESTING_PHASE is active, OR
    2. is_paid is True (and if trial_ends_at is set: trial_ends_at > now OR trial_ends_at is None for lifetime/manual paid accounts; or tier == 'pro'), OR
    3. tier == 'pro' AND (is_paid is True OR trial_ends_at is None OR trial_ends_at > now), OR
    4. Active trial: trial_ends_at is set AND trial_ends_at > now.
    """
    from datetime import datetime, timezone
    import structlog

    log = structlog.get_logger(__name__)

    if not user_id:
        return False, {}

    try:
        from app.api.billing import IS_TESTING_PHASE
        if IS_TESTING_PHASE:
            return True, {"tier": "pro", "is_paid": True}
    except Exception:
        pass

    if service_client is None:
        service_client = await get_supabase_admin()

    try:
        sub_res = await service_client.table("subscriptions").select("*").eq("user_id", str(user_id)).execute()
    except Exception as e:
        log.error("is_user_pro_or_paid.query_failed", user_id=user_id, error=str(e))
        return False, {}

    sub_data = {}
    if sub_res and hasattr(sub_res, "data") and sub_res.data:
        if isinstance(sub_res.data, list) and len(sub_res.data) > 0:
            sub_data = sub_res.data[0]
        elif isinstance(sub_res.data, dict):
            sub_data = sub_res.data

    if not sub_data:
        return False, {}

    tier = str(sub_data.get("tier") or sub_data.get("plan") or "free").lower().strip()
    is_paid = bool(sub_data.get("is_paid", False))
    trial_ends_at_val = sub_data.get("trial_ends_at")

    parsed_trial_ends_at = None
    if trial_ends_at_val:
        if isinstance(trial_ends_at_val, str):
            try:
                parsed_trial_ends_at = datetime.fromisoformat(trial_ends_at_val.replace("Z", "+00:00"))
            except Exception:
                parsed_trial_ends_at = None
        elif isinstance(trial_ends_at_val, datetime):
            parsed_trial_ends_at = trial_ends_at_val

    if parsed_trial_ends_at and parsed_trial_ends_at.tzinfo is None:
        parsed_trial_ends_at = parsed_trial_ends_at.replace(tzinfo=timezone.utc)

    now = datetime.now(timezone.utc)
    has_valid_time = (parsed_trial_ends_at is None) or (parsed_trial_ends_at > now)

    is_pro = False
    # Rule 1: Paid account (active expiration or lifetime/manual pro)
    if is_paid and (has_valid_time or tier == "pro"):
        is_pro = True
    # Rule 2: Tier is Pro (active paid or trial)
    elif tier == "pro" and (is_paid or has_valid_time):
        is_pro = True
    # Rule 3: Active trial
    elif parsed_trial_ends_at and parsed_trial_ends_at > now:
        is_pro = True

    return is_pro, sub_data

