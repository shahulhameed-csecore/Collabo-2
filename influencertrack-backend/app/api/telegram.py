import asyncio
import structlog
import json
import html
import httpx
from pydantic import ValidationError
import sentry_sdk
from fastapi import APIRouter, Request, HTTPException, Response, BackgroundTasks, Header
from app.core.config import settings
from app.core.limiter import limiter
from app.services.supabase import get_supabase_admin
from app.services.gemini import extract_campaign_data
from app.services.ai_manager import process_with_ai_manager, IntentType
from app.services.telegram import send_telegram_message, download_telegram_media

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/webhook", tags=["Telegram Webhook"])


# Maximum bytes we allow to be downloaded from Telegram media (16 MB)
_MAX_MEDIA_BYTES = 16 * 1024 * 1024

# Supabase service client (bypasses RLS) is lazily initialized via get_supabase_admin()

from app.core.parsers import parse_corrections, parse_date_string
from app.core.formatters import format_single_campaign_summary, get_telegram_single_campaign_buttons, get_telegram_edit_menu
from app.services.intent_executor import execute_intent

@sentry_sdk.trace(op="webhook", name="Process Telegram Message")
async def process_telegram_message(update: dict):
    try:
        supabase_admin = await get_supabase_admin()
        if not supabase_admin:
            logger.error("Supabase Admin missing")
            return
        
        update_id = update.get("update_id")
        
        is_callback = "callback_query" in update
        if is_callback:
            cb = update["callback_query"]
            message = cb.get("message", {})
            sender = cb.get("from", {})
            chat_id = message.get("chat", {}).get("id") or sender.get("id")
        else:
            message = update.get("message") or update.get("channel_post") or update.get("edited_message")
            if not message:
                return
            chat_id = message.get("chat", {}).get("id")
            sender = message.get("from", {})
        
        username = sender.get("username")
        if not chat_id:
            return
        update_id = update.get("update_id")
        
        is_callback = "callback_query" in update
        if is_callback:
            cb = update["callback_query"]
            message = cb.get("message", {})
            sender = cb.get("from", {})
        else:
            message = update.get("message") or update.get("channel_post") or update.get("edited_message")
            sender = message.get("from", {})

        logger.info("Started _process_telegram_message_locked", chat_id=chat_id, username=username)

        from app.core.limiter import is_webhook_rate_limited
        if is_webhook_rate_limited(str(chat_id)):
            logger.warning(f"Rate limited Telegram webhook for {chat_id}")
            return

        # 1. Deduplicate via webhook_events
        if update_id:
            try:
                res = await supabase_admin.table("webhook_events").insert({"message_id": str(update_id), "platform": "tg"}).execute()
            except Exception as e:
                if "duplicate key value" in str(e).lower() or "unique constraint" in str(e).lower():
                    logger.info("Duplicate Telegram message ignored", update_id=update_id)
                    return
        # --- PAIRING CODE INTERCEPTION ---
        import re
        if not is_callback and message and "text" in message:
            text_val = message["text"].strip()
            # Deep link start payload: "/start LINK-1234"
            if text_val.upper().startswith("/START LINK-") and re.match(r"^/START LINK-\d{4}$", text_val.upper()):
                pairing_code = text_val.upper().replace("/START ", "")
                from app.core.redis import get_redis
                redis_client = get_redis()
                if redis_client:
                    redis_key = f"tg_pairing_code:{pairing_code}"
                    paired_user_id = await redis_client.get(redis_key)
                    if paired_user_id:
                        paired_user_id = paired_user_id.decode('utf-8') if isinstance(paired_user_id, bytes) else paired_user_id
                        tg_user = f"@{username}" if username else str(chat_id)
                        
                        update_payload = {
                            "telegram_username": tg_user,
                            "telegram_chat_id": str(chat_id)
                        }
                        # Include telegram_status if it exists as per instructions
                        update_payload["telegram_status"] = "CONNECTED"
                        
                        try:
                            await supabase_admin.table("user_settings").update(update_payload).eq("user_id", paired_user_id).execute()
                        except Exception as e:
                            if "Could not find the 'telegram_status' column" in str(e):
                                # Fallback if telegram_status column doesn't exist
                                del update_payload["telegram_status"]
                                await supabase_admin.table("user_settings").update(update_payload).eq("user_id", paired_user_id).execute()

                        await redis_client.delete(redis_key)
                        
                        await send_telegram_message(chat_id, "✅ <b>Success!</b>\n\nYour Telegram account has been securely linked to Collabo. You can now forward me briefs, screenshots, and voice notes.")
                        return
                    else:
                        await send_telegram_message(chat_id, "❌ This pairing link is invalid or has expired (they last 10 minutes).\n\nPlease generate a new one from your Collabo dashboard.")
                        return
        # --- END PAIRING CODE INTERCEPTION ---
        
        # 2. Match User
        user_id = None
        if username:
            usernames_to_check = [username.lower(), f"@{username.lower()}"]
            try:
                user_response = await (supabase_admin.table("user_settings")
                    .select("user_id, telegram_username, pending_action")
                    .ilike("telegram_username", f"%{username}%")
                    .execute()
                )
                if user_response.data:
                    for row in user_response.data:
                        tg_user = (row.get("telegram_username") or "").strip().lower()
                        if tg_user in usernames_to_check:
                            user_id = row["user_id"]
                            pending_action = row.get("pending_action")
                            break
            except Exception as e:
                logger.error("Failed to query user settings", error=str(e))
        
        if not user_id:
            unlinked_msg = (
                ("👋 <b>Hi! I'm Collabo AI.</b>\n\n" "I noticed your Telegram account isn't linked to Collabo yet.\n\n" "To start tracking campaigns automatically:\n" f"1. Go to your dashboard 👉 <b>Settings</b>.\n" f"2. Save your username <code>{html.escape('@' + username) if username else 'YOUR_USERNAME'}</code>.\n\n" "Once linked, you can forward me chats and I'll do the rest! ✨")
            )
            await send_telegram_message(chat_id, unlinked_msg)
            return

        # 3. Handle Callback Queries (Stage 1 Router for Buttons)
        if is_callback:
            cb_id = cb.get("id")
            cb_data = cb.get("data", "")
            from app.services.telegram import answer_callback_query
            from app.core.formatters import get_telegram_edit_menu
            await answer_callback_query(cb_id)

            if cb_data == "act_all":
                drafts = await (supabase_admin.table("campaigns")
                    .select("*")
                    .eq("user_id", user_id)
                    .eq("status", "draft")
                    .execute()
                )
                activated = []
                skipped = []
                ids_to_activate = []
                for draft in drafts.data:
                    notes = draft.get("special_notes") or ""
                    if "NEGOTIATION:" in notes:
                        skipped.append(draft.get("influencer_name") or "Unknown")
                    else:
                        ids_to_activate.append(draft["id"])
                        activated.append(draft.get("influencer_name") or "Unknown")
                        
                if ids_to_activate:
                    await supabase_admin.table("campaigns").update({"status": "active"}).in_("id", ids_to_activate).execute()
                
                res_msg = "✅ <b>Campaign Results</b>\n\n"
                if activated:
                    res_msg += "<b>Activated:</b>\n" + "\n".join([f"- {html.escape(n)}" for n in activated]) + "\n\n"
                if skipped:
                    res_msg += "<b>Skipped (Pending Negotiation):</b>\n" + "\n".join([f"- {html.escape(n)}" for n in skipped]) + "\n"
                if not activated and not skipped:
                    res_msg += "No campaigns ready to activate."
                    
                await send_telegram_message(chat_id, res_msg)
                return
            elif cb_data == "cancel_ai_action":
                await supabase_admin.table("user_settings").update({"pending_action": None}).eq("user_id", user_id).execute()
                await send_telegram_message(chat_id, "❌ Action cancelled. You can start a new request.")
                return
            elif cb_data.startswith("camp_edit:"):
                camp_id = cb_data.split(":")[1]
                await send_telegram_message(chat_id, "What would you like to edit?", reply_markup=get_telegram_edit_menu(camp_id))
                return
            elif cb_data.startswith("act_camp:"):
                camp_id = cb_data.split(":")[1]
                await supabase_admin.table("campaigns").update({"status": "active"}).eq("id", camp_id).execute()
                await send_telegram_message(chat_id, "✅ Campaign Activated successfully.")
                return
            elif cb_data.startswith("del_camp:"):
                camp_id = cb_data.split(":")[1]
                await supabase_admin.table("campaigns").delete().eq("id", camp_id).execute()
                await send_telegram_message(chat_id, "🗑️ Campaign Deleted.")
                return
            elif cb_data.startswith("edit_field:"):
                parts = cb_data.split(":")
                field = parts[1]
                camp_id = parts[2] if len(parts) > 2 else ""
                prompts = {
                    "payment": "Current Payment selected.\n\nPlease enter the new payment amount.",
                    "deadline": "Current Deadline selected.\n\nPlease enter the new deadline.",
                    "deliverables": "Current Deliverables selected.\n\nPlease enter the deliverables.",
                    "creators": "Current Creator Name selected.\n\nPlease enter the new creator name.",
                    "notes": "Current Notes selected.\n\nPlease enter any special notes for this campaign.",
                    "platform": "Current Platform selected.\n\nPlease enter the platform.",
                    "status": "Current Status selected.\n\nPlease enter the new status (e.g. Active, Paused).",
                    "url": "Current Destination URL selected.\n\nPlease enter the new URL."
                }
                await supabase_admin.table("user_settings").update({"pending_action": {"action": "edit", "field": field, "campaign_id": camp_id}}).eq("user_id", user_id).execute()
                await send_telegram_message(chat_id, prompts.get(field, 'Enter the new value:'))
                return
            return

        # 4. Stage 1: Rules Engine (Text exact matches)
        if "text" in message:
            text_val = message["text"].strip()
            text_lower = text_val.lower()
            
            # Check for pending edit
            pending_edit = pending_action
            if isinstance(pending_edit, dict) and pending_edit.get("action") == "edit":
                if text_lower == "cancel":
                    await supabase_admin.table("user_settings").update({"pending_action": None}).eq("user_id", user_id).execute()
                    await send_telegram_message(chat_id, "❌ Edit cancelled.")
                    return
                
                camp_id = pending_edit["campaign_id"]
                field = pending_edit["field"]
                db_field_map = {
                    "payment": "payment_amount",
                    "deadline": "deadline",
                    "deliverables": "deliverables",
                    "creators": "influencer_name",
                    "notes": "special_notes",
                    "platform": "platform",
                    "status": "status",
                    "url": "destination_url"
                }
                db_field = db_field_map.get(field)
                
                if db_field:
                    update_val = text_val
                    if db_field == "payment_amount":
                        try:
                            # [FIX] Properly handle decimal multipliers like 10.5k -> 10500
                            clean_str = text_val.lower().replace(",", "")
                            multiplier = 1
                            if "k" in clean_str: multiplier = 1000
                            if "l" in clean_str or "lakh" in clean_str: multiplier = 100000
                            
                            import re
                            match = re.search(r"(\d+(\.\d+)?)", clean_str)
                            if match:
                                update_val = float(match.group(1)) * multiplier
                            else:
                                raise ValueError("No number found")
                        except Exception:
                            await send_telegram_message(chat_id, "❌ Please enter a valid number for the payment amount.")
                            return
                    elif db_field == "deadline":
                        from app.core.parsers import parse_date_string
                        parsed_date = parse_date_string(text_val)
                        if parsed_date:
                            update_val = parsed_date
                        else:
                            await send_telegram_message(chat_id, f"❌ I couldn't understand that date. Please use formats like '12 Oct', 'Tomorrow', or 'DD/MM/YYYY'.")
                            return
                    
                    update_payload = {db_field: update_val}
                    if db_field == "influencer_name":
                        update_payload["influencer_handle"] = update_val  # satisfy constraint
                        
                    try:
                        await supabase_admin.table("campaigns").update(update_payload).eq("id", camp_id).execute()
                        await supabase_admin.table("user_settings").update({"pending_action": None}).eq("user_id", user_id).execute()
                        await send_telegram_message(chat_id, f"✅ Updated successfully!")
                    except Exception as e:
                        logger.error("Direct edit update failed", error=str(e))
                        await send_telegram_message(chat_id, f"❌ Failed to update. Please ensure the value is formatted correctly (e.g., Dates as DD/MM/YYYY).")
                return
            cached_obj = pending_action
            is_intent_pending = isinstance(cached_obj, dict) and "intent" in cached_obj

            if not is_intent_pending and len(text_lower) < 20 and text_lower in ["yes", "y", "yep", "no", "wrong", "delete", "cancel", "pause", "activate"]:
                await send_telegram_message(chat_id, "🤖 <b>Please use the inline buttons (Activate, Edit, Delete) attached to the campaign summary to perform this action safely.</b>")
                return

        # 5. Prepare content for AI
        content_for_gemini = None
        if "text" in message:
            content_for_gemini = message["text"].strip()
            
            # Check for pending clarification
            pending_clarif = pending_action
            if isinstance(pending_clarif, dict) and pending_clarif.get("action") == "clarification":
                original_msg = pending_clarif.get("original_msg", "")
                content_for_gemini = f"Previous Context: {original_msg}\n\nUser Clarification: {content_for_gemini}"
                await supabase_admin.table("user_settings").update({"pending_action": None}).eq("user_id", user_id).execute()
                await send_telegram_message(chat_id, "📝 Processing clarification...")
            elif not pending_action and len(content_for_gemini) > 10:
                await send_telegram_message(chat_id, "📝 Analyzing details...")
        elif "voice" in message or "audio" in message:
            media = message.get("voice") or message.get("audio")
            file_id = media.get("file_id")
            if file_id:
                await send_telegram_message(chat_id, "🎧 Listening...")
                audio_bytes = await download_telegram_media(file_id, max_bytes=_MAX_MEDIA_BYTES)
                if audio_bytes:
                    content_for_gemini = {"audio_bytes": audio_bytes, "mime_type": media.get("mime_type", "audio/ogg")}
        elif "photo" in message:
            photos = message["photo"]
            if photos:
                file_id = photos[-1].get("file_id")
                # [FIX] Always preserve the caption
                caption = message.get("caption", "")
                await send_telegram_message(chat_id, "📸 Reading screenshot...")
                image_bytes = await download_telegram_media(file_id, max_bytes=_MAX_MEDIA_BYTES)
                if image_bytes:
                    content_for_gemini = {"image_bytes": image_bytes, "mime_type": "image/jpeg", "caption": caption}
                elif caption:
                    content_for_gemini = caption # Fallback to just text
        elif "document" in message:
            document = message["document"]
            file_id = document.get("file_id")
            if file_id:
                caption = message.get("caption", "")
                await send_telegram_message(chat_id, "📄 Reading document...")
                doc_bytes = await download_telegram_media(file_id, max_bytes=_MAX_MEDIA_BYTES)
                if doc_bytes:
                    content_for_gemini = {"document_bytes": doc_bytes, "mime_type": document.get("mime_type", ""), "file_name": document.get("file_name", ""), "caption": caption}
                elif caption:
                    content_for_gemini = caption
        else:
            await send_telegram_message(chat_id, "🤖 I can't read this message type yet.")
            return

        if not content_for_gemini:
            await send_telegram_message(chat_id, "❌ The media file is too large (max 16MB) or unavailable. Please try a smaller file.")
            return

        # 6. Stage 2: AI Intent Engine
        from app.services.ai_manager import process_with_ai_manager, IntentType
        
        file_bytes = b""
        mime_type = "text/plain"
        text_content = ""
        
        if isinstance(content_for_gemini, str):
            file_bytes = content_for_gemini.encode("utf-8")
        elif isinstance(content_for_gemini, dict):
            if "audio_bytes" in content_for_gemini:
                file_bytes = content_for_gemini["audio_bytes"]
                mime_type = content_for_gemini["mime_type"]
            elif "image_bytes" in content_for_gemini:
                file_bytes = content_for_gemini["image_bytes"]
                mime_type = content_for_gemini["mime_type"]
                text_content = content_for_gemini.get("caption", "")
            elif "document_bytes" in content_for_gemini:
                file_bytes = content_for_gemini["document_bytes"]
                mime_type = content_for_gemini["mime_type"]
                text_content = content_for_gemini.get("file_name", "")

        recent_campaigns = await (supabase_admin.table("campaigns")
            .select("id, influencer_name, status, payment_amount, deadline, deliverables")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(3)
            .execute()
        )
        context_str = json.dumps(recent_campaigns.data) if recent_campaigns.data else ""

        intent_res = None
        if "text" in message and isinstance(pending_action, dict) and "intent" in pending_action:
            text_upper = message["text"].strip().upper()
            if text_upper in ["YES", "Y", "DELETE ALL", "ACTIVATE ALL", "PAUSE ALL", "UPDATE ALL"]:
                from app.services.ai_manager import IntentResponse
                intent_res = IntentResponse(**pending_action)
                await supabase_admin.table("user_settings").update({"pending_action": None}).eq("user_id", user_id).execute()

        if not intent_res:
            intent_res = await process_with_ai_manager(file_bytes, mime_type, text_content, context_str)
            
        if not intent_res:
            await send_telegram_message(chat_id, "I'm having trouble understanding that right now. Please try rephrasing or sending a shorter message.")
            return
        
        if intent_res.intent == IntentType.CLARIFICATION:
            original_text = text_content if isinstance(content_for_gemini, dict) else content_for_gemini
            if not original_text and "text" in message:
                original_text = message["text"].strip() if isinstance(message.get("text"), str) else message.get("text", {}).get("body", "").strip()
            
            await supabase_admin.table("user_settings").update({
                "pending_action": {
                    "action": "clarification", 
                    "original_msg": str(original_text)
                }
            }).eq("user_id", user_id).execute()

        def _get_cancel_interactive():
            return {
                "inline_keyboard": [
                    [{"text": "❌ Cancel", "callback_data": "cancel_ai_action"}]
                ]
            }

        is_bulk_confirm = "text" in message and message["text"].strip().upper() in ["YES", "Y", "DELETE ALL", "ACTIVATE ALL", "PAUSE ALL", "UPDATE ALL"]
        
        await execute_intent(
            intent_res=intent_res,
            user_id=user_id,
            target_id=chat_id,
            supabase_admin=supabase_admin,
            recent_campaigns_data=recent_campaigns.data,
            platform="tg",
            send_message_func=send_telegram_message,
            get_buttons_func=get_telegram_single_campaign_buttons,
            get_cancel_interactive_func=_get_cancel_interactive,
            is_bulk_confirm=is_bulk_confirm,
            
            message_id_str=f"tg_update:{update_id}" if update_id else None
        )

    except Exception as e:
        logger.error("Telegram processing error", error=str(e), exc_info=True)
        await send_telegram_message(chat_id, "🤖 <b>Oops!</b> My servers hit a snag.")

@router.post("/telegram")
async def telegram_webhook(
    request: Request, 
    background_tasks: BackgroundTasks,
    x_telegram_bot_api_secret_token: str | None = Header(default=None)
):
    """
    Receives incoming Telegram messages via Webhook.
    Always returns 200 OK quickly; heavy work is offloaded to a background task.
    """
    # Verify the secret token to ensure the request actually came from Telegram
    if settings.TELEGRAM_WEBHOOK_SECRET and x_telegram_bot_api_secret_token != settings.TELEGRAM_WEBHOOK_SECRET:
        logger.warning("Telegram secret token validation failed - unauthorized access attempt.")
        raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        payload_bytes = await request.body()
        data = json.loads(payload_bytes)
    except (json.JSONDecodeError, ValueError):
        logger.error("Received webhook, but body is invalid JSON.")
        return Response(content="OK", status_code=200)

    # Offload processing to background task
    try:
        if data.get("update_id"):
            logger.info("Queueing Telegram update to background", update_id=data.get("update_id"))
            background_tasks.add_task(process_telegram_message, data)
    except Exception as e:
        logger.error("Error queueing Telegram webhook payload for processing", error=str(e))

    return Response(content="OK", status_code=200)
