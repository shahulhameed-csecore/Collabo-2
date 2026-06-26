import hmac
import hashlib
import logging
import json
from fastapi import APIRouter, Request, HTTPException, Response, BackgroundTasks
from app.core.config import settings
from app.core.limiter import limiter
from supabase import create_client
from app.services.gemini import extract_campaign_data
from app.services.whatsapp import send_whatsapp_message, download_whatsapp_media

logger = logging.getLogger(__name__)

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
        # Secret not configured — deny all requests to prevent abuse
        logger.warning("WHATSAPP_APP_SECRET is not set. Rejecting webhook request.")
        return False

    if not signature_header:
        return False

    # Signature looks like "sha256=<hex_digest>"
    parts = signature_header.split("=", 1)
    if len(parts) != 2 or parts[0] != "sha256":
        return False

    expected_sig = hmac.new(
        settings.WHATSAPP_APP_SECRET.encode("utf-8"),
        msg=payload,
        digestmod=hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected_sig, parts[1])


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


async def process_whatsapp_message(sender_id: str, message: dict):
    """
    Background task to process the incoming WhatsApp message.
    Looks up the user, calls Gemini AI, and inserts a campaign into Supabase.
    """
    try:
        # 1. Require admin client
        if not supabase_admin:
            logger.error("Supabase Admin client not initialized — SERVICE_ROLE_KEY missing.")
            await send_whatsapp_message(
                sender_id, "System configuration error. Please contact support."
            )
            return

        # 2. Deduplicate using message ID (prevent double-processing Meta retries)
        message_id = message.get("id")
        if message_id:
            try:
                existing = (
                    supabase_admin.table("campaigns")
                    .select("id")
                    .eq("special_notes", f"[wa_msg:{message_id}]")
                    .limit(1)
                    .execute()
                )
                if existing.data:
                    logger.info("Duplicate WhatsApp message ignored", message_id=message_id)
                    return
            except Exception:
                pass  # Non-critical; proceed to process

        # 3. Lookup user by WhatsApp number
        clean_number = "".join(filter(str.isdigit, sender_id))
        
        # Generate possible variations of the number
        possible_numbers = [clean_number]
        # If it looks like it has a country code (e.g. 11-13 digits)
        if len(clean_number) > 10:
            # Fallback to last 10 digits
            possible_numbers.append(clean_number[-10:])
        # If it is exactly 10 digits, maybe they stored it with 91 prefix
        elif len(clean_number) == 10:
            possible_numbers.append("91" + clean_number)
            
        user_response = (
            supabase_admin.table("user_settings")
            .select("user_id")
            .in_("whatsapp_number", possible_numbers)
            .execute()
        )

        if not user_response.data:
            unlinked_msg = (
                "Hello! 👋 I am the *Collabo Assistant* 🤖.\n\n"
                "Your WhatsApp number is not linked to any active Collabo account.\n\n"
                "To fix this:\n"
                "1. Log in to your Collabo dashboard.\n"
                "2. Go to *Settings*.\n"
                "3. Enter and save this phone number.\n\n"
                "Once linked, you can forward me any influencer chats to instantly create campaigns!"
            )
            await send_whatsapp_message(sender_id, unlinked_msg)
            return

        user_id = user_response.data[0]["user_id"]

        # 4. Extract content (Text / Audio / Image)
        msg_type = message.get("type")
        content_for_gemini = None

        if msg_type == "text":
            content_for_gemini = message.get("text", {}).get("body", "").strip()
            if not content_for_gemini:
                await send_whatsapp_message(
                    sender_id,
                    "Collabo Assistant 🤖\n\nPlease forward a text message or voice note containing the deal terms.",
                )
                return

        elif msg_type == "audio":
            audio_id = message.get("audio", {}).get("id")
            if not audio_id:
                await send_whatsapp_message(
                    sender_id,
                    "Collabo Assistant 🤖\n\n❌ Could not retrieve voice note ID. Please try again.",
                )
                return
            await send_whatsapp_message(sender_id, "Collabo Assistant 🤖\n\nDownloading your voice note... 🎧")
            audio_bytes = await download_whatsapp_media(audio_id, max_bytes=_MAX_MEDIA_BYTES)
            if not audio_bytes:
                await send_whatsapp_message(
                    sender_id,
                    "Collabo Assistant 🤖\n\n❌ Failed to download the voice note. Please try again or send a text message.",
                )
                return
            content_for_gemini = {"audio_bytes": audio_bytes, "mime_type": "audio/ogg"}

        elif msg_type == "image":
            image_id = message.get("image", {}).get("id")
            caption = message.get("image", {}).get("caption", "")
            if not image_id:
                await send_whatsapp_message(
                    sender_id, "Collabo Assistant 🤖\n\n❌ Could not retrieve image ID."
                )
                return
            await send_whatsapp_message(sender_id, "Collabo Assistant 🤖\n\nAnalyzing your image... 🖼️")
            image_bytes = await download_whatsapp_media(image_id, max_bytes=_MAX_MEDIA_BYTES)
            if not image_bytes:
                await send_whatsapp_message(
                    sender_id,
                    "Collabo Assistant 🤖\n\n❌ Failed to download the image. Please try again.",
                )
                return
            content_for_gemini = {
                "image_bytes": image_bytes,
                "mime_type": message.get("image", {}).get("mime_type", "image/jpeg"),
                "caption": caption,
            }

        else:
            # Sanitize msg_type before echoing — do not reflect attacker-controlled strings
            safe_type = str(msg_type)[:32] if msg_type else "unknown"
            await send_whatsapp_message(
                sender_id,
                f"Collabo Assistant 🤖\n\nUnsupported message type: {safe_type}.\nPlease send text, voice notes, or images.",
            )
            return

        # 5. Process with Gemini AI
        await send_whatsapp_message(sender_id, "Collabo Assistant 🤖\n\nProcessing your campaign details... ✨")
        
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
                # We append the caption as text if it exists
                if content_for_gemini.get("caption"):
                    file_bytes += b"\n" + content_for_gemini["caption"].encode('utf-8')
                    
        extracted_data = await extract_campaign_data(file_bytes=file_bytes, filename="whatsapp_input", mime_type=mime_type)
        if extracted_data:
            try:
                supabase_admin.rpc("increment_ai_extractions", {"p_user_id": user_id}).execute()
            except Exception as e:
                logger.error("Failed to increment AI count via whatsapp webhook", error=str(e))

        if extracted_data.get("requires_human_review"):
            await send_whatsapp_message(
                sender_id,
                "Collabo Assistant 🤖\n\n⚠️ Some fields were missing or unclear. Creating a Draft campaign for you to review.",
            )

        # 6. Insert into Supabase
        campaign_data = {k: v for k, v in extracted_data.items() if k != "requires_human_review"}

        if not campaign_data.get("influencer_handle"):
            campaign_data["influencer_handle"] = campaign_data.get("influencer_name") or "Unknown"
        if not campaign_data.get("platform"):
            campaign_data["platform"] = "Others"

        campaign_data["user_id"] = user_id
        campaign_data["status"] = "draft"

        # Embed message ID in special_notes for idempotency tracking
        if message_id:
            existing_notes = campaign_data.get("special_notes") or ""
            campaign_data["special_notes"] = f"{existing_notes} [wa_msg:{message_id}]".strip()

        insert_response = supabase_admin.table("campaigns").insert(campaign_data).execute()

        if insert_response.data:
            influencer = extracted_data.get("influencer_handle") or extracted_data.get("influencer_name") or "Unknown"
            await send_whatsapp_message(
                sender_id, f"✅ Campaign created for *{influencer}*!\n\nCheck your dashboard."
            )
        else:
            await send_whatsapp_message(
                sender_id, "❌ Failed to save the campaign. Please try again."
            )

    except Exception as e:
        logger.error("WhatsApp processing error", error=str(e), exc_info=True)
        await send_whatsapp_message(
            sender_id, "❌ Could not understand the message. Please try forwarding again."
        )


@router.post("/whatsapp")
@limiter.limit("100/minute")
async def meta_whatsapp_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Receives incoming WhatsApp messages via Meta Cloud API.
    Always returns 200 quickly; heavy work is offloaded to a background task.
    """
    payload_bytes = await request.body()
    signature_header = request.headers.get("X-Hub-Signature-256", "")

    # Signature ALWAYS verified regardless of environment.
    # If secret is not configured, all requests are rejected (safe default).
    if not verify_signature(payload_bytes, signature_header):
        logger.warning("Meta signature validation failed")
        raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        data = json.loads(payload_bytes)
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid JSON")

    if data.get("object") != "whatsapp_business_account":
        return Response(status_code=404)

    try:
        for entry in data.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                for message in value.get("messages", []):
                    sender_id = message.get("from", "")
                    # Offload processing so we return 200 within Meta's 3-second window
                    background_tasks.add_task(process_whatsapp_message, sender_id, message)
    except Exception as e:
        logger.error("Error parsing Meta webhook payload", error=str(e))

    return Response(content="OK", status_code=200)
