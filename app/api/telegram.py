import structlog
import json
import html
from fastapi import APIRouter, Request, HTTPException, Response, BackgroundTasks, Header
from app.core.config import settings
from app.core.limiter import limiter
from supabase import create_client
from app.services.gemini import extract_campaign_data
from app.services.telegram import send_telegram_message, download_telegram_media

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/webhook", tags=["Telegram Webhook"])

# Maximum bytes we allow to be downloaded from Telegram media (16 MB)
_MAX_MEDIA_BYTES = 16 * 1024 * 1024

# Initialize Supabase service client (bypasses RLS) — for webhook inserts
supabase_admin = None
if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
    supabase_admin = create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_ROLE_KEY,
    )

from app.core.utils import parse_date_string, parse_corrections, format_campaign_summary

async def process_telegram_message(update: dict):
    """
    Background task to process the incoming Telegram message.
    Looks up the user by username, calls Gemini AI, and inserts a campaign into Supabase.
    """
    try:
        if not supabase_admin:
            logger.error("Supabase Admin client not initialized — SERVICE_ROLE_KEY missing.")
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
                return # Ignore non-message updates (e.g., inline queries)
            chat_id = message.get("chat", {}).get("id")
            sender = message.get("from", {})

        username = sender.get("username")
        
        if not chat_id:
            return

        logger.info("Started process_telegram_message", chat_id=chat_id, username=username)

        # 1. Deduplicate using update_id
        if update_id:
            try:
                existing = (
                    supabase_admin.table("campaigns")
                    .select("id")
                    .ilike("special_notes", f"%[tg_update:{update_id}]%")
                    .limit(1)
                    .execute()
                )
                if existing.data:
                    logger.info("Duplicate Telegram message ignored", update_id=update_id)
                    return
            except Exception:
                pass  # Non-critical; proceed to process

        # 2. Match User Account
        user_id = None
        if username:
            # Check with and without @ prefix
            usernames_to_check = [username.lower(), f"@{username.lower()}"]
            try:
                user_response = (
                    supabase_admin.table("user_settings")
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
            logger.warning("No linked Collabo account found for Telegram username", username=username)
            unlinked_msg = (
                "👋 <b>Hi! I'm Collabo AI.</b>\n\n"
                "I noticed your Telegram account isn't linked to Collabo yet.\n\n"
                "To start tracking campaigns automatically:\n"
                f"1. Go to your Collabo dashboard 👉 <b>Settings</b>.\n"
                f"2. Save your Telegram username <code>{html.escape(('@' + username) if username else 'YOUR_USERNAME')}</code>.\n\n"
                "Once linked, you can forward me influencer chats or voice notes and I'll do the rest! ✨"
            )
            success = await send_telegram_message(chat_id, unlinked_msg)
            logger.info("Sent unlinked message fallback", success=success)
            return

        logger.info("Matched user account", user_id=user_id)

        # 2b. Store the chat_id so we can send proactive reminders later
        try:
            supabase_admin.table("user_settings").update({
                "telegram_chat_id": chat_id
            }).eq("user_id", user_id).execute()
        except Exception as e:
            logger.error("Failed to update telegram_chat_id", error=str(e))

        # 3. Handle Callback Queries (Inline Keyboards)
        if "callback_query" in update:
            cb = update["callback_query"]
            cb_id = cb.get("id")
            cb_data = cb.get("data", "")
            
            # Acknowledge immediately to remove loading icon
            from app.services.telegram import answer_callback_query
            await answer_callback_query(cb_id)

            if cb_data.startswith("camp_del:"):
                camp_id = cb_data.split(":")[1]
                supabase_admin.table("campaigns").delete().eq("id", camp_id).eq("user_id", user_id).execute()
                await send_telegram_message(chat_id, "🗑️ <b>Campaign Deleted</b>\n\nI've removed that draft from your account.")
                return
            elif cb_data.startswith("camp_act:"):
                camp_id = cb_data.split(":")[1]
                supabase_admin.table("campaigns").update({"status": "active"}).eq("id", camp_id).eq("user_id", user_id).execute()
                await send_telegram_message(chat_id, "✅ <b>Campaign Activated!</b>\n\nIt will now show up on your dashboard and calendar.")
                return
            elif cb_data.startswith("camp_done:"):
                camp_id = cb_data.split(":")[1]
                supabase_admin.table("campaigns").update({"status": "completed"}).eq("id", camp_id).eq("user_id", user_id).execute()
                await send_telegram_message(chat_id, "🎉 <b>Awesome!</b>\n\nI've marked that campaign as <b>Completed</b>.")
                return
            elif cb_data.startswith("camp_ext:"):
                camp_id = cb_data.split(":")[1]
                # Fetch campaign to get current deadline
                resp = supabase_admin.table("campaigns").select("deadline").eq("id", camp_id).eq("user_id", user_id).execute()
                if resp.data and resp.data[0].get("deadline"):
                    cur = resp.data[0].get("deadline")
                    try:
                        from dateutil.parser import parse as parse_date
                        from datetime import timedelta
                        dt = parse_date(cur)
                        new_dt = dt + timedelta(days=7)
                        supabase_admin.table("campaigns").update({"deadline": new_dt.date().isoformat()}).eq("id", camp_id).eq("user_id", user_id).execute()
                        await send_telegram_message(chat_id, f"📅 <b>Deadline Extended!</b>\n\nNew deadline is: <b>{new_dt.date().isoformat()}</b>")
                    except Exception as e:
                        logger.error("Failed to parse deadline to extend", error=str(e))
                        await send_telegram_message(chat_id, "❌ Couldn't parse the current deadline to extend it. Please update it in the dashboard.")
                else:
                    await send_telegram_message(chat_id, "❌ Couldn't find a deadline to extend.")
                return
            return # Ensure we stop processing for all callback queries

        # 4. Handle Quick Replies (Yes, Correct, Draft, No)
        if "text" in message:
            text_val = message["text"].strip()
            text_lower = text_val.lower()
            
            # Check for short confirmation intents
            if len(text_lower) < 20 and text_lower in ["yes", "correct", "y", "yep", "draft", "no", "wrong"]:
                recent_draft_resp = (
                    supabase_admin.table("campaigns")
                    .select("*")
                    .eq("user_id", user_id)
                    .eq("status", "draft")
                    .ilike("special_notes", "%[tg_update:%")
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute()
                )
                
                if recent_draft_resp.data:
                    draft = recent_draft_resp.data[0]
                    name = draft.get("influencer_name") or draft.get("influencer_handle") or "Unknown"
                    clean_name = html.escape(name)
                    
                    if text_lower in ["yes", "correct", "y", "yep"]:
                        supabase_admin.table("campaigns").update({"status": "active"}).eq("id", draft["id"]).execute()
                        await send_telegram_message(chat_id, f"✅ Done! The campaign for <b>{clean_name}</b> is now Active.")
                        return
                    elif text_lower == "draft":
                        await send_telegram_message(chat_id, f"📝 Saved! The campaign for <b>{clean_name}</b> will remain a Draft. You can edit it later in your dashboard.")
                        return
                    elif text_lower in ["no", "wrong"]:
                        await send_telegram_message(chat_id, f"Got it. The campaign for <b>{clean_name}</b> is saved as a Draft. Please edit the details manually in your Collabo dashboard.")
                        return

            # Check for inline corrections
            if len(text_val) < 200:
                corrections, unparsed_date = parse_corrections(text_val)
                if corrections or unparsed_date:
                    recent_draft_resp = (
                        supabase_admin.table("campaigns")
                        .select("*")
                        .eq("user_id", user_id)
                        .eq("status", "draft")
                        .ilike("special_notes", "%[tg_update:%")
                        .order("created_at", desc=True)
                        .limit(1)
                        .execute()
                    )
                    
                    if recent_draft_resp.data:
                        draft = recent_draft_resp.data[0]
                        if corrections:
                            supabase_admin.table("campaigns").update(corrections).eq("id", draft["id"]).execute()
                        
                        # Merge corrections into draft dict for immediate display
                        updated_draft = {**draft, **corrections}
                        
                        summary_msg = "🤖 <b>Got it! I've updated the details:</b>\n\n" + format_campaign_summary(updated_draft).replace("🤖 <b>I've extracted the following details:</b>\n\n", "")
                        
                        if unparsed_date:
                            summary_msg = f"⚠️ I couldn't understand the date '<b>{html.escape(unparsed_date)}</b>'. Please use a format like '15 July' or 'YYYY-MM-DD'.\n\n" + summary_msg
                            
                        await send_telegram_message(
                            chat_id, 
                            summary_msg
                        )
                        return

        # 4. Extract content (Text / Audio / Image)
        content_for_gemini = None

        if "text" in message:
            content_for_gemini = message["text"].strip()
            if not content_for_gemini:
                await send_telegram_message(chat_id, "🤖 <b>Collabo AI</b>\n\nPlease send me a text message, screenshot, or voice note.")
                return

        elif "voice" in message or "audio" in message:
            media = message.get("voice") or message.get("audio")
            file_id = media.get("file_id")
            if not file_id:
                await send_telegram_message(chat_id, "🤖 <b>Collabo AI</b>\n\n❌ Oops! I couldn't download that audio. Please try sending it again.")
                return
                
            await send_telegram_message(chat_id, "🤖 <b>Collabo AI</b>\n\nListening to your voice note... 🎧")
            audio_bytes = await download_telegram_media(file_id, max_bytes=_MAX_MEDIA_BYTES)
            
            if not audio_bytes:
                content_for_gemini = "Telegram audio download failed or exceeded size limits."
            else:
                content_for_gemini = {"audio_bytes": audio_bytes, "mime_type": media.get("mime_type", "audio/ogg")}

        elif "photo" in message:
            # Telegram sends an array of photo sizes. The last one is the largest.
            photos = message["photo"]
            if not photos:
                await send_telegram_message(chat_id, "🤖 <b>Collabo AI</b>\n\n❌ I couldn't download the image. Please try again.")
                return
                
            largest_photo = photos[-1]
            file_id = largest_photo.get("file_id")
            caption = message.get("caption", "")
            
            await send_telegram_message(chat_id, "🤖 <b>Collabo AI</b>\n\nReading the screenshot... 📸")
            image_bytes = await download_telegram_media(file_id, max_bytes=_MAX_MEDIA_BYTES)
            
            if not image_bytes:
                content_for_gemini = f"{caption}\n(Telegram image download failed or exceeded size limits.)".strip()
            else:
                content_for_gemini = {
                    "image_bytes": image_bytes,
                    "mime_type": "image/jpeg",
                    "caption": caption,
                }
        else:
            await send_telegram_message(chat_id, "🤖 <b>Collabo AI</b>\n\nI can't read this type of message yet. 😅\nPlease send text, voice notes, or screenshots.")
            return

        # 4. Process with Gemini AI
        if "text" in message:
            await send_telegram_message(chat_id, "🤖 <b>Collabo AI</b>\n\nExtracting campaign details... ✨")
        
        file_bytes = b""
        mime_type = "text/plain"
        
        if isinstance(content_for_gemini, str):
            file_bytes = content_for_gemini.encode('utf-8')
            mime_type = "text/plain"
        elif isinstance(content_for_gemini, dict):
            if "audio_bytes" in content_for_gemini:
                file_bytes = content_for_gemini["audio_bytes"]
                mime_type = content_for_gemini["mime_type"]
            elif "image_bytes" in content_for_gemini:
                file_bytes = content_for_gemini["image_bytes"]
                mime_type = content_for_gemini["mime_type"]
                if content_for_gemini.get("caption"):
                    file_bytes += b"\n" + content_for_gemini["caption"].encode('utf-8')
                    
        logger.info("Calling Gemini extraction", mime_type=mime_type)
        extracted_data = await extract_campaign_data(file_bytes=file_bytes, filename="telegram_input", mime_type=mime_type)
        logger.info("Gemini extraction complete", extracted_data=extracted_data)
        
        if extracted_data:
            try:
                supabase_admin.rpc("increment_ai_extractions", {"p_user_id": user_id}).execute()
            except Exception as e:
                logger.error("Failed to increment AI count via telegram webhook", error=str(e))

        # 5. Insert into Supabase
        campaign_data = {k: v for k, v in extracted_data.items() if k != "requires_human_review"}

        if not campaign_data.get("influencer_handle"):
            campaign_data["influencer_handle"] = "N/A"
        if not campaign_data.get("platform"):
            campaign_data["platform"] = "Others"

        if campaign_data.get("deadline") == "":
            campaign_data["deadline"] = None

        campaign_data["user_id"] = user_id
        campaign_data["status"] = "draft"

        # Embed update ID in special_notes for idempotency tracking
        if update_id:
            existing_notes = campaign_data.get("special_notes") or ""
            campaign_data["special_notes"] = f"{existing_notes} [tg_update:{update_id}]".strip()

        insert_response = supabase_admin.table("campaigns").insert(campaign_data).execute()

        if insert_response.data:
            inserted_campaign = insert_response.data[0]
            camp_id = inserted_campaign.get("id")
            logger.info("Campaign inserted successfully into DB", campaign_id=camp_id)
            
            summary = format_campaign_summary(
                inserted_campaign, 
                is_review=extracted_data.get("requires_human_review", False)
            )
            
            # Create interactive inline keyboard for the draft campaign
            reply_markup = {
                "inline_keyboard": [
                    [
                        {"text": "✅ Save as Active", "callback_data": f"camp_act:{camp_id}"},
                        {"text": "🗑️ Delete", "callback_data": f"camp_del:{camp_id}"}
                    ]
                ]
            }
            
            success = await send_telegram_message(chat_id, summary, reply_markup=reply_markup)
            logger.info("Sent summary message to user with buttons", success=success)
            
            influencer = inserted_campaign.get("influencer_name") or inserted_campaign.get("influencer_handle") or "Unknown"
            
            from app.services.notifications import create_notification
            if extracted_data.get("requires_human_review"):
                await create_notification(
                    service_client=supabase_admin,
                    user_id=user_id,
                    title="AI Extraction Needs Review",
                    message=f"Created a draft campaign for {influencer} from Telegram, but some details were missing.",
                    type="warning",
                    link_url="/dashboard"
                )
            else:
                await create_notification(
                    service_client=supabase_admin,
                    user_id=user_id,
                    title="AI Campaign Created",
                    message=f"Successfully created a campaign for {influencer} from your Telegram message.",
                    type="success",
                    link_url="/dashboard"
                )
        else:
            logger.error("Failed to insert campaign into DB", response_data=insert_response.data)
            await send_telegram_message(chat_id, "❌ Sorry, I failed to save the campaign to the database. Please try again or check the dashboard.")

    except Exception as e:
        logger.error("Telegram processing error", error=str(e), exc_info=True)
        # Log to DB so we can see it!
        if supabase_admin:
            try:
                supabase_admin.table("campaigns").insert({
                    "status": "draft",
                    "special_notes": f"CRASH: {str(e)}",
                    "influencer_name": "DEBUG CRASH TG",
                    "user_id": user_id if 'user_id' in locals() else None
                }).execute()
            except:
                pass
        
        if 'chat_id' in locals() and chat_id:
            await send_telegram_message(chat_id, "🤖 <b>Collabo AI</b>\n\n❌ Oops, my servers hit a snag while processing that message. Please try again!")

@router.post("/telegram")
@limiter.limit("200/minute")
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
