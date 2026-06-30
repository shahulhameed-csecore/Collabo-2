import structlog
import json
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
        message = update.get("message") or update.get("channel_post")
        if not message:
            return # Ignore non-message updates (e.g., inline queries, callback queries)
            
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
                # We fetch all rows that have a telegram_username and check manually 
                # (or we could use a text search, but since it's a small scale SaaS we can do an ilike or just exact matches)
                user_response = (
                    supabase_admin.table("user_settings")
                    .select("user_id, telegram_username")
                    .not_("telegram_username", "is", "null")
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
                "👋 *Hi! I'm Collabo AI.*\n\n"
                "I noticed your Telegram account isn't linked to Collabo yet.\n\n"
                "To start tracking campaigns automatically:\n"
                f"1. Go to your Collabo dashboard 👉 *Settings*.\n"
                f"2. Save your Telegram username `{('@' + username) if username else 'YOUR_USERNAME'}`.\n\n"
                "Once linked, you can forward me influencer chats or voice notes and I'll do the rest! ✨"
            )
            success = await send_telegram_message(chat_id, unlinked_msg)
            logger.info("Sent unlinked message fallback", success=success)
            return

        logger.info("Matched user account", user_id=user_id)

        # 3. Extract content (Text / Audio / Image)
        content_for_gemini = None

        if "text" in message:
            content_for_gemini = message["text"].strip()
            if not content_for_gemini:
                await send_telegram_message(chat_id, "🤖 *Collabo AI*\n\nPlease send me a text message, screenshot, or voice note.")
                return

        elif "voice" in message or "audio" in message:
            media = message.get("voice") or message.get("audio")
            file_id = media.get("file_id")
            if not file_id:
                await send_telegram_message(chat_id, "🤖 *Collabo AI*\n\n❌ Oops! I couldn't download that audio. Please try sending it again.")
                return
                
            await send_telegram_message(chat_id, "🤖 *Collabo AI*\n\nListening to your voice note... 🎧")
            audio_bytes = await download_telegram_media(file_id, max_bytes=_MAX_MEDIA_BYTES)
            
            if not audio_bytes:
                content_for_gemini = "Telegram audio download failed or exceeded size limits."
            else:
                content_for_gemini = {"audio_bytes": audio_bytes, "mime_type": media.get("mime_type", "audio/ogg")}

        elif "photo" in message:
            # Telegram sends an array of photo sizes. The last one is the largest.
            photos = message["photo"]
            if not photos:
                await send_telegram_message(chat_id, "🤖 *Collabo AI*\n\n❌ I couldn't download the image. Please try again.")
                return
                
            largest_photo = photos[-1]
            file_id = largest_photo.get("file_id")
            caption = message.get("caption", "")
            
            await send_telegram_message(chat_id, "🤖 *Collabo AI*\n\nReading the screenshot... 📸")
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
            await send_telegram_message(chat_id, "🤖 *Collabo AI*\n\nI can't read this type of message yet. 😅\nPlease send text, voice notes, or screenshots.")
            return

        # 4. Process with Gemini AI
        if "text" in message:
            await send_telegram_message(chat_id, "🤖 *Collabo AI*\n\nExtracting campaign details... ✨")
        
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

        if extracted_data.get("requires_human_review"):
            await send_telegram_message(
                chat_id,
                "🤖 *Collabo AI*\n\n⚠️ Some details were unclear to me (like the exact price or dates). I've created a *Draft* campaign for you to review in the dashboard.",
            )

        # 5. Insert into Supabase
        campaign_data = {k: v for k, v in extracted_data.items() if k != "requires_human_review"}

        if not campaign_data.get("influencer_handle"):
            campaign_data["influencer_handle"] = campaign_data.get("influencer_name") or "Unknown Influencer"
        if not campaign_data.get("platform"):
            campaign_data["platform"] = "Others"

        campaign_data["user_id"] = user_id
        campaign_data["status"] = "draft"

        # Embed update ID in special_notes for idempotency tracking
        if update_id:
            existing_notes = campaign_data.get("special_notes") or ""
            campaign_data["special_notes"] = f"{existing_notes} [tg_update:{update_id}]".strip()

        insert_response = supabase_admin.table("campaigns").insert(campaign_data).execute()

        if insert_response.data:
            logger.info("Campaign inserted successfully into DB", campaign_id=insert_response.data[0].get("id"))
            influencer = extracted_data.get("influencer_handle") or extracted_data.get("influencer_name") or "Unknown"
            
            # Escape markdown for telegram
            clean_influencer = influencer.replace("*", "").replace("_", "").replace("`", "")
            
            success = await send_telegram_message(
                chat_id, f"✅ Success! Campaign created for *{clean_influencer}*.\n\nIt is now safely tracked in your Collabo dashboard."
            )
            logger.info("Sent success message to user", success=success)
            
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
            await send_telegram_message(chat_id, "🤖 *Collabo AI*\n\n❌ Oops, my servers hit a snag while processing that message. Please try again!")

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
