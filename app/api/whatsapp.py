import hmac
import hashlib
import structlog
import json
from fastapi import APIRouter, Request, HTTPException, Response, BackgroundTasks
import sentry_sdk
from app.core.config import settings
from app.core.limiter import limiter
from supabase import create_client
from app.services.gemini import extract_campaign_data
from app.core.utils import parse_corrections, format_campaign_summary_wa, parse_date_string
from app.services.whatsapp import send_whatsapp_message, download_whatsapp_media

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/webhook", tags=["WhatsApp Webhook"])

# Maximum bytes we allow to be downloaded from WhatsApp media (16 MB)
_MAX_MEDIA_BYTES = 16 * 1024 * 1024

# Initialize Supabase service client (bypasses RLS) — for webhook inserts
supabase_admin = None
if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
    supabase_admin = create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_ROLE_KEY,
    )


def verify_signature(payload: bytes, signature_header: str) -> bool:
    """
    Validates the X-Hub-Signature-256 header sent by Meta.
    Returns False if the secret is not configured OR signature is wrong.
    """
    if not settings.WHATSAPP_APP_SECRET:
        logger.warning("WHATSAPP_APP_SECRET is not set. Rejecting webhook request.")
        return False

    if not signature_header:
        return False

    parts = signature_header.split("=", 1)
    if len(parts) != 2 or parts[0] != "sha256":
        return False

    expected_sig = hmac.new(
        settings.WHATSAPP_APP_SECRET.encode("utf-8"),
        msg=payload,
        digestmod=hashlib.sha256,
    ).hexdigest()

    is_valid = hmac.compare_digest(expected_sig, parts[1])
    if not is_valid:
        logger.warning(f"Signature mismatch. Expected: {expected_sig}, Got: {parts[1]}")
    return is_valid


@router.get("/whatsapp")
async def verify_webhook(request: Request):
    """
    Required by Meta to verify the webhook URL during registration.
    """
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    if not mode or not token:
        raise HTTPException(status_code=400, detail="Missing parameters")

    if mode == "subscribe" and token == settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN:
        return Response(content=challenge, status_code=200)

    raise HTTPException(status_code=403, detail="Verification failed")


@sentry_sdk.trace(op="webhook", name="Process WhatsApp Message")
async def process_whatsapp_message(sender_id: str, message: dict):
    """
    Background task to process the incoming WhatsApp message.
    Looks up the user, calls Gemini AI, and inserts a campaign into Supabase.
    """
    try:
        logger.info("Started process_whatsapp_message", sender_id=sender_id)
        if not supabase_admin:
            logger.error("Supabase Admin client not initialized — SERVICE_ROLE_KEY missing.")
            return

        # 1. Deduplicate using message ID (prevent double-processing Meta retries)
        message_id = message.get("id")
        if message_id:
            try:
                existing = (
                    supabase_admin.table("campaigns")
                    .select("id")
                    .ilike("special_notes", f"%[wa_msg:{message_id}]%")
                    .limit(1)
                    .execute()
                )
                if existing.data:
                    logger.info("Duplicate WhatsApp message ignored", message_id=message_id)
                    return
            except Exception:
                pass  # Non-critical; proceed to process

        # 2. Bulletproof Number Matching (Handles international, +91, 0, and local formats)
        clean_sender = "".join(filter(str.isdigit, sender_id))
        possible_numbers = [clean_sender, f"+{clean_sender}"]
        
        # Handle India specific formats
        if clean_sender.startswith("91") and len(clean_sender) > 10:
            base = clean_sender[2:]
            possible_numbers.extend([base, f"0{base}", f"+91{base}"])
        # Handle US specific formats (often used for Test Numbers)
        elif clean_sender.startswith("1") and len(clean_sender) > 10:
            base = clean_sender[1:]
            possible_numbers.extend([base, f"+1{base}"])
            
        if len(clean_sender) == 10:
            possible_numbers.extend([f"91{clean_sender}", f"+91{clean_sender}"])
            
        possible_numbers = list(set(possible_numbers)) # Remove duplicates

        user_response = (
            supabase_admin.table("user_settings")
            .select("user_id")
            .in_("whatsapp_number", possible_numbers)
            .execute()
        )

        if not user_response.data:
            logger.warning("No linked Collabo account found for number", possible_numbers=possible_numbers)
            unlinked_msg = (
                "👋 *Hi! I'm Collabo AI.*\n\n"
                "I noticed your WhatsApp number isn't linked to a Collabo account yet.\n\n"
                "To start tracking campaigns automatically:\n"
                "1. Go to your Collabo dashboard 👉 *Settings*.\n"
                "2. Save this exact number.\n\n"
                "Once linked, you can forward me influencer chats or voice notes and I'll do the rest! ✨"
            )
            success = await send_whatsapp_message(sender_id, unlinked_msg)
            logger.info("Sent unlinked message fallback", success=success)
            return

        user_id = user_response.data[0]["user_id"]
        logger.info("Matched user account", user_id=user_id)

        msg_type = message.get("type")
        content_for_gemini = None

        # 3. Handle Quick Replies (Yes, Draft, No) & Corrections
        if msg_type == "text":
            text_val = message.get("text", {}).get("body", "").strip()
            text_lower = text_val.lower()
            
            # Check for short confirmation intents
            if len(text_lower) < 20 and text_lower in ["yes", "correct", "y", "yep", "draft", "no", "wrong"]:
                recent_draft_resp = (
                    supabase_admin.table("campaigns")
                    .select("*")
                    .eq("user_id", user_id)
                    .eq("status", "draft")
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute()
                )
                
                if recent_draft_resp.data:
                    draft = recent_draft_resp.data[0]
                    name = draft.get("influencer_name") or draft.get("influencer_handle") or "Unknown"
                    
                    if text_lower in ["yes", "correct", "y", "yep"]:
                        supabase_admin.table("campaigns").update({"status": "active"}).eq("id", draft["id"]).execute()
                        await send_whatsapp_message(sender_id, f"✅ Done! The campaign for *{name}* is now Active.")
                        return
                    elif text_lower == "draft":
                        await send_whatsapp_message(sender_id, f"📝 Saved! The campaign for *{name}* will remain a Draft. You can edit it later in your dashboard.")
                        return
                    elif text_lower in ["no", "wrong"]:
                        await send_whatsapp_message(sender_id, f"Got it. The campaign for *{name}* is saved as a Draft. Please edit the details manually in your Collabo dashboard.")
                        return
                else:
                    await send_whatsapp_message(sender_id, "❌ I couldn't find a recent Draft to confirm. It might already be Active or Deleted. You can create a new one by sending me the influencer details.")
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
                        .order("created_at", desc=True)
                        .limit(1)
                        .execute()
                    )
                    
                    if recent_draft_resp.data:
                        draft = recent_draft_resp.data[0]
                        if corrections:
                            supabase_admin.table("campaigns").update(corrections).eq("id", draft["id"]).execute()
                        
                        updated_draft = {**draft, **corrections}
                    else:
                        campaign_data = {
                            "user_id": user_id,
                            "status": "draft",
                            "influencer_handle": "N/A",
                            "platform": "Other",
                            "special_notes": f"[wa_msg:{message_id}]" if message_id else ""
                        }
                        if corrections:
                            campaign_data.update(corrections)
                        
                        insert_response = supabase_admin.table("campaigns").insert(campaign_data).execute()
                        if insert_response.data:
                            updated_draft = insert_response.data[0]
                        else:
                            await send_whatsapp_message(sender_id, "❌ I couldn't find a recent draft, and failed to create a new one. Please try again.")
                            return
                        
                    base_summary = format_campaign_summary_wa(updated_draft)
                    base_summary = base_summary.replace("🤖 *I've extracted the following details:*\n\n", "")
                    base_summary = base_summary.replace("🤖 *Collabo AI*\n\n⚠️ Some details were unclear to me. I've created a *Draft*.\n\n", "")
                    summary_msg = "🤖 *Got it! I've updated the details:*\n\n" + base_summary if recent_draft_resp.data else "🤖 *Got it! I've created a new Draft with these details:*\n\n" + base_summary
                    
                    if unparsed_date:
                        summary_msg = f"⚠️ I couldn't understand the date '*{unparsed_date}*'. Please use a format like '15 July' or 'YYYY-MM-DD'.\n\n" + summary_msg
                        
                    await send_whatsapp_message(sender_id, summary_msg)
                    return
                        
            content_for_gemini = text_val
            if not content_for_gemini:
                await send_whatsapp_message(
                    sender_id,
                    "🤖 *Collabo AI*\n\nPlease send me a text message, screenshot, or voice note containing the influencer campaign terms.",
                )
                return

        elif msg_type == "audio":
            audio_id = message.get("audio", {}).get("id")
            if not audio_id:
                await send_whatsapp_message(
                    sender_id,
                    "🤖 *Collabo AI*\n\n❌ Oops! I couldn't download that voice note. Meta might be processing it. Please try sending it again.",
                )
                return
            await send_whatsapp_message(sender_id, "🤖 *Collabo AI*\n\nListening to your voice note... 🎧")
            audio_bytes = await download_whatsapp_media(audio_id, max_bytes=_MAX_MEDIA_BYTES)
            if not audio_bytes:
                content_for_gemini = "WhatsApp audio download failed or exceeded size limits."
            else:
                content_for_gemini = {"audio_bytes": audio_bytes, "mime_type": "audio/ogg"}

        elif msg_type == "image":
            image_id = message.get("image", {}).get("id")
            caption = message.get("image", {}).get("caption", "")
            if not image_id:
                await send_whatsapp_message(
                    sender_id, "🤖 *Collabo AI*\n\n❌ I couldn't download the image. Please try again."
                )
                return
            await send_whatsapp_message(sender_id, "🤖 *Collabo AI*\n\nReading the screenshot... 📸")
            image_bytes = await download_whatsapp_media(image_id, max_bytes=_MAX_MEDIA_BYTES)
            if not image_bytes:
                content_for_gemini = f"{caption}\n(WhatsApp image download failed or exceeded size limits.)".strip()
            else:
                content_for_gemini = {
                    "image_bytes": image_bytes,
                    "mime_type": message.get("image", {}).get("mime_type", "image/jpeg"),
                    "caption": caption,
                }

        elif msg_type == "document":
            document = message.get("document", {})
            document_id = document.get("id")
            filename = document.get("filename", "document")
            mime_type = document.get("mime_type", "application/pdf")
            caption = document.get("caption", "")
            
            if not document_id:
                await send_whatsapp_message(
                    sender_id, "🤖 *Collabo AI*\n\n❌ I couldn't download the document. Please try again."
                )
                return
                
            await send_whatsapp_message(sender_id, "🤖 *Collabo AI*\n\nReading your document... 📄")
            doc_bytes = await download_whatsapp_media(document_id, max_bytes=_MAX_MEDIA_BYTES)
            
            if not doc_bytes:
                content_for_gemini = f"{caption}\n(WhatsApp document download failed or exceeded size limits.)".strip()
            else:
                content_for_gemini = {
                    "document_bytes": doc_bytes,
                    "mime_type": mime_type,
                    "filename": filename,
                    "caption": caption,
                }

        else:
            safe_type = str(msg_type)[:32] if msg_type else "unknown"
            await send_whatsapp_message(
                sender_id,
                f"🤖 *Collabo AI*\n\nI can't read _{safe_type}_ messages yet. 😅\nPlease send text, voice notes, or screenshots of the chat.",
            )
            return

        # 4. Process with Gemini AI
        if msg_type == "text":
            await send_whatsapp_message(sender_id, "🤖 *Collabo AI*\n\nExtracting campaign details... ✨")
        
        file_bytes = b""
        mime_type = "text/plain"
        filename = "message.txt"
        caption_text = ""
        
        if isinstance(content_for_gemini, str):
            file_bytes = content_for_gemini.encode('utf-8')
            mime_type = "text/plain"
        elif isinstance(content_for_gemini, dict):
            if "audio_bytes" in content_for_gemini:
                file_bytes = content_for_gemini["audio_bytes"]
                mime_type = content_for_gemini["mime_type"]
                filename = "audio.ogg"
            elif "image_bytes" in content_for_gemini:
                file_bytes = content_for_gemini["image_bytes"]
                mime_type = content_for_gemini["mime_type"]
                filename = "image.jpg"
                caption_text = content_for_gemini.get("caption", "")
            elif "document_bytes" in content_for_gemini:
                file_bytes = content_for_gemini["document_bytes"]
                mime_type = content_for_gemini["mime_type"]
                filename = content_for_gemini["filename"]
                caption_text = content_for_gemini.get("caption", "")
                    
        logger.info("Calling Gemini extraction", mime_type=mime_type)
        extracted_data = await extract_campaign_data(
            file_bytes=file_bytes, 
            filename=filename, 
            mime_type=mime_type,
            text_content=caption_text
        )
        logger.info("Gemini extraction complete", extracted_data=extracted_data)
        
        if extracted_data:
            try:
                supabase_admin.rpc("increment_ai_extractions", {"p_user_id": user_id}).execute()
            except Exception as e:
                logger.error("Failed to increment AI count via whatsapp webhook", error=str(e))

        # 5. Insert into Supabase
        campaign_data = {k: v for k, v in extracted_data.items() if k != "requires_human_review"}

        if not campaign_data.get("influencer_handle"):
            campaign_data["influencer_handle"] = "N/A"
        if not campaign_data.get("platform") or campaign_data.get("platform") == "Other":
            campaign_data["platform"] = "Others"

        # Sanitize Date Formatting to prevent Postgres crashes
        raw_deadline = campaign_data.get("deadline")
        if raw_deadline and str(raw_deadline).strip():
            parsed_deadline = parse_date_string(str(raw_deadline))
            if parsed_deadline:
                campaign_data["deadline"] = parsed_deadline
            else:
                campaign_data["deadline"] = None
                extracted_data["requires_human_review"] = True
                existing_notes = campaign_data.get("special_notes") or ""
                campaign_data["special_notes"] = f"{existing_notes}\n(Note: Couldn't parse deadline '{raw_deadline}')".strip()
        else:
            campaign_data["deadline"] = None

        # Sanitize Payment Amount
        try:
            campaign_data["payment_amount"] = float(campaign_data.get("payment_amount") or 0.0)
            if campaign_data["payment_amount"] < 0:
                campaign_data["payment_amount"] = 0.0
        except ValueError:
            campaign_data["payment_amount"] = 0.0
            extracted_data["requires_human_review"] = True

        campaign_data["user_id"] = user_id
        
        extracted_status = campaign_data.get("status")
        if extracted_status not in ["active", "draft", "completed", "cancelled"]:
            campaign_data["status"] = "draft"
            
        # If extraction is partial/needs review, force it to Draft to prevent invalid Active campaigns
        if extracted_data.get("requires_human_review"):
            campaign_data["status"] = "draft"

        # Embed message ID in special_notes for idempotency tracking
        if message_id:
            existing_notes = campaign_data.get("special_notes") or ""
            campaign_data["special_notes"] = f"{existing_notes} [wa_msg:{message_id}]".strip()

        insert_response = supabase_admin.table("campaigns").insert(campaign_data).execute()

        if insert_response.data:
            inserted_campaign = insert_response.data[0]
            logger.info("Campaign inserted successfully into DB", campaign_id=inserted_campaign.get("id"))
            
            summary = format_campaign_summary_wa(
                inserted_campaign, 
                is_review=extracted_data.get("requires_human_review", False)
            )
            
            success = await send_whatsapp_message(sender_id, summary)
            logger.info("Sent summary message to user", success=success)
            
            influencer = inserted_campaign.get("influencer_name") or inserted_campaign.get("influencer_handle") or "Unknown"
            from app.services.notifications import create_notification
            if extracted_data.get("requires_human_review"):
                await create_notification(
                    service_client=supabase_admin,
                    user_id=user_id,
                    title="AI Extraction Needs Review",
                    message=f"Created a draft campaign for {influencer} from WhatsApp, but some details were missing.",
                    type="warning",
                    link_url="/dashboard"
                )
            else:
                await create_notification(
                    service_client=supabase_admin,
                    user_id=user_id,
                    title="AI Campaign Created",
                    message=f"Successfully created a campaign for {influencer} from your WhatsApp message.",
                    type="success",
                    link_url="/dashboard"
                )
        else:
            logger.error("Failed to insert campaign into DB", response_data=insert_response.data)
            await send_whatsapp_message(
                sender_id, "❌ Sorry, I failed to save the campaign to the database. Please try again or check the dashboard."
            )

    except Exception as e:
        sentry_sdk.capture_exception(e)
        logger.error("WhatsApp processing error", error=str(e), exc_info=True)
        # Log to DB so we can see it!
        if supabase_admin:
            try:
                supabase_admin.table("campaigns").insert({
                    "status": "draft",
                    "special_notes": f"CRASH: {str(e)}",
                    "influencer_name": "DEBUG CRASH WA",
                    "user_id": user_id if 'user_id' in locals() else None
                }).execute()
            except:
                pass
        
        if 'sender_id' in locals() and sender_id:
            await send_whatsapp_message(
                sender_id, "🤖 *Collabo AI*\n\n❌ Oops, my servers hit a snag while processing that message. Please try again!"
            )

@router.post("/whatsapp")
@limiter.limit("200/minute")
async def meta_whatsapp_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Receives incoming WhatsApp messages via Meta Cloud API.
    Always returns 200 OK quickly; heavy work is offloaded to a background task.
    """
    payload_bytes = await request.body()
    signature_header = request.headers.get("X-Hub-Signature-256", "")
    
    # 1. Signature Verification
    # If signature is wrong, we reject with 403. This stops random scanners.
    if not verify_signature(payload_bytes, signature_header):
        logger.warning("Meta signature validation failed - unauthorized access attempt.")
        raise HTTPException(status_code=403, detail="Invalid signature")

    logger.info("Webhook signature verified successfully.")

    # 2. Payload parsing
    # Meta requires a 200 OK for ALL validly signed webhooks, even if we can't parse it.
    try:
        data = json.loads(payload_bytes)
    except (json.JSONDecodeError, ValueError):
        logger.error("Received validly signed webhook, but body is invalid JSON.")
        return Response(content="OK", status_code=200)

    if data.get("object") != "whatsapp_business_account":
        return Response(content="OK", status_code=200)

    # 3. Offload processing to background task to guarantee < 3s response time
    try:
        for entry in data.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                for message in value.get("messages", []):
                    sender_id = message.get("from", "")
                    logger.info("Queueing WhatsApp message to background", sender_id=sender_id, msg_id=message.get("id"))
                    # Send to background task
                    background_tasks.add_task(process_whatsapp_message, sender_id, message)
    except Exception as e:
        logger.error("Error queueing Meta webhook payload for processing", error=str(e))

    return Response(content="OK", status_code=200)
