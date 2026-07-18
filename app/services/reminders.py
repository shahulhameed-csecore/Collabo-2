"""
services/reminders.py
=====================
Background job — checks campaign deadlines and sends email + WhatsApp reminders.

Fix History
-----------
v1 bugs (all fixed):
  1. structlog configured BEFORE get_logger() (was silently dropping all logs).
  2. _mark_flag() no longer uses .eq(flag, False) — Supabase SDK boolean filter
     was silently no-oping, leaving reminder_48h_sent stuck at False forever.
  3. resend import guarded so an old cached Render layer doesn't crash the module.

v2 bugs fixed in this file:
  4. CRITICAL: PostgREST embedded resource join
         user_settings(whatsapp_number, ...)
     was throwing "Could not find a relationship between 'campaigns' and
     'user_settings'" because no FK existed in the DB schema.

     FIX: Replace the single-query PostgREST join with a **two-step manual fetch**:
       Step 1 — SELECT active campaigns (no join).
       Step 2 — SELECT user_settings WHERE user_id IN (...) (single query, not N+1).
       Then merge the two result sets in Python.

     This approach is 100% reliable regardless of whether the FK exists in the DB,
     and it uses exactly one extra query for the entire batch — NOT one per campaign.

  5. Internal trigger endpoint: improved secret validation and logging.
  6. Exhaustive per-campaign structured logging at every decision point.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Any

import pytz
import structlog
from app.services.supabase import get_supabase_admin
import sentry_sdk

from app.core.config import settings

# ---------------------------------------------------------------------------
# Email sending via GMail Webhook
# ---------------------------------------------------------------------------

# WhatsApp helper — optional (during Meta App Review period)
try:
    from app.services.whatsapp import send_whatsapp_message as _send_wa
except ImportError:
    _send_wa = None  # type: ignore[assignment]

# NOTE: structlog.configure() is called in main.py at module load time.
# We call get_logger() here (module level) which is fine — structlog lazy-binds
# the configuration on first use, not at get_logger() call time.
logger = structlog.get_logger(__name__)

# Removed _FROM_ADDRESS because the Webhook handles the sender identity natively
# Reminder window: send 48h reminder when deadline is between 0 and 48h away
_REMINDER_WINDOW_HOURS = 48

# IST timezone — used for display formatting and date parsing
_IST = pytz.timezone("Asia/Kolkata")


# ---------------------------------------------------------------------------
# Supabase admin client
# ---------------------------------------------------------------------------

# _get_supabase_admin is removed, using global singleton from app.services.supabase


# ---------------------------------------------------------------------------
# Email sending via Webhook
# ---------------------------------------------------------------------------

import httpx

async def _send_email(to_email: str, subject: str, html: str) -> bool:
    """
    Send a transactional email using a Webhook (e.g., Google Apps Script).
    Runs asynchronously using httpx to prevent blocking.
    Returns True on confirmed delivery, False on any failure.
    """
    if not settings.GMAIL_WEBHOOK_URL:
        logger.warning(
            "reminders.email_skipped",
            reason="GMAIL_WEBHOOK_URL not configured in environment",
            to=to_email,
        )
        return False

    payload = {
        "to": to_email,
        "subject": subject,
        "html": html,
        "secret": settings.GMAIL_WEBHOOK_SECRET
    }

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.post(settings.GMAIL_WEBHOOK_URL, json=payload)
            resp.raise_for_status()
            
        logger.info(
            "reminders.email_sent",
            to=to_email,
            subject=subject,
            method="WEBHOOK",
            status_code=resp.status_code,
        )
        return True
    except httpx.HTTPStatusError as exc:
        logger.error(
            "reminders.email_failed",
            to=to_email,
            subject=subject,
            status_code=exc.response.status_code,
            error=str(exc),
            response_text=exc.response.text,
        )
        logger.info(
            "reminders.email_fallback", 
            to=to_email, 
            subject=subject, 
            fallback_message="Webhook returned HTTP error, email may not have been sent."
        )
        return False
    except Exception as exc:
        logger.error(
            "reminders.email_failed",
            to=to_email,
            subject=subject,
            error=str(exc),
            error_type=type(exc).__name__,
        )
        logger.info(
            "reminders.email_fallback", 
            to=to_email, 
            subject=subject, 
            fallback_message="Webhook request failed entirely."
        )
        return False


# ---------------------------------------------------------------------------
# WhatsApp sending
# ---------------------------------------------------------------------------

async def _send_whatsapp(to_number: str, body: str) -> bool:
    """
    Send a WhatsApp message via the Meta Cloud API.
    Returns False (not an error) if WhatsApp is not yet configured —
    this is expected during the Meta App Review period.
    """
    if _send_wa is None:
        logger.warning("reminders.whatsapp_skipped", reason="whatsapp service not available")
        return False

    if not settings.WHATSAPP_TOKEN or not settings.WHATSAPP_PHONE_NUMBER_ID:
        logger.warning(
            "reminders.whatsapp_skipped",
            reason="WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID not configured",
            to=to_number,
        )
        return False

    try:
        ok = await _send_wa(to_number, body)
        if ok:
            logger.info("reminders.whatsapp_sent", to=to_number)
        else:
            logger.warning("reminders.whatsapp_failed", to=to_number)
        return ok
    except Exception as exc:
        logger.error("reminders.whatsapp_error", to=to_number, error=str(exc))
        return False


# ---------------------------------------------------------------------------
# Email HTML templates
# ---------------------------------------------------------------------------

def _build_reminder_email(inf_name: str, deadline_ist: str) -> tuple[str, str]:
    """48-hour reminder email — returns (subject, html)."""
    subject = f"⏰ Action Required: Campaign for {inf_name} is due soon"
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Campaign Reminder</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;background:#1e293b;border-radius:16px;
                      border:1px solid #334155;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#059669,#0d9488);
                       padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:28px;">⏰</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">
                Upcoming Campaign Deadline
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;color:#94a3b8;font-size:15px;line-height:1.6;">Hi there,</p>
              <p style="margin:0 0 24px;color:#e2e8f0;font-size:15px;line-height:1.6;">
                Your campaign with <strong style="color:#34d399;">{inf_name}</strong>
                is due in less than <strong style="color:#fbbf24;">48 hours</strong>.
              </p>
              <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;
                          padding:20px 24px;margin:0 0 24px;text-align:center;">
                <p style="margin:0 0 4px;color:#64748b;font-size:12px;
                          text-transform:uppercase;letter-spacing:1px;">Deadline</p>
                <p style="margin:0;color:#f8fafc;font-size:22px;font-weight:700;">{deadline_ist}</p>
              </div>
              <p style="margin:0 0 32px;color:#94a3b8;font-size:14px;line-height:1.6;">
                Please follow up with the creator to make sure all deliverables are on track
                and ready to go live.
              </p>
              <div style="text-align:center;">
                <a href="{settings.BASE_URL}/dashboard"
                   style="display:inline-block;background:#10b981;color:#ffffff;
                          text-decoration:none;font-weight:700;font-size:14px;
                          padding:14px 32px;border-radius:10px;">
                  View Dashboard →
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #1e293b;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;">
                You're receiving this because you enabled email reminders in
                <a href="{settings.BASE_URL}/settings"
                   style="color:#34d399;text-decoration:none;">Collabo Settings</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
    return subject, html


def _build_overdue_email(inf_name: str, deadline_ist: str) -> tuple[str, str]:
    """Overdue alert email — returns (subject, html)."""
    subject = f"🚨 Overdue Alert: Campaign for {inf_name} has passed its deadline"
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Overdue Campaign Alert</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;background:#1e293b;border-radius:16px;
                      border:1px solid #334155;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#b91c1c,#dc2626);
                       padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:28px;">🚨</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">
                Campaign is Overdue
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;color:#94a3b8;font-size:15px;line-height:1.6;">Hi there,</p>
              <p style="margin:0 0 24px;color:#e2e8f0;font-size:15px;line-height:1.6;">
                Your campaign with <strong style="color:#f87171;">{inf_name}</strong>
                has <strong>missed its deadline</strong> and requires your attention.
              </p>
              <div style="background:#0f172a;border:1px solid #7f1d1d;border-radius:12px;
                          padding:20px 24px;margin:0 0 24px;text-align:center;">
                <p style="margin:0 0 4px;color:#64748b;font-size:12px;
                          text-transform:uppercase;letter-spacing:1px;">Was due on</p>
                <p style="margin:0;color:#fca5a5;font-size:22px;font-weight:700;">{deadline_ist}</p>
              </div>
              <p style="margin:0 0 32px;color:#94a3b8;font-size:14px;line-height:1.6;">
                Please contact the creator and update the campaign status in your dashboard
                (mark it as <em>Completed</em> or <em>Cancelled</em>).
              </p>
              <div style="text-align:center;">
                <a href="{settings.BASE_URL}/dashboard"
                   style="display:inline-block;background:#ef4444;color:#ffffff;
                          text-decoration:none;font-weight:700;font-size:14px;
                          padding:14px 32px;border-radius:10px;">
                  View Dashboard →
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #1e293b;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;">
                You're receiving this because you enabled email reminders in
                <a href="{settings.BASE_URL}/settings"
                   style="color:#34d399;text-decoration:none;">Collabo Settings</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
    return subject, html


# ---------------------------------------------------------------------------
# User email lookup
# ---------------------------------------------------------------------------

async def _get_user_email(supabase_admin, user_id: str) -> Optional[str]:
    """Fetch user email from Supabase Auth admin API."""
    try:
        import asyncio
        resp = supabase_admin.auth.admin.get_user_by_id(user_id)
        if resp and resp.user and resp.user.email:
            return resp.user.email
        logger.warning("reminders.user_email_not_found", user_id=user_id)
    except Exception as exc:
        logger.warning(
            "reminders.user_email_lookup_failed",
            user_id=user_id,
            error=str(exc),
            error_type=type(exc).__name__,
        )
    return None


# ---------------------------------------------------------------------------
# Deadline parsing
# ---------------------------------------------------------------------------

def _parse_deadline_utc(deadline_raw: str, clog) -> Optional[datetime]:
    """
    Parse a deadline string to a UTC-aware datetime.

    Supabase `date` columns return "YYYY-MM-DD" (no time, no tz).
    We treat that as end-of-day IST (23:59:59 IST) so Indian users get their
    reminder the day before the deadline, not two days before.
    """
    if not deadline_raw:
        clog.warning("reminders.deadline_empty")
        return None

    clog.debug("reminders.deadline_raw", raw=deadline_raw)

    try:
        if "T" in deadline_raw or (" " in deadline_raw and len(deadline_raw) > 10):
            # Already a datetime string (legacy rows)
            dt = datetime.fromisoformat(deadline_raw.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            result = dt.astimezone(timezone.utc)
            clog.debug("reminders.deadline_parsed_datetime", utc=result.isoformat())
            return result

        # Plain date — treat as end-of-day IST
        naive_eod = datetime.strptime(deadline_raw[:10], "%Y-%m-%d").replace(
            hour=23, minute=59, second=59
        )
        result = _IST.localize(naive_eod).astimezone(timezone.utc)
        clog.debug(
            "reminders.deadline_parsed_date",
            raw=deadline_raw,
            interpreted_as="23:59:59 IST",
            utc=result.isoformat(),
        )
        return result

    except Exception as exc:
        clog.error(
            "reminders.deadline_parse_failed",
            raw=deadline_raw,
            error=str(exc),
        )
        return None


# ---------------------------------------------------------------------------
# Idempotency flag updater
# ---------------------------------------------------------------------------

async def _mark_flag(supabase_admin, campaign_id: str, flag: str, clog) -> None:
    """
    Set a reminder flag to True on the campaign row.

    Plain UPDATE with no extra filter. We already checked the flag value from
    the SELECT result, so the double-check is not needed. Setting True twice
    is idempotent and harmless even if two job instances run concurrently.
    """
    try:
        import asyncio
        await (supabase_admin.table("campaigns")
            .update({flag: True})
            .eq("id", campaign_id)
            .execute()
        )
        clog.info("reminders.flag_set", flag=flag, campaign_id=campaign_id)
    except Exception as exc:
        clog.error(
            "reminders.flag_update_failed",
            flag=flag,
            campaign_id=campaign_id,
            error=str(exc),
        )


# ---------------------------------------------------------------------------
# Two-step fetch: campaigns + user_settings (no PostgREST join required)
# ---------------------------------------------------------------------------

async def _fetch_campaigns_with_settings(supabase_admin, log) -> list[dict]:
    """
    Fetch all active campaigns and merge their user_settings in Python.

    WHY TWO STEPS INSTEAD OF A POSTGREST JOIN?
    ------------------------------------------
    PostgREST's embedded resource syntax  user_settings(...)  only works when
    PostgreSQL has an explicit FOREIGN KEY from campaigns.user_id to
    user_settings.user_id.  If that FK is missing or hasn't been refreshed in
    PostgREST's schema cache, you get:

        "Could not find a relationship between 'campaigns' and 'user_settings'"

    This two-step approach is 100% reliable regardless of FK state and uses
    exactly ONE extra query for the entire batch — not one per campaign.

    Steps:
      1. SELECT active campaigns (no join).
      2. Collect unique user_ids → SELECT user_settings WHERE user_id IN (...).
      3. Build a dict keyed by user_id and merge into each campaign dict.
    """
    # ── Step 1: Fetch active campaigns ────────────────────────────────────
    try:
        campaigns_resp = await (supabase_admin.table("campaigns")
            .select(
                "id, user_id, influencer_name, influencer_handle, deadline, "
                "status, reminder_48h_sent, overdue_alert_sent"
            )
            .eq("status", "active")
            .execute()
        )
    except Exception as exc:
        log.error(
            "reminders.campaigns_fetch_failed",
            error=str(exc),
            error_type=type(exc).__name__,
        )
        return []

    campaigns = campaigns_resp.data or []
    log.info("reminders.campaigns_fetched", count=len(campaigns))

    if not campaigns:
        return []

    # ── Step 2: Fetch user_settings for all unique user_ids ───────────────
    user_ids = list({c["user_id"] for c in campaigns if c.get("user_id")})
    settings_by_user: dict[str, dict] = {}

    if user_ids:
        try:
            settings_resp = await (supabase_admin.table("user_settings")
                .select("user_id, whatsapp_number, telegram_chat_id, email_reminders_enabled, whatsapp_reminders_enabled")
                .in_("user_id", user_ids)
                .execute()
            )
            for row in (settings_resp.data or []):
                uid = row.get("user_id")
                if uid:
                    settings_by_user[uid] = row
            log.info(
                "reminders.user_settings_fetched",
                users_with_campaigns=len(user_ids),
                users_with_settings=len(settings_by_user),
            )
        except Exception as exc:
            # Non-fatal: we proceed with empty settings (defaults will apply)
            log.warning(
                "reminders.user_settings_fetch_failed",
                error=str(exc),
                error_type=type(exc).__name__,
                detail="Proceeding with default reminder settings for all users",
            )

    # ── Step 3: Merge settings into each campaign dict ────────────────────
    for campaign in campaigns:
        uid = campaign.get("user_id")
        campaign["user_settings"] = settings_by_user.get(uid, {}) if uid else {}

    return campaigns


# ---------------------------------------------------------------------------
# Main job
# ---------------------------------------------------------------------------

async def check_deadlines_job() -> dict:
    log = logger.bind(job="check_deadlines_job")
    now_utc = datetime.now(timezone.utc)
    
    try:
        from app.services.supabase import get_supabase_admin
        from app.services.notifications import create_notification
        supabase_admin = await get_supabase_admin()
    except Exception as exc:
        log.error("reminders.job_aborted", reason=str(exc))
        return {"error": str(exc)}

    # Fetch active & completed campaigns for processing
    try:
        campaigns_resp = await (supabase_admin.table("campaigns")
            .select("*")
            .in_("status", ["active", "completed"])
            .execute()
        )
    except Exception as exc:
        log.error("reminders.fetch_failed", error=str(exc))
        return {}
        
    campaigns = campaigns_resp.data or []
    if not campaigns:
        return {}

    user_ids = list({c.get("user_id") for c in campaigns if c.get("user_id")})
    settings_by_user = {}
    if user_ids:
        try:
            settings_resp = await (supabase_admin.table("user_settings")
                .select("user_id, whatsapp_number, telegram_chat_id, email_reminders_enabled, whatsapp_reminders_enabled")
                .in_("user_id", user_ids)
                .execute()
            )
            for row in (settings_resp.data or []):
                settings_by_user[row["user_id"]] = row
        except:
            pass

    # user_alerts: {user_id: {"critical": [], "medium": [], "low": []}}
    user_alerts = {uid: {"critical": [], "medium": [], "low": []} for uid in user_ids}
    processed = 0

    # 1. Gather Alerts
    for campaign in campaigns:
        campaign_id = campaign.get("id")
        user_id = campaign.get("user_id")
        status = campaign.get("status")
        notes = campaign.get("special_notes") or ""
        inf_name = campaign.get("influencer_name") or campaign.get("influencer_handle") or "Unknown Creator"

        if not user_id:
            continue

        async def mark_and_add(tag: str, priority: str, title: str, desc: str, wa_text: str, tg_text: str, actions: list):
            if f"[{tag}]" in notes:
                return
            new_notes = f"{notes} [{tag}]".strip()
            # Update DB immediately for idempotency
            await supabase_admin.table("campaigns").update({"special_notes": new_notes}).eq("id", campaign_id).execute()
            
            user_alerts[user_id][priority].append({
                "campaign_id": campaign_id,
                "inf_name": inf_name,
                "title": title,
                "desc": desc,
                "wa_text": wa_text,
                "tg_text": tg_text,
                "actions": actions
            })

        # Deadlines
        if status == "active" and campaign.get("deadline"):
            deadline_utc = _parse_deadline_utc(campaign["deadline"], log)
            if deadline_utc:
                days_until = (deadline_utc - now_utc).total_seconds() / 86400.0
                
                if 2 <= days_until <= 3:
                    await mark_and_add(
                        "rem_3dbefore", "low", "Deadline in 3 Days",
                        f"Deadline approaching for {inf_name}.",
                        f"Deadline in 3 days.",
                        f"Deadline in 3 days.",
                        ["Send Reminder", "Extend Deadline"]
                    )
                elif 0 < days_until <= 1:
                    await mark_and_add(
                        "rem_1dbefore", "medium", "Deadline Approaching",
                        f"Campaign for {inf_name} is due tomorrow.",
                        f"Deadline tomorrow.",
                        f"Deadline tomorrow.",
                        ["Send Reminder", "Extend Deadline"]
                    )
                elif -1 <= days_until <= 0:
                    await mark_and_add(
                        "rem_0dbefore", "critical", "Deadline Today",
                        f"Campaign for {inf_name} is due today!",
                        f"Deadline Today.",
                        f"Deadline Today.",
                        ["Follow Up", "Mark Completed"]
                    )
                elif days_until < -1:
                    await mark_and_add(
                        "rem_overdue", "critical", "Campaign Overdue",
                        f"Campaign for {inf_name} is overdue.",
                        f"Campaign Overdue.",
                        f"Campaign Overdue.",
                        ["Follow Up", "Cancel Campaign"]
                    )

        # Payments
        if status == "completed" and campaign.get("updated_at"):
            completed_utc = datetime.fromisoformat(campaign["updated_at"].replace("Z", "+00:00"))
            if completed_utc.tzinfo is None:
                completed_utc = completed_utc.replace(tzinfo=timezone.utc)
            days_since = (now_utc - completed_utc).total_seconds() / 86400.0
            
            if 3 <= days_since < 7:
                await mark_and_add(
                    "rem_pay3d", "medium", "Payment Pending",
                    f"Payment pending for {inf_name}.",
                    f"Payment pending for 3 days.",
                    f"Payment pending for 3 days.",
                    ["Mark Paid", "Send Reminder"]
                )
            elif days_since >= 7:
                await mark_and_add(
                    "rem_pay7d", "critical", "Payment Overdue",
                    f"Payment overdue for {inf_name}.",
                    f"Payment overdue for 7 days.",
                    f"Payment overdue for 7 days.",
                    ["Mark Paid", "Contact Creator"]
                )

        # Inactivity
        if status == "active" and campaign.get("updated_at"):
            updated_utc = datetime.fromisoformat(campaign["updated_at"].replace("Z", "+00:00"))
            if updated_utc.tzinfo is None:
                updated_utc = updated_utc.replace(tzinfo=timezone.utc)
            days_inactive = (now_utc - updated_utc).total_seconds() / 86400.0
            
            if 3 <= days_inactive < 5:
                await mark_and_add(
                    "rem_inac3d", "low", "Creator Inactive",
                    f"No updates from {inf_name} for 3 days.",
                    f"Creator inactive for 3 days.",
                    f"Creator inactive for 3 days.",
                    ["Follow Up", "Pause Campaign"]
                )
            elif days_inactive >= 5:
                await mark_and_add(
                    "rem_inac5d", "medium", "Creator Follow-up Required",
                    f"No updates from {inf_name} for 5 days.",
                    f"Creator inactive for 5 days.",
                    f"Creator inactive for 5 days.",
                    ["Follow Up", "Pause Campaign"]
                )

        processed += 1

    # 2. Process User Alerts
    for user_id, alerts in user_alerts.items():
        critical = alerts["critical"]
        medium = alerts["medium"]
        low = alerts["low"]
        
        all_alerts = critical + medium + low
        if not all_alerts:
            continue
            
        user_settings = settings_by_user.get(user_id, {})
        wa_enabled = bool(user_settings.get("whatsapp_reminders_enabled", True))
        wa_num = user_settings.get("whatsapp_number")
        tg_chat_id = user_settings.get("telegram_chat_id")

        # Create Dashboard Notifications for ALL
        for al in all_alerts:
            n_type = "warning" if al in medium else ("error" if al in critical else "info")
            try:
                await create_notification(
                    service_client=supabase_admin,
                    user_id=user_id,
                    title=al["title"],
                    message=al["desc"],
                    type=n_type,
                    link_url="/dashboard"
                )
            except Exception as e:
                log.error("failed_to_create_notification", error=str(e))

        # Cooldown check for medium alerts (if no critical, and user was recently notified, we skip messaging)
        send_messaging = False
        if critical:
            send_messaging = True
        elif medium:
            twelve_hours_ago = (now_utc - timedelta(hours=12)).isoformat()
            try:
                recent_notifs = await supabase_admin.table("notifications").select("id").eq("user_id", user_id).gt("created_at", twelve_hours_ago).execute()
                if not recent_notifs.data:
                    send_messaging = True
                else:
                    log.info("cooldown_active", user_id=user_id)
            except:
                send_messaging = True

        if not send_messaging:
            continue

        sendable = critical + medium
        if not sendable:
            continue

        # Format WhatsApp and Telegram Messages
        if len(sendable) == 1:
            # Single Alert Optimization
            al = sendable[0]
            wa_actions = "\n".join([f"- {act}" for act in al["actions"]])
            wa_text = f"🚨 *{al['title']}*\n\n*{al['inf_name']}*\n- {al['wa_text']}\n\n*Suggested actions:*\n{wa_actions}"
            tg_actions = "\n".join([f"- {act}" for act in al["actions"]])
            tg_text = f"🚨 <b>{al['title']}</b>\n\n<b>{al['inf_name']}</b>\n- {al['tg_text']}\n\n<b>Suggested actions:</b>\n{tg_actions}"
        else:
            # Batched Summary
            wa_text = f"📊 *Collabo Campaign Summary*\n\n{len(sendable)} campaigns need your attention.\n\n"
            tg_text = f"📊 <b>Collabo Campaign Summary</b>\n\n{len(sendable)} campaigns need your attention.\n\n"
            
            if critical:
                wa_text += "🔥 *Requires Immediate Attention*\n"
                tg_text += "🔥 <b>Requires Immediate Attention</b>\n"
                for al in critical:
                    wa_text += f"\n*{al['inf_name']}*\n- {al['wa_text']}\n*Suggested:* {', '.join(al['actions'])}\n"
                    tg_text += f"\n<b>{al['inf_name']}</b>\n- {al['tg_text']}\n<b>Suggested:</b> {', '.join(al['actions'])}\n"
                wa_text += "\n"
                tg_text += "\n"
                
            if medium:
                wa_text += "⚠️ *Needs Attention*\n"
                tg_text += "⚠️ <b>Needs Attention</b>\n"
                for al in medium:
                    wa_text += f"\n*{al['inf_name']}*\n- {al['wa_text']}\n*Suggested:* {', '.join(al['actions'])}\n"
                    tg_text += f"\n<b>{al['inf_name']}</b>\n- {al['tg_text']}\n<b>Suggested:</b> {', '.join(al['actions'])}\n"

        if wa_enabled and wa_num:
            try:
                from app.services.whatsapp import send_whatsapp_message
                await send_whatsapp_message(wa_num, wa_text.strip())
            except Exception as e:
                log.error("reminders.wa_failed", error=str(e))
        
        if tg_chat_id:
            from app.services.telegram import send_telegram_message
            await send_telegram_message(tg_chat_id, tg_text.strip())

    log.info("reminders.job_completed", processed=processed)
    return {"processed": processed}
