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
from supabase import create_client
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

def _get_supabase_admin():
    """
    Returns a Supabase client with the SERVICE_ROLE key.
    This bypasses RLS — only used internally by background jobs.
    Raises RuntimeError loudly if the key is missing.
    """
    service_key = settings.SUPABASE_SERVICE_ROLE_KEY
    if not service_key:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY is not set. "
            "Add it to your Render environment variables. "
            "The anon key will NOT work — it reads zero rows due to RLS."
        )
    return create_client(settings.SUPABASE_URL, service_key)


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
        async with httpx.AsyncClient(timeout=15.0) as client:
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
        resp = await asyncio.to_thread(lambda: supabase_admin.auth.admin.get_user_by_id(user_id))
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
        await asyncio.to_thread(
            lambda: supabase_admin.table("campaigns")
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
        campaigns_resp = await asyncio.to_thread(
            lambda: supabase_admin.table("campaigns")
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
            settings_resp = await asyncio.to_thread(
                lambda: supabase_admin.table("user_settings")
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
    """
    Scheduled job: check every active campaign for approaching/overdue deadlines.

    Called by APScheduler every SCHEDULER_INTERVAL_MINUTES (default: 60).
    Also called immediately on startup (see main.py lifespan).
    Also exposed via POST /internal/trigger-reminders for manual testing.

    Decision matrix per campaign:
      ┌────────────────────────────────┬──────────────────────────────────┐
      │ time_diff                      │ Action                           │
      ├────────────────────────────────┼──────────────────────────────────┤
      │ 0 < diff ≤ 48h                 │ 48h reminder (if not sent yet)   │
      │ diff ≤ 0 (past deadline)       │ Overdue alert (if not sent yet)  │
      │ diff > 48h                     │ Nothing yet                      │
      └────────────────────────────────┴──────────────────────────────────┘
    """
    log = logger.bind(job="check_deadlines_job")
    now_utc = datetime.now(timezone.utc)
    log.info(
        "reminders.job_started",
        now_utc=now_utc.isoformat(),
        now_ist=now_utc.astimezone(_IST).isoformat(),
        webhook_configured=bool(settings.GMAIL_WEBHOOK_URL),
        service_role_configured=bool(settings.SUPABASE_SERVICE_ROLE_KEY),
        wa_configured=bool(settings.WHATSAPP_TOKEN and settings.WHATSAPP_PHONE_NUMBER_ID),
    )

    # ── Admin client ───────────────────────────────────────────────────────
    try:
        supabase = _get_supabase_admin()
    except RuntimeError as exc:
        log.error("reminders.job_aborted", reason=str(exc))
        return {"error": str(exc)}

    # ── Fetch campaigns + user settings (two-step, no PostgREST join) ─────
    campaigns = await _fetch_campaigns_with_settings(supabase, log)

    if not campaigns:
        log.info("reminders.job_completed", processed=0, reminded=0, overdue=0, errors=0, skipped=0)
        return {"processed": 0, "reminded": 0, "overdue": 0, "errors": 0, "skipped": 0}

    processed = reminded = overdue_count = error_count = skipped = 0

    for campaign in campaigns:
        campaign_id = campaign.get("id", "<unknown>")
        clog = log.bind(campaign_id=campaign_id)

        try:
            # ── Parse deadline ─────────────────────────────────────────────
            deadline_raw = campaign.get("deadline")
            if not deadline_raw:
                clog.debug("reminders.skipped_no_deadline")
                skipped += 1
                continue

            deadline_utc = _parse_deadline_utc(deadline_raw, clog)
            if deadline_utc is None:
                skipped += 1
                continue

            time_diff = deadline_utc - now_utc
            hours_diff = time_diff.total_seconds() / 3600

            clog.info(
                "reminders.evaluating_campaign",
                deadline_raw=deadline_raw,
                deadline_utc=deadline_utc.isoformat(),
                deadline_ist=deadline_utc.astimezone(_IST).strftime("%Y-%m-%d %H:%M IST"),
                hours_until_deadline=round(hours_diff, 2),
                reminder_48h_sent=campaign.get("reminder_48h_sent"),
                overdue_alert_sent=campaign.get("overdue_alert_sent"),
            )

            # ── Extract user preferences ───────────────────────────────────
            user_settings = campaign.get("user_settings") or {}

            whatsapp_num: Optional[str] = user_settings.get("whatsapp_number")
            telegram_chat_id: Optional[int] = user_settings.get("telegram_chat_id")
            email_enabled: bool = bool(user_settings.get("email_reminders_enabled", True))
            wa_enabled: bool = bool(user_settings.get("whatsapp_reminders_enabled", True))

            clog.debug(
                "reminders.user_settings",
                has_whatsapp=bool(whatsapp_num),
                has_telegram=bool(telegram_chat_id),
                email_enabled=email_enabled,
                wa_enabled=wa_enabled,
                settings_row_found=bool(user_settings),
            )

            user_id: Optional[str] = campaign.get("user_id")
            inf_name: str = (
                campaign.get("influencer_name")
                or campaign.get("influencer_handle")
                or "Unknown Creator"
            )

            reminder_sent: bool = bool(campaign.get("reminder_48h_sent"))
            overdue_sent: bool = bool(campaign.get("overdue_alert_sent"))

            # Format deadline in IST for email/WhatsApp display
            deadline_ist_str = deadline_utc.astimezone(_IST).strftime("%B %d, %Y")

            processed += 1

            # ── Branch: 48h reminder ───────────────────────────────────────
            if 0 < hours_diff <= _REMINDER_WINDOW_HOURS:
                if reminder_sent:
                    clog.info(
                        "reminders.48h_skipped_already_sent",
                        hours_left=round(hours_diff, 1),
                    )
                    continue

                clog.info(
                    "reminders.48h_triggered",
                    hours_left=round(hours_diff, 1),
                    influencer=inf_name,
                )

                wa_ok = False
                email_ok = False

                # WhatsApp
                if wa_enabled and whatsapp_num:
                    wa_body = (
                        f"⏳ *Reminder* — Campaign for *{inf_name}* "
                        f"is due in {round(hours_diff, 0):.0f} hours!\n\n"
                        f"📅 Deadline: {deadline_ist_str}\n\n"
                        "Please follow up with the creator to confirm deliverables "
                        "are on track.\n\n"
                        f"View dashboard: {settings.BASE_URL}/dashboard"
                    )
                    wa_ok = await _send_whatsapp(whatsapp_num, wa_body)
                else:
                    clog.debug(
                        "reminders.48h_wa_skipped",
                        wa_enabled=wa_enabled,
                        has_number=bool(whatsapp_num),
                    )

                # Email
                if email_enabled and user_id:
                    user_email = await _get_user_email(supabase, user_id)
                    clog.debug("reminders.48h_user_email", email=user_email)
                    if user_email:
                        subject, html = _build_reminder_email(inf_name, deadline_ist_str)
                        email_ok = await _send_email(user_email, subject, html)
                    else:
                        clog.warning(
                            "reminders.48h_email_skipped",
                            reason="could not resolve user email",
                            user_id=user_id,
                        )
                else:
                    clog.debug(
                        "reminders.48h_email_skipped",
                        email_enabled=email_enabled,
                        has_user_id=bool(user_id),
                    )

                # Always mark flag — even if no channels are configured,
                # so we don't flood logs on every job run.
                await _mark_flag(supabase, campaign_id, "reminder_48h_sent", clog)
                # Send Telegram (if configured, we use the same WA toggle for TG or just send if chat_id exists)
                if telegram_chat_id:
                    from app.services.telegram import send_telegram_message
                    msg = f"⏰ <b>Action Required</b>\n\nYour campaign with <b>{inf_name}</b> is due in less than <b>48 hours</b> ({deadline_ist_str}).\n\nPlease follow up to ensure deliverables are ready."
                    markup = {
                        "inline_keyboard": [
                            [{"text": "✅ Mark Completed", "callback_data": f"camp_done:{campaign_id}"}],
                            [{"text": "📅 Extend +7 Days", "callback_data": f"camp_ext:{campaign_id}"}]
                        ]
                    }
                    await send_telegram_message(telegram_chat_id, msg, reply_markup=markup)

                reminded += 1

                from app.services.notifications import create_notification
                if user_id:
                    await create_notification(
                        service_client=supabase,
                        user_id=user_id,
                        title="Campaign Deadline Approaching",
                        message=f"Campaign for {inf_name} is due in {round(hours_diff, 0):.0f} hours.",
                        type="warning",
                        link_url="/dashboard"
                    )

                clog.info(
                    "reminders.48h_done",
                    email_sent=email_ok,
                    wa_sent=wa_ok,
                )

            # ── Branch: Overdue alert ──────────────────────────────────────
            elif hours_diff <= 0:
                if overdue_sent:
                    clog.info(
                        "reminders.overdue_skipped_already_sent",
                        hours_overdue=round(abs(hours_diff), 1),
                    )
                    continue

                clog.info(
                    "reminders.overdue_triggered",
                    hours_overdue=round(abs(hours_diff), 1),
                    influencer=inf_name,
                )

                wa_ok = False
                email_ok = False

                if wa_enabled and whatsapp_num:
                    wa_body = (
                        f"🚨 *Overdue* — Campaign for *{inf_name}* missed its deadline!\n\n"
                        f"📅 Was due: {deadline_ist_str}\n\n"
                        "Please contact the creator and update the campaign status.\n\n"
                        f"View: {settings.BASE_URL}/dashboard"
                    )
                    wa_ok = await _send_whatsapp(whatsapp_num, wa_body)

                if email_enabled and user_id:
                    user_email = await _get_user_email(supabase, user_id)
                    if user_email:
                        subject, html = _build_overdue_email(inf_name, deadline_ist_str)
                        email_ok = await _send_email(user_email, subject, html)

                await _mark_flag(supabase, campaign_id, "overdue_alert_sent", clog)
                # Send Telegram
                if telegram_chat_id:
                    from app.services.telegram import send_telegram_message
                    msg = f"⚠️ <b>Overdue Campaign</b>\n\nYour campaign with <b>{inf_name}</b> was due on <b>{deadline_ist_str}</b> and is now past due.\n\nPlease check in with them!"
                    markup = {
                        "inline_keyboard": [
                            [{"text": "✅ Mark Completed", "callback_data": f"camp_done:{campaign_id}"}],
                            [{"text": "📅 Extend +7 Days", "callback_data": f"camp_ext:{campaign_id}"}]
                        ]
                    }
                    await send_telegram_message(telegram_chat_id, msg, reply_markup=markup)
                    
                overdue_count += 1

                from app.services.notifications import create_notification
                if user_id:
                    await create_notification(
                        service_client=supabase,
                        user_id=user_id,
                        title="Campaign Overdue",
                        message=f"Campaign for {inf_name} missed its deadline.",
                        type="error",
                        link_url="/dashboard"
                    )

                clog.info(
                    "reminders.overdue_done",
                    email_sent=email_ok,
                    wa_sent=wa_ok,
                )

            # ── Branch: Too early ──────────────────────────────────────────
            else:
                clog.debug(
                    "reminders.too_early",
                    hours_until_deadline=round(hours_diff, 1),
                )

        except Exception as exc:
            sentry_sdk.capture_exception(exc)
            error_count += 1
            clog.error(
                "reminders.campaign_processing_error",
                error=str(exc),
                error_type=type(exc).__name__,
                exc_info=True,
            )
            continue

    log.info(
        "reminders.job_completed",
        processed=processed,
        reminded=reminded,
        overdue=overdue_count,
        skipped=skipped,
        errors=error_count,
        duration_seconds=round((datetime.now(timezone.utc) - now_utc).total_seconds(), 2),
    )

    return {
        "processed": processed,
        "reminded": reminded,
        "overdue": overdue_count,
        "skipped": skipped,
        "errors": error_count,
        "duration_seconds": round((datetime.now(timezone.utc) - now_utc).total_seconds(), 2)
    }
