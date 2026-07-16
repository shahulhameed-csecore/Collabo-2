import re

with open("app/services/reminders.py", "r", encoding="utf-8") as f:
    content = f.read()

new_job_code = '''async def check_deadlines_job() -> dict:
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
        # We will assume a simple cooldown: if there are critical alerts, always send.
        # If only medium, check DB for recent notifications.
        send_messaging = False
        if critical:
            send_messaging = True
        elif medium:
            # Check if notified in last 12 hours
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
            wa_text = f"🚨 *{al['title']}*\\n\\n*{al['inf_name']}*\\n- {al['wa_text']}\\n\\n*Suggested actions:*\\n" + "\\n".join([f"- {act}" for act in al["actions"]])
            tg_text = f"🚨 <b>{al['title']}</b>\\n\\n<b>{al['inf_name']}</b>\\n- {al['tg_text']}\\n\\n<b>Suggested actions:</b>\\n" + "\\n".join([f"- {act}" for act in al["actions"]])
        else:
            # Batched Summary
            wa_text = f"📊 *Collabo Campaign Summary*\\n\\n{len(sendable)} campaigns need your attention.\\n\\n"
            tg_text = f"📊 <b>Collabo Campaign Summary</b>\\n\\n{len(sendable)} campaigns need your attention.\\n\\n"
            
            if critical:
                wa_text += "🔥 *Requires Immediate Attention*\\n"
                tg_text += "🔥 <b>Requires Immediate Attention</b>\\n"
                for al in critical:
                    wa_text += f"\\n*{al['inf_name']}*\\n- {al['wa_text']}\\n*Suggested:* {', '.join(al['actions'])}\\n"
                    tg_text += f"\\n<b>{al['inf_name']}</b>\\n- {al['tg_text']}\\n<b>Suggested:</b> {', '.join(al['actions'])}\\n"
                wa_text += "\\n"
                tg_text += "\\n"
                
            if medium:
                wa_text += "⚠️ *Needs Attention*\\n"
                tg_text += "⚠️ <b>Needs Attention</b>\\n"
                for al in medium:
                    wa_text += f"\\n*{al['inf_name']}*\\n- {al['wa_text']}\\n*Suggested:* {', '.join(al['actions'])}\\n"
                    tg_text += f"\\n<b>{al['inf_name']}</b>\\n- {al['tg_text']}\\n<b>Suggested:</b> {', '.join(al['actions'])}\\n"

        if wa_enabled and wa_num:
            if _send_wa:
                await _send_wa(wa_num, wa_text.strip())
        
        if tg_chat_id:
            from app.services.telegram import send_telegram_message
            await send_telegram_message(tg_chat_id, tg_text.strip())

    log.info("reminders.job_completed", processed=processed)
    return {"processed": processed}
'''

# Replace
pattern = r'async def check_deadlines_job\(\) -> dict:.*'
new_content = re.sub(pattern, new_job_code, content, flags=re.DOTALL)

with open("app/services/reminders.py", "w", encoding="utf-8") as f:
    f.write(new_content)
