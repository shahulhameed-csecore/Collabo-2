import asyncio
import hmac
import hashlib
import structlog
import json
from fastapi import APIRouter, Request, HTTPException, Response, BackgroundTasks
import sentry_sdk
from app.core.config import settings
from app.core.limiter import limiter
from app.services.supabase import get_supabase_admin
from app.services.gemini import extract_campaign_data
from app.services.ai_manager import process_with_ai_manager, IntentType
from app.core.parsers import parse_corrections, parse_date_string
from app.core.formatters import format_single_campaign_summary, get_whatsapp_single_campaign_buttons, get_whatsapp_edit_menu
from app.services.intent_executor import execute_intent
from app.services.whatsapp import send_whatsapp_message, download_whatsapp_media

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/webhook", tags=["WhatsApp Webhook"])


# Maximum bytes we allow to be downloaded from WhatsApp media (16 MB)
_MAX_MEDIA_BYTES = 16 * 1024 * 1024

_message_buffer = {}
_batch_locks = set()

# Supabase service client (bypasses RLS) is lazily initialized via get_supabase_admin()


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
async def process_whatsapp_messages(sender_id: str, messages: list):
    """
    Inner logic for processing batched WhatsApp messages.
    """
    try:
        from app.core.limiter import is_webhook_rate_limited
        if is_webhook_rate_limited(sender_id):
            logger.warning(f"Rate limited WhatsApp webhook for {sender_id}")
            return

        logger.info("Started process_whatsapp_message", sender_id=sender_id)
        supabase_admin = await get_supabase_admin()
        if not supabase_admin:
            logger.error("Supabase Admin client not initialized.")
            return

        # 1. Deduplicate via webhook_events (only use the first message id for tracking)
        message_ids = [msg.get("id") for msg in messages if msg.get("id")]
        message_id = message_ids[-1] if message_ids else None
        if message_id:
            try:
                # Attempt to insert, if fails due to unique constraint, it's a duplicate
                res = await supabase_admin.table("webhook_events").insert({"message_id": message_id, "platform": "wa"}).execute()
            except Exception as e:
                # If constraint violation occurs, it means duplicate
                if "duplicate key value" in str(e).lower() or "unique constraint" in str(e).lower():
                    logger.info("Duplicate WhatsApp message ignored", msg_id=message_id)
                    return
                # otherwise just continue
        
        # 2. Number Matching
        clean_sender = "".join(filter(str.isdigit, sender_id))
        possible_numbers = [clean_sender, f"+{clean_sender}"]
        if clean_sender.startswith("91") and len(clean_sender) > 10:
            base = clean_sender[2:]
            possible_numbers.extend([base, f"0{base}", f"+91{base}"])
        elif clean_sender.startswith("1") and len(clean_sender) > 10:
            base = clean_sender[1:]
            possible_numbers.extend([base, f"+1{base}"])
        if len(clean_sender) == 10:
            possible_numbers.extend([f"91{clean_sender}", f"+91{clean_sender}"])
        possible_numbers = list(set(possible_numbers))

        user_response = await (supabase_admin.table("user_settings")
            .select("user_id, pending_action")
            .in_("whatsapp_number", possible_numbers)
            .execute()
        )

        if not user_response.data:
            unlinked_msg = (
                ("👋 *Hi! I'm Collabo AI.*\n\n" "I noticed your WhatsApp number isn't linked to a Collabo account yet.\n\n" "To start tracking campaigns automatically:\n" "1. Go to your Collabo dashboard 👉 *Settings*.\n" "2. Save this exact number.\n\n" "Once linked, you can forward me chats or voice notes and I'll do the rest! ✨")
            )
            await send_whatsapp_message(sender_id, unlinked_msg)
            return

        user_id = user_response.data[0]["user_id"]
        pending_action = user_response.data[0].get("pending_action")
        
        # Always use the first message in the batch to drive the main type logic
        message = messages[0]
        msg_type = message.get("type")

        # 3. Stage 1: Rules Engine (Hybrid Router)
        if msg_type == "interactive":
            interactive = message.get("interactive", {})
            inter_type = interactive.get("type")
            action_id = None
            if inter_type == "button_reply":
                action_id = interactive.get("button_reply", {}).get("id")
            elif inter_type == "list_reply":
                action_id = interactive.get("list_reply", {}).get("id")

            if action_id:
                if action_id == "cancel_ai_action":
                    await supabase_admin.table("user_settings").update({"pending_action": None}).eq("user_id", user_id).execute()
                    await send_whatsapp_message(sender_id, "❌ Action cancelled. You can start a new request.")
                    return
                elif action_id == "act_all":
                    # Activate all ready campaigns
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
                    
                    res_msg = "✅ *Campaign Results*\n\n"
                    if activated:
                        res_msg += "*Activated:*\n" + "\n".join([f"- {n}" for n in activated]) + "\n\n"
                    if skipped:
                        res_msg += "*Skipped (Pending Negotiation):*\n" + "\n".join([f"- {n}" for n in skipped]) + "\n"
                    if not activated and not skipped:
                        res_msg += "No campaigns ready to activate."
                        
                    await send_whatsapp_message(sender_id, res_msg)
                    return
                elif action_id.startswith("camp_edit:"):
                    camp_id = action_id.split(":")[1]
                    await send_whatsapp_message(sender_id, "", interactive=get_whatsapp_edit_menu(camp_id))
                    return
                elif action_id.startswith("act_camp:"):
                    camp_id = action_id.split(":")[1]
                    await supabase_admin.table("campaigns").update({"status": "active"}).eq("id", camp_id).execute()
                    await send_whatsapp_message(sender_id, "✅ Campaign Activated successfully.")
                    return
                elif action_id.startswith("del_camp:"):
                    camp_id = action_id.split(":")[1]
                    await supabase_admin.table("campaigns").delete().eq("id", camp_id).execute()
                    await send_whatsapp_message(sender_id, "🗑️ Campaign Deleted.")
                    return
                elif action_id.startswith("edit_field:"):
                    parts = action_id.split(":")
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
                    await send_whatsapp_message(sender_id, prompts.get(field, 'Enter the new value:'))
                    return

        elif msg_type == "text":
            text_val = message.get("text", {}).get("body", "").strip()
            text_lower = text_val.lower()
            
            # Check for pending edit
            pending_edit = pending_action
            if isinstance(pending_edit, dict) and pending_edit.get("action") == "edit":
                if text_lower == "cancel":
                    await supabase_admin.table("user_settings").update({"pending_action": None}).eq("user_id", user_id).execute()
                    await send_whatsapp_message(sender_id, "❌ Edit cancelled.")
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
                            # basic extraction of numbers
                            clean_val = text_val.lower().replace("k", "000").replace("l", "00000")
                            update_val = float(''.join(c for c in clean_val if c.isdigit() or c == '.'))
                        except:
                            pass
                    elif db_field == "deadline":
                        from app.core.parsers import parse_date_string
                        parsed_date = parse_date_string(text_val)
                        if parsed_date:
                            update_val = parsed_date
                        else:
                            await send_whatsapp_message(sender_id, f"❌ I couldn't understand that date. Please use formats like '12 Oct', 'Tomorrow', or 'DD/MM/YYYY'.")
                            return
                    
                    update_payload = {db_field: update_val}
                    if db_field == "influencer_name":
                        update_payload["influencer_handle"] = update_val  # satisfy constraint
                        
                    try:
                        await supabase_admin.table("campaigns").update(update_payload).eq("id", camp_id).execute()
                        await supabase_admin.table("user_settings").update({"pending_action": None}).eq("user_id", user_id).execute()
                        await send_whatsapp_message(sender_id, f"✅ Updated successfully!")
                    except Exception as e:
                        logger.error("Direct edit update failed", error=str(e))
                        await send_whatsapp_message(sender_id, f"❌ Failed to update. Please ensure the value is formatted correctly (e.g., Dates as DD/MM/YYYY).")
                return
            
            cached_obj = pending_action
            is_intent_pending = cached_obj and not isinstance(cached_obj, dict)
            
            # Exact matches for instant actions
            if not is_intent_pending and len(text_lower) < 20 and text_lower in ["yes", "y", "yep", "no", "wrong", "delete", "cancel", "pause", "activate"]:
                await send_whatsapp_message(sender_id, "🤖 Please use the interactive buttons (Activate, Edit, Delete) attached to the campaign summary to perform this action safely.")
                return

        # Prepare payload for AI Manager (Batch Support)
        content_for_gemini = ""
        media_items = []
        is_empty = True
        
        for msg in messages:
            m_type = msg.get("type")
            if m_type == "text":
                content_for_gemini += msg.get("text", {}).get("body", "").strip() + "\n"
                is_empty = False
            elif m_type == "audio":
                audio_id = msg.get("audio", {}).get("id")
                if audio_id:
                    await send_whatsapp_message(sender_id, "🎧 Listening to your voice note...")
                    audio_bytes = await download_whatsapp_media(audio_id, max_bytes=_MAX_MEDIA_BYTES)
                    if audio_bytes:
                        media_items.append({"bytes": audio_bytes, "mime_type": "audio/ogg"})
                        is_empty = False
            elif m_type == "image":
                image_id = msg.get("image", {}).get("id")
                if image_id:
                    await send_whatsapp_message(sender_id, "📸 Reading screenshot...")
                    image_bytes = await download_whatsapp_media(image_id, max_bytes=_MAX_MEDIA_BYTES)
                    if image_bytes:
                        media_items.append({"bytes": image_bytes, "mime_type": msg.get("image", {}).get("mime_type", "image/jpeg")})
                        if msg.get("image", {}).get("caption"):
                            content_for_gemini += msg.get("image", {}).get("caption", "") + "\n"
                        is_empty = False
            elif m_type == "document":
                document_id = msg.get("document", {}).get("id")
                if document_id:
                    await send_whatsapp_message(sender_id, "📄 Reading document...")
                    doc_bytes = await download_whatsapp_media(document_id, max_bytes=_MAX_MEDIA_BYTES)
                    if doc_bytes:
                        media_items.append({"bytes": doc_bytes, "mime_type": msg.get("document", {}).get("mime_type", "application/pdf")})
                        if msg.get("document", {}).get("caption"):
                            content_for_gemini += msg.get("document", {}).get("caption", "") + "\n"
                        is_empty = False
        
        content_for_gemini = content_for_gemini.strip()

        if is_empty:
            await send_whatsapp_message(sender_id, "🤖 Please send text, screenshots, or voice notes (max 16MB).")
            return
            
        # Check for pending clarification
        pending_clarif = pending_action
        if isinstance(pending_clarif, dict) and pending_clarif.get("action") == "clarification":
            original_msg = pending_clarif.get("original_msg", "")
            content_for_gemini = f"Previous Context: {original_msg}\n\nUser Clarification: {content_for_gemini}"
            await supabase_admin.table("user_settings").update({"pending_action": None}).eq("user_id", user_id).execute()
            await send_whatsapp_message(sender_id, "📝 Processing clarification...")
        elif not pending_action and (len(content_for_gemini) > 10 or media_items):
            await send_whatsapp_message(sender_id, "📝 Analyzing details...")

        # Fetch Context (Inbox/Most Recent)
        recent_campaigns = await (supabase_admin.table("campaigns")
            .select("id, influencer_name, status, payment_amount, deadline, deliverables")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(3)
            .execute()
        )
        context_str = json.dumps(recent_campaigns.data) if recent_campaigns.data else ""

        # 4. Stage 2: AI Intent Engine
        async def _thinking_indicator():
            try:
                await asyncio.sleep(3)
            except asyncio.CancelledError:
                pass
        
        indicator_task = asyncio.create_task(_thinking_indicator())

        file_bytes = b""
        mime_type = "text/plain"
        text_content = content_for_gemini

        intent_res = None
        if msg_type == "text" and pending_action and not isinstance(pending_action, dict):
            text_upper = message.get("text", {}).get("body", "").strip().upper()
            if text_upper in ["YES", "Y", "DELETE ALL", "ACTIVATE ALL", "PAUSE ALL", "UPDATE ALL"]:
                # Convert the dict back to IntentResponse model
                from app.services.ai_manager import IntentResponse
                intent_res = IntentResponse(**pending_action)
                await supabase_admin.table("user_settings").update({"pending_action": None}).eq("user_id", user_id).execute()

        if not intent_res:
            intent_res = await process_with_ai_manager(
                file_bytes=file_bytes, 
                mime_type=mime_type, 
                text_content=text_content, 
                context_str=context_str,
                media_items=media_items
            )
            
        if not intent_res:
            indicator_task.cancel()
            await send_whatsapp_message(sender_id, "I'm having trouble understanding that right now. Please try rephrasing or sending a shorter message.")
            return
        
        if intent_res.intent == IntentType.CLARIFICATION:
            original_text = text_content
            if not original_text and "text" in message:
                original_text = message["text"].strip() if isinstance(message.get("text"), str) else message.get("text", {}).get("body", "").strip()
            
            await supabase_admin.table("user_settings").update({
                "pending_action": {
                    "action": "clarification", 
                    "original_msg": str(original_text)
                }
            }).eq("user_id", user_id).execute()
        
        indicator_task.cancel()

        from app.core.formatters import format_single_campaign_summary
        from app.services.intent_executor import execute_intent

        def _get_cancel_interactive():
            return {
                "type": "button",
                "action": {
                    "buttons": [
                        {
                            "type": "reply",
                            "reply": {
                                "id": "cancel_ai_action",
                                "title": "❌ Cancel"
                            }
                        }
                    ]
                }
            }

        is_bulk_confirm = msg_type == "text" and message.get("text", {}).get("body", "").strip().upper() in ["YES", "Y", "DELETE ALL", "ACTIVATE ALL", "PAUSE ALL", "UPDATE ALL"]
        
        await execute_intent(
            intent_res=intent_res,
            user_id=user_id,
            target_id=sender_id,
            supabase_admin=supabase_admin,
            recent_campaigns_data=recent_campaigns.data,
            platform="wa",
            send_message_func=send_whatsapp_message,
            get_buttons_func=get_whatsapp_single_campaign_buttons,
            get_cancel_interactive_func=_get_cancel_interactive,
            is_bulk_confirm=is_bulk_confirm,
            
            message_id_str=f"wa_msg:{message_id}" if message_id else None
        )

    except Exception as e:
        logger.error("WhatsApp processing error", error=str(e), exc_info=True)
        await send_whatsapp_message(sender_id, "🤖 *Oops!* My servers hit a snag. Please try again.")

async def _process_batched_wrapper(sender_id: str):
    from app.core.redis import get_redis
    redis_client = get_redis()
    
    await asyncio.sleep(3) # Wait window for batching
    
    if redis_client:
        redis_key = f"wa_batch:{sender_id}"
        # Pop all items from the list atomically
        raw_messages = await redis_client.lrange(redis_key, 0, -1)
        await redis_client.delete(redis_key)
        
        if not raw_messages:
            return
            
        messages = [json.loads(m) for m in raw_messages]
    else:
        messages = _message_buffer.pop(sender_id, [])
        _batch_locks.discard(sender_id)
        if not messages:
            return
            
    await process_whatsapp_messages(sender_id, messages)

@router.post("/whatsapp")
async def meta_whatsapp_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Receives incoming WhatsApp messages via Meta Cloud API.
    Always returns 200 OK quickly; heavy work is offloaded to a background task.
    """
    payload_bytes = await request.body()
    signature_header = request.headers.get("X-Hub-Signature-256", "")
    
    # 1. Signature Verification
    if not verify_signature(payload_bytes, signature_header):
        logger.warning("Meta signature validation failed - unauthorized access attempt.")
        raise HTTPException(status_code=403, detail="Invalid signature")

    logger.info("Webhook signature verified successfully.")

    # 2. Payload parsing
    try:
        data = json.loads(payload_bytes)
    except (json.JSONDecodeError, ValueError):
        logger.error("Received validly signed webhook, but body is invalid JSON.")
        return Response(content="OK", status_code=200)

    if data.get("object") != "whatsapp_business_account":
        return Response(content="OK", status_code=200)

    # 3. Offload processing to background task to guarantee < 3s response time
    from app.core.redis import get_redis
    redis_client = get_redis()
    
    try:
        for entry in data.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                for message in value.get("messages", []):
                    sender_id = message.get("from", "")
                    logger.info("Queueing WhatsApp message to background", sender_id=sender_id, msg_id=message.get("id"))
                    
                    if message.get("type") == "interactive":
                        background_tasks.add_task(process_whatsapp_messages, sender_id, [message])
                    else:
                        if redis_client:
                            # Redis batching for horizontal scaling
                            redis_key = f"wa_batch:{sender_id}"
                            lock_key = f"wa_lock:{sender_id}"
                            
                            # Push message to list
                            await redis_client.rpush(redis_key, json.dumps(message))
                            # Set expiration on the list just in case (e.g. 5 minutes)
                            await redis_client.expire(redis_key, 300)
                            
                            # Try to acquire lock. NX=True means set ONLY if it doesn't exist
                            # EX=4 means lock expires automatically slightly after our 3s window
                            lock_acquired = await redis_client.set(lock_key, "1", ex=4, nx=True)
                            
                            if lock_acquired:
                                asyncio.create_task(_process_batched_wrapper(sender_id))
                        else:
                            # In-memory fallback
                            if sender_id not in _message_buffer:
                                _message_buffer[sender_id] = []
                            _message_buffer[sender_id].append(message)
                            
                            if sender_id not in _batch_locks:
                                _batch_locks.add(sender_id)
                                asyncio.create_task(_process_batched_wrapper(sender_id))
    except Exception as e:
        logger.error("Error queueing Meta webhook payload for processing", error=str(e))

    return Response(content="OK", status_code=200)
