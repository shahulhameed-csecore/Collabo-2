import re

with open("app/services/reminders.py", "r", encoding="utf-8") as f:
    content = f.read()

# Replace the check_deadlines_job function
new_job_code = '''async def check_deadlines_job() -> dict:
    log = logger.bind(job="check_deadlines_job")
    now_utc = datetime.now(timezone.utc)
    
    try:
        from app.services.supabase import get_supabase_admin
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

    processed = 0

    for campaign in campaigns:
        campaign_id = campaign.get("id")
        user_id = campaign.get("user_id")
        user_settings = settings_by_user.get(user_id, {})
        
        status = campaign.get("status")
        notes = campaign.get("special_notes") or ""
        inf_name = campaign.get("influencer_name") or campaign.get("influencer_handle") or "Unknown Creator"
        
        wa_enabled = bool(user_settings.get("whatsapp_reminders_enabled", True))
        wa_num = user_settings.get("whatsapp_number")
        tg_chat_id = user_settings.get("telegram_chat_id")
        
        async def send_msg(tag: str, msg_wa: str, msg_tg: str):
            if f"[{tag}]" in notes:
                return
            new_notes = f"{notes} [{tag}]".strip()
            await supabase_admin.table("campaigns").update({"special_notes": new_notes}).eq("id", campaign_id).execute()
            if wa_enabled and wa_num:
                await _send_whatsapp(wa_num, msg_wa)
            if tg_chat_id:
                from app.services.telegram import send_telegram_message
                await send_telegram_message(tg_chat_id, msg_tg)

        # 1. Deadline Throttling (3 Days Before, 1 Day Before, On Deadline Day)
        if status == "active" and campaign.get("deadline"):
            deadline_utc = _parse_deadline_utc(campaign["deadline"], log)
            if deadline_utc:
                days_until = (deadline_utc - now_utc).total_seconds() / 86400.0
                
                if 2 <= days_until <= 3:
                    await send_msg(
                        "rem_3dbefore",
                        f"⏳ *Reminder* — Campaign for *{inf_name}* is due in 3 days! Please check in.",
                        f"⏳ <b>Reminder</b> — Campaign for <b>{inf_name}</b> is due in 3 days! Please check in."
                    )
                elif 0 < days_until <= 1:
                    await send_msg(
                        "rem_1dbefore",
                        f"⏳ *Urgent* — Campaign for *{inf_name}* is due TOMORROW! Ensure deliverables are ready.",
                        f"⏳ <b>Urgent</b> — Campaign for <b>{inf_name}</b> is due TOMORROW! Ensure deliverables are ready."
                    )
                elif -1 <= days_until <= 0:
                    await send_msg(
                        "rem_0dbefore",
                        f"🚨 *Deadline Day* — Campaign for *{inf_name}* is due TODAY!",
                        f"🚨 <b>Deadline Day</b> — Campaign for <b>{inf_name}</b> is due TODAY!"
                    )

        # 2. Payment Throttling (After 3 Days, After 7 Days of Completion)
        if status == "completed" and campaign.get("updated_at"):
            # Assume updated_at is when it was marked completed
            completed_utc = datetime.fromisoformat(campaign["updated_at"].replace("Z", "+00:00"))
            if completed_utc.tzinfo is None:
                completed_utc = completed_utc.replace(tzinfo=timezone.utc)
                
            days_since = (now_utc - completed_utc).total_seconds() / 86400.0
            
            if 3 <= days_since < 7:
                await send_msg(
                    "rem_pay3d",
                    f"💸 *Pending Payment* — You completed *{inf_name}* 3 days ago. Don't forget to process their payment if not done!",
                    f"💸 <b>Pending Payment</b> — You completed <b>{inf_name}</b> 3 days ago. Don't forget to process their payment if not done!"
                )
            elif days_since >= 7:
                await send_msg(
                    "rem_pay7d",
                    f"💸 *Pending Payment* — The campaign for *{inf_name}* has been completed for 7 days! Please ensure they are paid.",
                    f"💸 <b>Pending Payment</b> — The campaign for <b>{inf_name}</b> has been completed for 7 days! Please ensure they are paid."
                )

        # 3. Creator Inactivity (After 3 Days, After 5 Days of no updates on an active campaign)
        if status == "active" and campaign.get("updated_at"):
            updated_utc = datetime.fromisoformat(campaign["updated_at"].replace("Z", "+00:00"))
            if updated_utc.tzinfo is None:
                updated_utc = updated_utc.replace(tzinfo=timezone.utc)
                
            days_inactive = (now_utc - updated_utc).total_seconds() / 86400.0
            
            if 3 <= days_inactive < 5:
                await send_msg(
                    "rem_inac3d",
                    f"😴 *Inactive* — No updates on *{inf_name}* for 3 days. Might be worth sending a quick ping!",
                    f"😴 <b>Inactive</b> — No updates on <b>{inf_name}</b> for 3 days. Might be worth sending a quick ping!"
                )
            elif days_inactive >= 5:
                await send_msg(
                    "rem_inac5d",
                    f"😴 *Ghosting Alert* — No updates on *{inf_name}* for 5 days. Are they ghosting you?",
                    f"😴 <b>Ghosting Alert</b> — No updates on <b>{inf_name}</b> for 5 days. Are they ghosting you?"
                )

        processed += 1

    log.info("reminders.job_completed", processed=processed)
    return {"processed": processed}
'''

# Use regex to replace the function
pattern = r'async def check_deadlines_job\(\) -> dict:.*'
new_content = re.sub(pattern, new_job_code, content, flags=re.DOTALL)

with open("app/services/reminders.py", "w", encoding="utf-8") as f:
    f.write(new_content)
