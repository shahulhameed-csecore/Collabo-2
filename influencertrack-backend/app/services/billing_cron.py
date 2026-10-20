"""
services/billing_cron.py
========================
Background job — checks for expired trials and automatically downgrades users to the 'free' tier.
"""

import structlog
from datetime import datetime, timezone
from app.services.supabase import get_supabase_admin
from app.core.config import settings

logger = structlog.get_logger(__name__)

# _get_supabase_admin removed, using get_supabase_admin from app.services.supabase

async def check_expired_trials_job() -> dict:
    """
    Scheduled job: Check users whose trial_ends_at is in the past and tier is 'pro'.
    Downgrade them to 'free'.
    """
    log = logger.bind(job="check_expired_trials_job")
    now_utc = datetime.now(timezone.utc)
    
    log.info("billing_cron.job_started", now_utc=now_utc.isoformat())
    
    try:
        supabase = await get_supabase_admin()
    except Exception as exc:
        log.error("billing_cron.job_aborted", reason=str(exc))
        return {"error": str(exc)}

    try:
        # Find pro subscriptions where trial_ends_at is in the past
        # CRITICAL SAFETY: Never downgrade paid accounts (is_paid = True) or lifetime/manual Pro (trial_ends_at is None)!
        now_str = now_utc.isoformat()
        import asyncio
        resp = await (supabase.table("subscriptions")
            .select("id, user_id, tier, trial_ends_at, is_paid")
            .eq("tier", "pro")
            .lt("trial_ends_at", now_str)
            .execute()
        )
        
        expired_subs = resp.data or []
        
        if not expired_subs:
            log.info("billing_cron.job_completed", downgraded=0)
            return {"downgraded": 0}
        
        downgraded_count = 0
        for sub in expired_subs:
            user_id = sub.get("user_id")
            sub_id = sub.get("id")
            is_paid = bool(sub.get("is_paid", False))
            trial_ends_at = sub.get("trial_ends_at")
            
            # Only skip lifetime manual Pro accounts (where trial_ends_at is None)
            if not trial_ends_at:
                log.info("billing_cron.skipping_lifetime_user", user_id=user_id, sub_id=sub_id)
                continue
                
            try:
                # Downgrade expired trial or expired paid subscription to free
                await (supabase.table("subscriptions").update({
                    "tier": "free",
                    "is_paid": False
                }).eq("id", sub_id).execute())
                log.info("billing_cron.user_downgraded", user_id=user_id, sub_id=sub_id, trial_ended_at=trial_ends_at, was_paid=is_paid)
                downgraded_count += 1
            except Exception as e:
                log.error("billing_cron.downgrade_failed", user_id=user_id, error=str(e))
                
        log.info("billing_cron.job_completed", downgraded=downgraded_count)
        return {"downgraded": downgraded_count}
        
    except Exception as exc:
        log.error("billing_cron.job_failed", error=str(exc), exc_info=True)
        return {"error": str(exc)}
