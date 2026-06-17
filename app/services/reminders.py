import logging
from datetime import datetime, timedelta
import pytz
from supabase import create_client
import resend

from app.core.config import settings
from app.services.whatsapp import send_whatsapp_message

logger = logging.getLogger(__name__)

# Initialize Supabase Admin Client
def get_supabase_admin():
    service_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
    if not service_key:
        return None
    return create_client(settings.SUPABASE_URL, service_key)

# Configure Resend
if settings.RESEND_API_KEY:
    resend.api_key = settings.RESEND_API_KEY

async def send_email_reminder(to_email: str, subject: str, html_content: str):
    if not settings.RESEND_API_KEY:
        logger.warning(f"RESEND_API_KEY not set. Would have sent email to {to_email}: {subject}")
        return False
    
    try:
        r = resend.Emails.send({
            "from": "Collabo Reminders <reminders@collabo.app>", # Update with verified domain later
            "to": [to_email],
            "subject": subject,
            "html": html_content
        })
        logger.info(f"Email sent to {to_email}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False

async def check_deadlines_job():
    """
    Cron job that checks for upcoming and overdue deadlines.
    Runs periodically (e.g., every 1 hour).
    """
    logger.info("Starting check_deadlines_job...")
    
    supabase = get_supabase_admin()
    if not supabase:
        logger.error("Supabase admin client not initialized. Cannot run reminders.")
        return

    # Set timezone to Asia/Kolkata
    tz = pytz.timezone('Asia/Kolkata')
    now = datetime.now(tz)
    
    # 1. Fetch all active campaigns
    try:
        response = supabase.table('campaigns').select('*, user_settings(whatsapp_number, email_reminders_enabled, whatsapp_reminders_enabled), auth_users!inner(email)').eq('status', 'active').execute()
    except Exception as e:
        logger.error(f"Failed to fetch campaigns for reminders: {e}")
        return
        
    campaigns = response.data
    if not campaigns:
        logger.info("No active campaigns with deadlines found.")
        return

    for c in campaigns:
        try:
            deadline_str = c.get('deadline')
            if not deadline_str:
                continue
                
            # Parse deadline and ensure it is timezone-aware
            deadline = datetime.fromisoformat(deadline_str.replace('Z', '+00:00'))
            if deadline.tzinfo is None:
                deadline = tz.localize(deadline)
            else:
                deadline = deadline.astimezone(tz)
                
            time_diff = deadline - now
            
            # Extract user settings
            user_email = c.get('auth_users', {}).get('email')
            user_settings = c.get('user_settings')
            if isinstance(user_settings, list) and len(user_settings) > 0:
                user_settings = user_settings[0]
            elif not isinstance(user_settings, dict):
                user_settings = {}
                
            whatsapp_num = user_settings.get('whatsapp_number')
            email_enabled = user_settings.get('email_reminders_enabled', True)
            wa_enabled = user_settings.get('whatsapp_reminders_enabled', True)
            
            inf_name = c.get('influencer_name') or c.get('influencer_handle')
            campaign_id = c['id']

            # 48-Hour Reminder Logic
            if timedelta(hours=0) < time_diff <= timedelta(hours=48) and not c.get('reminder_48h_sent'):
                logger.info(f"Triggering 48h reminder for campaign {campaign_id}")
                
                # WhatsApp
                if wa_enabled and whatsapp_num:
                    msg = f"⏳ *Reminder*: Campaign for {inf_name} is due in less than 48 hours!\n\nDeadline: {deadline.strftime('%b %d, %Y')}\nPlease follow up with the creator to ensure deliverables are on track."
                    await send_whatsapp_message(whatsapp_num, msg)
                
                # Email
                if email_enabled and user_email:
                    subject = f"Action Required: Campaign for {inf_name} due soon ⏳"
                    html = f"<h3>Campaign Reminder</h3><p>Your campaign with <strong>{inf_name}</strong> is due on {deadline.strftime('%B %d, %Y')}.</p><p>Please ensure all deliverables are on track.</p>"
                    await send_email_reminder(user_email, subject, html)
                
                # Mark as sent
                supabase.table('campaigns').update({'reminder_48h_sent': True}).eq('id', campaign_id).execute()
                
            # Overdue Logic
            elif time_diff <= timedelta(hours=0) and not c.get('overdue_alert_sent'):
                logger.info(f"Triggering overdue alert for campaign {campaign_id}")
                
                # WhatsApp
                if wa_enabled and whatsapp_num:
                    msg = f"🚨 *Overdue Alert*: Campaign for {inf_name} has missed its deadline!\n\nDeadline was: {deadline.strftime('%b %d, %Y')}\nPlease check the status and update the Collabo dashboard."
                    await send_whatsapp_message(whatsapp_num, msg)
                
                # Email
                if email_enabled and user_email:
                    subject = f"🚨 Overdue Campaign: {inf_name}"
                    html = f"<h3>Campaign Overdue</h3><p>Your campaign with <strong>{inf_name}</strong> missed its deadline on {deadline.strftime('%B %d, %Y')}.</p><p>Please check the status.</p>"
                    await send_email_reminder(user_email, subject, html)
                
                # Mark as sent
                supabase.table('campaigns').update({'overdue_alert_sent': True}).eq('id', campaign_id).execute()
                
        except Exception as e:
            logger.error(f"Error processing reminders for campaign {c.get('id')}: {e}")
            continue

    logger.info("check_deadlines_job completed.")
