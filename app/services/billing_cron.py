"""
services/billing_cron.py
========================
Background job — checks for expired trials and automatically downgrades users to the 'free' tier.
"""

import structlog
from datetime import datetime, timezone
from supabase import create_client
from app.core.config import settings

logger = structlog.get_logger(__name__)

def _get_supabase_admin():
    service_key = settings.SUPABASE_SERVICE_ROLE_KEY
    if not service_key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is not set.")
    return create_client(settings.SUPABASE_URL, service_key)

async def check_expired_trials_job() -> dict:
    """
    Scheduled job: Check users whose trial_ends_at is in the past and tier is 'pro'.
    Downgrade them to 'free'.
    """
    log = logger.bind(job="check_expired_trials_job")
    now_utc = datetime.now(timezone.utc)
    
    log.info("billing_cron.job_started", now_utc=now_utc.isoformat())
    
    try:
        supabase = _get_supabase_admin()
    except RuntimeError as exc:
        log.error("billing_cron.job_aborted", reason=str(exc))
        return {"error": str(exc)}

    try:
        # Find all pro subscriptions with an expired trial
        # Supabase Python client filter for less than timestamp
        now_str = now_utc.isoformat()
        resp = supabase.table("subscriptions").select("id, user_id, tier, trial_ends_at").eq("tier", "pro").lt("trial_ends_at", now_str).execute()
        
        expired_subs = resp.data or []
        
        if not expired_subs:
            log.info("billing_cron.job_completed", downgraded=0)
            return {"downgraded": 0}
        
        downgraded_count = 0
        for sub in expired_subs:
            user_id = sub.get("user_id")
            sub_id = sub.get("id")
            try:
                # Downgrade to free
                supabase.table("subscriptions").update({"tier": "free"}).eq("id", sub_id).execute()
                
                # Optional: You could insert a notification for the user here
                # from app.services.notifications import create_notification
                # await create_notification(...)
                
                log.info("billing_cron.user_downgraded", user_id=user_id, sub_id=sub_id, trial_ended_at=sub.get("trial_ends_at"))
                downgraded_count += 1
            except Exception as e:
                log.error("billing_cron.downgrade_failed", user_id=user_id, error=str(e))
                
        log.info("billing_cron.job_completed", downgraded=downgraded_count)
        return {"downgraded": downgraded_count}
        
    except Exception as exc:
        log.error("billing_cron.job_failed", error=str(exc), exc_info=True)
        return {"error": str(exc)}
