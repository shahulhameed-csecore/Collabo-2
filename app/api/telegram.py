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

BULK_CACHE = {}

# Maximum bytes we allow to be downloaded from Telegram media (16 MB)
_MAX_MEDIA_BYTES = 16 * 1024 * 1024

# Supabase service client (bypasses RLS) is lazily initialized via get_supabase_admin()

from app.core.parsers import parse_date_string, parse_corrections
from app.core.formatters import format_single_campaign_summary, get_telegram_single_campaign_buttons, get_telegram_edit_menu

@sentry_sdk.trace(op="webhook", name="Process Telegram Message")
async def process_telegram_message(update: dict):
    """
    Background task to process the incoming Telegram message.
    Uses Hybrid Router (Stage 1 Rules -> Stage 2 AI Intent Engine).
    """
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
            message = update.get("message") or update.get("channel_post")
            if not message:
                return
            chat_id = message.get("chat", {}).get("id")
            sender = message.get("from", {})

        username = sender.get("username")
        if not chat_id:
            return

        logger.info("Started process_telegram_message", chat_id=chat_id, username=username)

        # 1. Deduplicate
        if update_id:
            try:
                existing = await (supabase_admin.table("campaigns")
                    .select("id")
                    .ilike("special_notes", f"%[tg_update:{update_id}]%")
                    .limit(1)
                    .execute()
                )
                if existing.data:
                    logger.info("Duplicate Telegram message ignored", update_id=update_id)
                    return
            except Exception:
                pass

        # 2. Match User
        user_id = None
        if username:
            usernames_to_check = [username.lower(), f"@{username.lower()}"]
            try:
                user_response = await (supabase_admin.table("user_settings")
                    .select("user_id, telegram_username")
                    .ilike("telegram_username", f"%{username}%")
                    .execute()
                )
                if user_response.data:
                    for row in user_response.data:
                        tg_user = (row.get("telegram_username") or "").strip().lower()
                        if tg_user in usernames_to_check:
                            user_id = row["user_id"]
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
            from app.core.formatters import get_telegram_edit_menu, get_telegram_options_menu
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
                for draft in drafts.data:
                    notes = draft.get("special_notes") or ""
                    if "NEGOTIATION:" in notes:
                        skipped.append(draft.get("influencer_name") or "Unknown")
                    else:
                        await supabase_admin.table("campaigns").update({"status": "active"}).eq("id", draft["id"]).execute()
                        activated.append(draft.get("influencer_name") or "Unknown")
                
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
                BULK_CACHE.pop(user_id, None)
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
                BULK_CACHE[user_id] = {"action": "edit", "field": field, "campaign_id": camp_id}
                await send_telegram_message(chat_id, prompts.get(field, 'Enter the new value:'))
                return
            return

        # 4. Stage 1: Rules Engine (Text exact matches)
        if "text" in message:
            text_val = message["text"].strip()
            text_lower = text_val.lower()
            
            # Check for pending edit
            pending_edit = BULK_CACHE.get(user_id)
            if pending_edit and pending_edit.get("action") == "edit":
                if text_lower == "cancel":
                    BULK_CACHE.pop(user_id, None)
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
                            update_val = float(''.join(c for c in text_val.lower().replace("k", "000") if c.isdigit() or c == '.'))
                        except:
                            pass
                    
                    update_payload = {db_field: update_val}
                    if db_field == "influencer_name":
                        update_payload["influencer_handle"] = update_val  # satisfy constraint
                        
                    await supabase_admin.table("campaigns").update(update_payload).eq("id", camp_id).execute()
                    
                BULK_CACHE.pop(user_id, None)
                await send_telegram_message(chat_id, f"✅ Updated successfully!")
                return
            
            if len(text_lower) < 20 and text_lower in ["yes", "y", "yep", "no", "wrong", "delete", "cancel", "pause", "activate"]:
                recent_draft_resp = await (supabase_admin.table("campaigns")
                    .select("*")
                    .eq("user_id", user_id)
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute()
                )
                if recent_draft_resp.data:
                    draft = recent_draft_resp.data[0]
                    if text_lower in ["yes", "y", "yep", "activate"]:
                        await (supabase_admin.table("campaigns").update({"status": "active"}).eq("id", draft["id"]).execute())
                        await send_telegram_message(chat_id, "✅ <b>Done! The campaign is now Active.</b>")
                        return
                    elif text_lower in ["no", "wrong", "pause"]:
                        await (supabase_admin.table("campaigns").update({"status": "draft"}).eq("id", draft["id"]).execute())
                        await send_telegram_message(chat_id, "📝 <b>Saved! The campaign is paused as a Draft.</b>")
                        return
                    elif text_lower in ["delete", "cancel"]:
                        await (supabase_admin.table("campaigns").delete().eq("id", draft["id"]).execute())
                        await send_telegram_message(chat_id, "🗑️ <b>Campaign Deleted.</b>")
                        return

        # 5. Prepare content for AI
        content_for_gemini = None
        if "text" in message:
            content_for_gemini = message["text"].strip()
            if user_id not in BULK_CACHE and len(content_for_gemini) > 10:
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
                await send_telegram_message(chat_id, "📸 Reading screenshot...")
                image_bytes = await download_telegram_media(file_id, max_bytes=_MAX_MEDIA_BYTES)
                if image_bytes:
                    content_for_gemini = {"image_bytes": image_bytes, "mime_type": "image/jpeg", "caption": message.get("caption", "")}
        elif "document" in message:
            document = message["document"]
            file_id = document.get("file_id")
            if file_id:
                await send_telegram_message(chat_id, "📄 Reading document...")
                doc_bytes = await download_telegram_media(file_id, max_bytes=_MAX_MEDIA_BYTES)
                if doc_bytes:
                    content_for_gemini = {"document_bytes": doc_bytes, "mime_type": document.get("mime_type", ""), "file_name": document.get("file_name", "")}
        else:
            await send_telegram_message(chat_id, "🤖 I can't read this message type yet.")
            return

        if not content_for_gemini:
            await send_telegram_message(chat_id, "❌ Failed to parse media. Please try again.")
            return

        # 6. Stage 2: AI Intent Engine
        from app.services.ai_manager import process_with_ai_manager, IntentType

        async def _thinking_indicator():
            try:
                await asyncio.sleep(3)
            except asyncio.CancelledError:
                pass
        
        indicator_task = asyncio.create_task(_thinking_indicator())
        
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
        if "text" in message and user_id in BULK_CACHE:
            text_upper = message["text"].strip().upper()
            if text_upper in ["YES", "Y", "DELETE ALL", "ACTIVATE ALL", "PAUSE ALL", "UPDATE ALL"]:
                intent_res = BULK_CACHE.pop(user_id)

        if not intent_res:
            intent_res = await process_with_ai_manager(file_bytes, mime_type, text_content, context_str)
            
        indicator_task.cancel()

        if intent_res.intent == IntentType.CREATE:
            # Phase 1: Creator Name Validation
            valid_campaigns_to_create = []
            skipped_count = 0
            for c in intent_res.campaigns:
                if not c.influencer_name or c.influencer_name.strip() == "":
                    skipped_count += 1
                    continue
                valid_campaigns_to_create.append(c)
                
            if not valid_campaigns_to_create:
                await send_telegram_message(chat_id, "No valid creators found to extract.")
                return

            saved_campaigns = []
            campaign_name_for_intro = "Unknown Campaign"
            for c in valid_campaigns_to_create:
                campaign_data = c.model_dump(exclude={"id"}, exclude_none=True)
                brand = campaign_data.pop("brand_name", None)
                camp_name = campaign_data.pop("campaign_name", brand)
                
                if camp_name and campaign_name_for_intro == "Unknown Campaign":
                    campaign_name_for_intro = camp_name
                
                campaign_data["user_id"] = user_id
                campaign_data["status"] = "draft"
                campaign_data["influencer_handle"] = campaign_data.get("influencer_name") or "Unknown"
                if update_id:
                    campaign_data["special_notes"] = f"{campaign_data.get('special_notes', '')} [tg_update:{update_id}]".strip()
                
                res = await supabase_admin.table("campaigns").insert(campaign_data).execute()
                if res.data:
                    saved_c = res.data[0]
                else:
                    saved_c = campaign_data
                    
                if camp_name:
                    saved_c["campaign_name"] = camp_name
                elif brand:
                    saved_c["brand_name"] = brand
                saved_campaigns.append(saved_c)
                    
            intro_msg = f"AI Campaign Manager\n\nExtraction completed successfully.\n\nCampaign:\n{campaign_name_for_intro}\n\nCreators Found:\n{len(saved_campaigns)}\n\nPlease review the extracted creator details below before activating them."
            if skipped_count > 0:
                intro_msg += f"\n\nNote: {skipped_count} creator(s) were skipped because their names were missing."
            await send_telegram_message(chat_id, intro_msg)
            
            for campaign in saved_campaigns:
                summary_msg = format_single_campaign_summary(
                    campaign,
                    platform="tg"
                )
                await send_telegram_message(
                    chat_id, 
                    summary_msg, 
                    reply_markup=get_telegram_single_campaign_buttons(campaign)
                )

        elif intent_res.intent in [IntentType.UPDATE, IntentType.DELETE, IntentType.ACTIVATE, IntentType.PAUSE]:
            target_ids = intent_res.target_campaign_ids
            if not target_ids and intent_res.campaigns:
                target_ids = [c.id for c in intent_res.campaigns if c.id]
                
            if not target_ids:
                if intent_res.campaigns:
                    valid_ids = [rc["id"] for rc in (recent_campaigns.data or [])]
                    if valid_ids: target_ids = [valid_ids[0]]
            
            if not target_ids:
                await send_telegram_message(chat_id, "❌ I couldn't determine which creator collaboration you'd like to update. Please mention the creator's name.")
                return
                
            if len(target_ids) > 1 and not ("text" in message and message["text"].strip().upper() in ["YES", "Y", "DELETE ALL", "ACTIVATE ALL", "PAUSE ALL", "UPDATE ALL"]):
                BULK_CACHE[user_id] = intent_res
                action_name = intent_res.intent.value.lower()
                cancel_markup = {
                    "inline_keyboard": [
                        [{"text": "❌ Cancel", "callback_data": "cancel_ai_action"}]
                    ]
                }
                await send_telegram_message(chat_id, f"AI Campaign Manager\n\nYou are about to {action_name} {len(target_ids)} creator collaborations.\n\nPlease confirm.\n\nReply with:\n- YES\n- {action_name.upper()} ALL", reply_markup=cancel_markup)
                return
                
            if intent_res.intent == IntentType.DELETE:
                await supabase_admin.table("campaigns").delete().in_("id", target_ids).execute()
                if len(target_ids) > 1:
                    await send_telegram_message(chat_id, f"AI Campaign Manager\n\nSuccessfully deleted {len(target_ids)} creator collaborations.")
                else:
                    await send_telegram_message(chat_id, "🗑️ Creator collaboration deleted successfully.")
            else:
                updates = {}
                if intent_res.intent == IntentType.ACTIVATE: updates["status"] = "active"
                elif intent_res.intent == IntentType.PAUSE: updates["status"] = "paused"
                
                if intent_res.intent == IntentType.UPDATE and intent_res.campaigns:
                    c = intent_res.campaigns[0]
                    updates = c.model_dump(exclude={"id", "campaign_name"}, exclude_none=True)
                    updates.pop("brand_name", None)
                    
                if updates:
                    await supabase_admin.table("campaigns").update(updates).in_("id", target_ids).execute()
                    
                updated_resp = await (supabase_admin.table("campaigns").select("*").in_("id", target_ids).execute())
                data = updated_resp.data or []
                
                if len(target_ids) > 1:
                    counts = {}
                    for cmp in data:
                        b = cmp.get("brand_name") or cmp.get("campaign_name") or "Unknown"
                        counts[b] = counts.get(b, 0) + 1
                    summary_text = f"AI Campaign Manager\n\nSuccessfully {intent_res.intent.value.lower()}d {len(target_ids)} creator collaborations.\n\nSummary:\n"
                    for b, count in counts.items():
                        summary_text += f"- {b} ({count})\n"
                    summary_text += "\nWould you like to review any creator collaboration?"
                    await send_telegram_message(chat_id, summary_text)
                else:
                    for cmp in data:
                        summary_msg = format_single_campaign_summary(cmp, platform="tg")
                        await send_telegram_message(chat_id, summary_msg, reply_markup=get_telegram_single_campaign_buttons(cmp))

        elif intent_res.intent == IntentType.QUERY:
            filters = intent_res.query_filters
            query = supabase_admin.table("campaigns").select("*").eq("user_id", user_id)
            if filters:
                if filters.status: query = query.eq("status", filters.status)
                if filters.brand_name: query = query.ilike("brand_name", f"%{filters.brand_name}%")
                
            resp = await query.order("created_at", desc=True).limit(20).execute()
            data = resp.data or []
            
            if filters and filters.is_negotiation:
                data = [c for c in data if "NEGOTIATION:" in (c.get("special_notes") or "")]
            if filters and filters.missing_payment:
                data = [c for c in data if c.get("payment_amount") in [None, 0.0, 0]]
                
            if not data:
                await send_telegram_message(chat_id, "📊 No matching campaigns found.")
            else:
                await send_telegram_message(chat_id, f"📊 Found {len(data)} matching creator collaborations.\n\nHere they are:")
                for c in data[:5]:
                    summary_msg = format_single_campaign_summary(c, platform="tg")
                    await send_telegram_message(chat_id, summary_msg, reply_markup=get_telegram_single_campaign_buttons(c))
                if len(data) > 5:
                    await send_telegram_message(chat_id, f"...and {len(data)-5} more.")

        elif intent_res.intent == IntentType.CLARIFICATION:
            cancel_markup = {
                "inline_keyboard": [
                    [{"text": "❌ Cancel", "callback_data": "cancel_ai_action"}]
                ]
            }
            await send_telegram_message(chat_id, f"AI Campaign Manager\n\n{intent_res.recommendation_text}", reply_markup=cancel_markup)

        elif intent_res.intent == IntentType.RECOMMENDATION:
            await send_telegram_message(chat_id, f"💡 *Suggestion*\n\n{intent_res.recommendation_text}")

        else:
            await send_telegram_message(chat_id, intent_res.recommendation_text or "Sorry, I didn't catch that. Could you rephrase?")

    except Exception as e:
        logger.error("Telegram processing error", error=str(e), exc_info=True)
        await send_telegram_message(chat_id, "🤖 <b>Oops!</b> My servers hit a snag.")

@router.post("/telegram")
@limiter.limit("60/minute")
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
