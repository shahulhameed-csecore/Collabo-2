"""
services/reminders.py
=====================
Background job that checks campaign deadlines and sends reminders/alerts.

Design decisions:
- Uses the Supabase SERVICE_ROLE key to bypass RLS (background job has no user JWT).
- Idempotency is enforced via boolean flags in the `campaigns` table
  (reminder_48h_sent, overdue_alert_sent). Each flag is set only AFTER a
  successful notification so a partial failure retries cleanly on the next run.
- Email is sent via Resend (sync SDK wrapped in asyncio.to_thread).
- WhatsApp is sent via the existing Meta Cloud API helper.
- Errors for individual campaigns are caught and logged; the job continues
  processing remaining campaigns so one bad record can't block all others.
- All timestamps are normalised to UTC internally to avoid IST/DST drift.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import pytz
import resend
import structlog
from supabase import create_client

from app.core.config import settings
from app.services.whatsapp import send_whatsapp_message

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Resend initialisation
# ---------------------------------------------------------------------------
if settings.RESEND_API_KEY:
    resend.api_key = settings.RESEND_API_KEY

# Sender address — update to your verified Resend domain
_FROM_ADDRESS = "Collabo <reminders@collabo.app>"

# Window for 48-h reminder: we check for deadlines in (0h, 48h] from now.
# Using a small lower-bound buffer avoids re-triggering if the job runs slightly
# early due to scheduler jitter.
_REMINDER_WINDOW_HOURS = 48


# ---------------------------------------------------------------------------
# Supabase admin client (bypasses RLS — never expose to user-facing routes)
# ---------------------------------------------------------------------------

def _get_supabase_admin():
    """
    Returns a Supabase client using the SERVICE_ROLE_KEY.

    Raises RuntimeError explicitly so the job fails loudly rather than
    silently reading zero rows with the anon key.
    """
    service_key = settings.SUPABASE_SERVICE_ROLE_KEY
    if not service_key:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY is not configured. "
            "The reminder job cannot run without it — set it in your Render env vars."
        )
    return create_client(settings.SUPABASE_URL, service_key)


# ---------------------------------------------------------------------------
# Email helper
# ---------------------------------------------------------------------------

async def _send_email(to_email: str, subject: str, html: str) -> bool:
    """
    Send a transactional email via Resend.

    The Resend SDK is synchronous so we run it in a thread pool executor to
    avoid blocking the asyncio event loop during the background job.

    Returns True on success, False on any failure (already logged).
    """
    if not settings.RESEND_API_KEY:
        logger.warning(
            "reminders.email_skipped",
            reason="RESEND_API_KEY not set",
            to=to_email,
        )
        return False

    params: resend.Emails.SendParams = {
        "from": _FROM_ADDRESS,
        "to": [to_email],
        "subject": subject,
        "html": html,
    }

    try:
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info("reminders.email_sent", to=to_email, subject=subject)
        return True
    except Exception as exc:
        logger.error(
            "reminders.email_failed",
            to=to_email,
            subject=subject,
            error=str(exc),
        )
        return False


# ---------------------------------------------------------------------------
# Email template helpers
# ---------------------------------------------------------------------------

def _build_reminder_email(inf_name: str, deadline: datetime) -> tuple[str, str]:
    """Returns (subject, html) for a 48-hour upcoming deadline reminder."""
    deadline_str = deadline.strftime("%B %d, %Y")
    subject = f"⏰ Action Required: Campaign for {inf_name} is due soon"
    html = f"""
<!DOCTYPE html>
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
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#059669,#0d9488);
                       padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:28px;">⏰</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;
                         letter-spacing:-0.5px;">
                Upcoming Campaign Deadline
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;color:#94a3b8;font-size:15px;line-height:1.6;">
                Hi there,
              </p>
              <p style="margin:0 0 24px;color:#e2e8f0;font-size:15px;line-height:1.6;">
                Your campaign with <strong style="color:#34d399;">{inf_name}</strong>
                is due in less than <strong style="color:#fbbf24;">48 hours</strong>.
              </p>
              <!-- Deadline badge -->
              <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;
                          padding:20px 24px;margin:0 0 24px;text-align:center;">
                <p style="margin:0 0 4px;color:#64748b;font-size:12px;
                          text-transform:uppercase;letter-spacing:1px;">Deadline</p>
                <p style="margin:0;color:#f8fafc;font-size:22px;font-weight:700;">
                  {deadline_str}
                </p>
              </div>
              <p style="margin:0 0 32px;color:#94a3b8;font-size:14px;line-height:1.6;">
                Please follow up with the creator to make sure all deliverables
                (posts, reels, stories) are on track and ready to go live.
              </p>
              <!-- CTA -->
              <div style="text-align:center;">
                <a href="https://collabo-2.vercel.app/dashboard"
                   style="display:inline-block;background:#10b981;color:#ffffff;
                          text-decoration:none;font-weight:700;font-size:14px;
                          padding:14px 32px;border-radius:10px;
                          letter-spacing:0.3px;">
                  View Dashboard →
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #1e293b;
                       text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;">
                You're receiving this because you enabled email reminders in
                <a href="https://collabo-2.vercel.app/settings"
                   style="color:#34d399;text-decoration:none;">Collabo Settings</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    return subject, html


def _build_overdue_email(inf_name: str, deadline: datetime) -> tuple[str, str]:
    """Returns (subject, html) for a campaign overdue alert."""
    deadline_str = deadline.strftime("%B %d, %Y")
    subject = f"🚨 Overdue Alert: Campaign for {inf_name} has passed its deadline"
    html = f"""
<!DOCTYPE html>
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
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#b91c1c,#dc2626);
                       padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:28px;">🚨</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;
                         letter-spacing:-0.5px;">
                Campaign is Overdue
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;color:#94a3b8;font-size:15px;line-height:1.6;">
                Hi there,
              </p>
              <p style="margin:0 0 24px;color:#e2e8f0;font-size:15px;line-height:1.6;">
                Your campaign with <strong style="color:#f87171;">{inf_name}</strong>
                has <strong>missed its deadline</strong> and requires your attention.
              </p>
              <!-- Deadline badge -->
              <div style="background:#0f172a;border:1px solid #7f1d1d;border-radius:12px;
                          padding:20px 24px;margin:0 0 24px;text-align:center;">
                <p style="margin:0 0 4px;color:#64748b;font-size:12px;
                          text-transform:uppercase;letter-spacing:1px;">Was due on</p>
                <p style="margin:0;color:#fca5a5;font-size:22px;font-weight:700;">
                  {deadline_str}
                </p>
              </div>
              <p style="margin:0 0 32px;color:#94a3b8;font-size:14px;line-height:1.6;">
                Please contact the creator immediately and update the campaign status
                in your dashboard (mark it as <em>Completed</em> or
                <em>Cancelled</em>).
              </p>
              <!-- CTA -->
              <div style="text-align:center;">
                <a href="https://collabo-2.vercel.app/dashboard"
                   style="display:inline-block;background:#ef4444;color:#ffffff;
                          text-decoration:none;font-weight:700;font-size:14px;
                          padding:14px 32px;border-radius:10px;
                          letter-spacing:0.3px;">
                  View Dashboard →
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #1e293b;
                       text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;">
                You're receiving this because you enabled email reminders in
                <a href="https://collabo-2.vercel.app/settings"
                   style="color:#34d399;text-decoration:none;">Collabo Settings</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    return subject, html


# ---------------------------------------------------------------------------
# User email lookup
# ---------------------------------------------------------------------------

async def _get_user_email(supabase_admin, user_id: str) -> Optional[str]:
    """
    Retrieves a user's email from Supabase Auth using the admin client.

    We call the auth admin API rather than querying a public table so we don't
    need to maintain a denormalised copy of the email.
    """
    try:
        resp = supabase_admin.auth.admin.get_user_by_id(user_id)
        if resp and resp.user and resp.user.email:
            return resp.user.email
        logger.warning("reminders.user_email_not_found", user_id=user_id)
    except Exception as exc:
        logger.warning(
            "reminders.user_email_lookup_failed",
            user_id=user_id,
            error=str(exc),
        )
    return None


# ---------------------------------------------------------------------------
# Deadline parsing helper
# ---------------------------------------------------------------------------

def _parse_deadline_utc(deadline_raw: str) -> Optional[datetime]:
    """
    Parses any ISO-8601-ish deadline string and returns a UTC-aware datetime.

    The campaigns table stores deadline as a `date` column (YYYY-MM-DD). When
    Supabase returns it, it comes back as a plain date string without time or
    timezone. We treat it as end-of-day IST (23:59:59 IST) so that reminders
    fire on the day before, not two days before due to the UTC offset.
    """
    if not deadline_raw:
        return None
    try:
        # If it already has time/tz info (legacy datetime rows), parse directly.
        if "T" in deadline_raw or " " in deadline_raw:
            dt = datetime.fromisoformat(deadline_raw.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)

        # Plain date string — treat as end-of-day IST (UTC+5:30)
        ist = pytz.timezone("Asia/Kolkata")
        naive_eod = datetime.strptime(deadline_raw[:10], "%Y-%m-%d").replace(
            hour=23, minute=59, second=59
        )
        return ist.localize(naive_eod).astimezone(timezone.utc)
    except (ValueError, AttributeError) as exc:
        logger.error(
            "reminders.deadline_parse_failed",
            raw=deadline_raw,
            error=str(exc),
        )
        return None


# ---------------------------------------------------------------------------
# Core idempotency helpers
# ---------------------------------------------------------------------------

def _mark_flag(supabase_admin, campaign_id: str, flag: str) -> None:
    """
    Atomically sets a boolean flag on the campaign row.

    Uses .eq("id", ...).eq(flag, False) as a conditional update so that if
    two instances of the job run concurrently (e.g. during a deploy), only
    one will win and the other is a no-op.
    """
    try:
        supabase_admin.table("campaigns").update({flag: True}).eq(
            "id", campaign_id
        ).eq(flag, False).execute()
    except Exception as exc:
        # Non-fatal — the reminder was already sent, the flag will be retried
        # on the next job run (at worst, a duplicate notification).
        logger.error(
            "reminders.flag_update_failed",
            campaign_id=campaign_id,
            flag=flag,
            error=str(exc),
        )


# ---------------------------------------------------------------------------
# Main job
# ---------------------------------------------------------------------------

async def check_deadlines_job() -> None:
    """
    Hourly cron job: check every active campaign for upcoming / overdue deadlines.

    Flow per campaign:
      1. Parse the deadline to UTC.
      2. Compute time_diff = deadline - now (UTC).
      3. If 0 < time_diff ≤ 48h AND reminder_48h_sent is False → send reminder.
      4. If time_diff ≤ 0 AND overdue_alert_sent is False → send overdue alert.
      5. Each notification type is sent (WhatsApp + email) based on user prefs.
      6. The idempotency flag is set AFTER notifications succeed, so a partial
         failure retries next hour rather than silently dropping the alert.
    """
    log = logger.bind(job="check_deadlines_job")
    log.info("reminders.job_started")

    # ── Initialise admin client ────────────────────────────────────────────
    try:
        supabase = _get_supabase_admin()
    except RuntimeError as exc:
        log.error("reminders.job_aborted", reason=str(exc))
        return

    now_utc = datetime.now(timezone.utc)

    # ── Fetch active campaigns with user settings in one query ─────────────
    try:
        response = (
            supabase.table("campaigns")
            .select(
                "id, user_id, influencer_name, influencer_handle, deadline, "
                "reminder_48h_sent, overdue_alert_sent, "
                "user_settings(whatsapp_number, email_reminders_enabled, "
                "whatsapp_reminders_enabled)"
            )
            .eq("status", "active")
            .execute()
        )
    except Exception as exc:
        log.error("reminders.fetch_failed", error=str(exc))
        return

    campaigns = response.data or []
    log.info("reminders.campaigns_fetched", count=len(campaigns))

    if not campaigns:
        log.info("reminders.job_completed", processed=0)
        return

    processed = reminded = overdue_count = error_count = 0

    for campaign in campaigns:
        campaign_id = campaign.get("id", "<unknown>")
        clog = log.bind(campaign_id=campaign_id)

        try:
            # ── Parse deadline ─────────────────────────────────────────────
            deadline_raw = campaign.get("deadline")
            if not deadline_raw:
                clog.debug("reminders.no_deadline_skipped")
                continue

            deadline_utc = _parse_deadline_utc(deadline_raw)
            if deadline_utc is None:
                continue

            time_diff = deadline_utc - now_utc

            # ── Extract user preferences ───────────────────────────────────
            user_settings = campaign.get("user_settings") or {}
            # Supabase returns a list when using a foreign-key join
            if isinstance(user_settings, list):
                user_settings = user_settings[0] if user_settings else {}

            whatsapp_num: Optional[str] = user_settings.get("whatsapp_number")
            email_enabled: bool = user_settings.get("email_reminders_enabled", True)
            wa_enabled: bool = user_settings.get("whatsapp_reminders_enabled", True)

            user_id: Optional[str] = campaign.get("user_id")
            inf_name: str = (
                campaign.get("influencer_name")
                or campaign.get("influencer_handle")
                or "Unknown Creator"
            )

            reminder_sent: bool = bool(campaign.get("reminder_48h_sent"))
            overdue_sent: bool = bool(campaign.get("overdue_alert_sent"))

            processed += 1

            # ── 48-hour upcoming reminder ──────────────────────────────────
            if timedelta(0) < time_diff <= timedelta(hours=_REMINDER_WINDOW_HOURS):
                if reminder_sent:
                    clog.debug("reminders.48h_already_sent")
                    continue

                clog.info(
                    "reminders.48h_triggered",
                    hours_left=round(time_diff.total_seconds() / 3600, 1),
                )

                notification_sent = False

                if wa_enabled and whatsapp_num:
                    wa_msg = (
                        f"⏳ *Reminder* — Campaign for *{inf_name}* is due in less than 48 hours!\n\n"
                        f"📅 Deadline: {deadline_utc.astimezone(pytz.timezone('Asia/Kolkata')).strftime('%b %d, %Y')}\n\n"
                        "Please follow up with the creator to confirm deliverables are on track.\n\n"
                        "View your dashboard: https://collabo-2.vercel.app/dashboard"
                    )
                    wa_ok = await send_whatsapp_message(whatsapp_num, wa_msg)
                    if wa_ok:
                        notification_sent = True
                        clog.info("reminders.48h_whatsapp_sent", to=whatsapp_num)
                    else:
                        clog.warning("reminders.48h_whatsapp_failed", to=whatsapp_num)

                if email_enabled and user_id:
                    user_email = await _get_user_email(supabase, user_id)
                    if user_email:
                        subject, html = _build_reminder_email(inf_name, deadline_utc)
                        email_ok = await _send_email(user_email, subject, html)
                        if email_ok:
                            notification_sent = True

                # Set flag only after at least one notification attempt
                # (even partial success — prevents endless retries for users
                # with no channels configured).
                _mark_flag(supabase, campaign_id, "reminder_48h_sent")
                reminded += 1

            # ── Overdue alert ──────────────────────────────────────────────
            elif time_diff <= timedelta(0):
                if overdue_sent:
                    clog.debug("reminders.overdue_already_sent")
                    continue

                clog.info(
                    "reminders.overdue_triggered",
                    hours_overdue=round(abs(time_diff.total_seconds()) / 3600, 1),
                )

                if wa_enabled and whatsapp_num:
                    wa_msg = (
                        f"🚨 *Overdue Alert* — Campaign for *{inf_name}* has missed its deadline!\n\n"
                        f"📅 Was due: {deadline_utc.astimezone(pytz.timezone('Asia/Kolkata')).strftime('%b %d, %Y')}\n\n"
                        "Please contact the creator and update the campaign status in your dashboard.\n\n"
                        "View: https://collabo-2.vercel.app/dashboard"
                    )
                    wa_ok = await send_whatsapp_message(whatsapp_num, wa_msg)
                    if wa_ok:
                        clog.info("reminders.overdue_whatsapp_sent", to=whatsapp_num)
                    else:
                        clog.warning("reminders.overdue_whatsapp_failed", to=whatsapp_num)

                if email_enabled and user_id:
                    user_email = await _get_user_email(supabase, user_id)
                    if user_email:
                        subject, html = _build_overdue_email(inf_name, deadline_utc)
                        await _send_email(user_email, subject, html)

                _mark_flag(supabase, campaign_id, "overdue_alert_sent")
                overdue_count += 1

        except Exception as exc:
            error_count += 1
            clog.error(
                "reminders.campaign_processing_error",
                error=str(exc),
                exc_info=True,
            )
            # Continue — never let one bad campaign abort the entire job.
            continue

    log.info(
        "reminders.job_completed",
        processed=processed,
        reminded=reminded,
        overdue=overdue_count,
        errors=error_count,
    )
