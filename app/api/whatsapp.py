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
from app.core.formatters import format_grouped_campaign_summary, get_whatsapp_campaign_buttons, get_whatsapp_edit_menu, get_whatsapp_options_menu
from app.services.whatsapp import send_whatsapp_message, download_whatsapp_media

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/webhook", tags=["WhatsApp Webhook"])

# Maximum bytes we allow to be downloaded from WhatsApp media (16 MB)
_MAX_MEDIA_BYTES = 16 * 1024 * 1024

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
async def process_whatsapp_message(sender_id: str, message: dict):
    """
    Background task to process the incoming WhatsApp message.
    Looks up the user, routes through Stage 1 Rules or Stage 2 AI, and manages context.
    """
    try:
        logger.info("Started process_whatsapp_message", sender_id=sender_id)
        supabase_admin = await get_supabase_admin()
        if not supabase_admin:
            logger.error("Supabase Admin client not initialized.")
            return

        # 1. Deduplicate
        message_id = message.get("id")
        if message_id:
            try:
                safe_message_id = message_id.replace("%", "\\%").replace("_", "\\_")
                existing = await (supabase_admin.table("campaigns")
                    .select("id")
                    .ilike("special_notes", f"%[wa_msg:{safe_message_id}]%")
                    .limit(1)
                    .execute()
                )
                if existing.data:
                    logger.info("Duplicate WhatsApp message ignored")
                    return
            except Exception:
                pass

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
            .select("user_id")
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
                if action_id == "act_all":
                    # Activate all ready campaigns
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
                    
                    res_msg = "✅ *Campaign Results*\n\n"
                    if activated:
                        res_msg += "*Activated:*\n" + "\n".join([f"- {n}" for n in activated]) + "\n\n"
                    if skipped:
                        res_msg += "*Skipped (Pending Negotiation):*\n" + "\n".join([f"- {n}" for n in skipped]) + "\n"
                    if not activated and not skipped:
                        res_msg += "No campaigns ready to activate."
                        
                    await send_whatsapp_message(sender_id, res_msg)
                    return
                elif action_id == "camp_edit":
                    await send_whatsapp_message(sender_id, "", interactive=get_whatsapp_edit_menu())
                    return
                elif action_id == "opts_menu":
                    await send_whatsapp_message(sender_id, "", interactive=get_whatsapp_options_menu())
                    return
                elif action_id.startswith("edit_field:"):
                    field = action_id.split(":")[1]
                    prompts = {
                        "payment": "Enter the new payment amount.\n\nExamples:\n30000\n25k\n1.2L",
                        "deadline": "Enter the new deadline.\n\nExamples:\n20 October\nTomorrow\nNext Friday",
                        "deliverables": "Enter the deliverables.\n\nExamples:\n1 Reel\n2 Stories\n1 YT Integration",
                        "creators": "Which creator would you like to update?",
                        "notes": "Please enter any special notes for this campaign."
                    }
                    await send_whatsapp_message(sender_id, f"📝 *Edit {field.title()}*\n\n{prompts.get(field, 'Enter the new value:')}")
                    return
                elif action_id == "opts_pause":
                    # Simple fallback
                    await send_whatsapp_message(sender_id, "⏸️ Reply with 'Pause [Creator Name]' to pause a campaign.")
                    return
                elif action_id == "opts_delete":
                    await send_whatsapp_message(sender_id, "🗑️ Reply with 'Delete [Creator Name]' to remove a campaign.")
                    return
                elif action_id == "opts_export":
                    await send_whatsapp_message(sender_id, "📥 Export is currently only supported via the web dashboard.")
                    return
                elif action_id == "opts_help":
                    await send_whatsapp_message(sender_id, "ℹ️ *Help*\n\nJust type what you want to do! Example: 'Change Rohan's deadline to Friday' or 'Increase payment to 25k'.")
                    return

        elif msg_type == "text":
            text_val = message.get("text", {}).get("body", "").strip()
            text_lower = text_val.lower()
            
            # Exact matches for instant actions
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
                    name = draft.get("influencer_name") or draft.get("influencer_handle") or "Unknown"
                    if text_lower in ["yes", "y", "yep", "activate"]:
                        await (supabase_admin.table("campaigns").update({"status": "active"}).eq("id", draft["id"]).execute())
                        await send_whatsapp_message(sender_id, f"✅ Done! The campaign for *{name}* is now Active.")
                        return
                    elif text_lower in ["no", "wrong", "pause"]:
                        await (supabase_admin.table("campaigns").update({"status": "draft"}).eq("id", draft["id"]).execute())
                        await send_whatsapp_message(sender_id, f"📝 Saved! The campaign for *{name}* is paused as a Draft.")
                        return
                    elif text_lower in ["delete", "cancel"]:
                        await (supabase_admin.table("campaigns").delete().eq("id", draft["id"]).execute())
                        await send_whatsapp_message(sender_id, f"🗑️ Campaign Deleted. Removed *{name}*.")
                        return

        # Prepare payload for AI Manager
        content_for_gemini = None
        if msg_type == "text":
            content_for_gemini = message.get("text", {}).get("body", "").strip()
            if not content_for_gemini:
                await send_whatsapp_message(sender_id, "🤖 Please send text, screenshots, or voice notes.")
                return
            await send_whatsapp_message(sender_id, "🤖 AI is extracting your campaign details... ⏳")
        elif msg_type == "audio":
            audio_id = message.get("audio", {}).get("id")
            if audio_id:
                await send_whatsapp_message(sender_id, "🎧 Listening to your voice note...")
                audio_bytes = await download_whatsapp_media(audio_id, max_bytes=_MAX_MEDIA_BYTES)
                if audio_bytes:
                    content_for_gemini = {"audio_bytes": audio_bytes, "mime_type": "audio/ogg"}
        elif msg_type == "image":
            image_id = message.get("image", {}).get("id")
            if image_id:
                await send_whatsapp_message(sender_id, "📸 Reading screenshot...")
                image_bytes = await download_whatsapp_media(image_id, max_bytes=_MAX_MEDIA_BYTES)
                if image_bytes:
                    content_for_gemini = {"image_bytes": image_bytes, "mime_type": message.get("image", {}).get("mime_type", "image/jpeg"), "caption": message.get("image", {}).get("caption", "")}
        elif msg_type == "document":
            document_id = message.get("document", {}).get("id")
            if document_id:
                await send_whatsapp_message(sender_id, "📄 Reading document...")
                doc_bytes = await download_whatsapp_media(document_id, max_bytes=_MAX_MEDIA_BYTES)
                if doc_bytes:
                    content_for_gemini = {"document_bytes": doc_bytes, "mime_type": message.get("document", {}).get("mime_type", "application/pdf"), "filename": message.get("document", {}).get("filename", "document"), "caption": message.get("document", {}).get("caption", "")}
        else:
            await send_whatsapp_message(sender_id, "🤖 I can't read this message type yet. Please send text or images.")
            return

        if not content_for_gemini:
            await send_whatsapp_message(sender_id, "❌ Failed to download media from WhatsApp. Please try again.")
            return

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
                await send_whatsapp_message(
                    sender_id,
                    "🤖 AI is analysing your campaign...\n\n"
                    "Detected:\n- Multiple creators\n- Payments\n- Deadlines\n\n"
                    "Organising campaign details..."
                )
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
                text_content = content_for_gemini.get("caption", "")

        intent_res = await process_with_ai_manager(file_bytes, mime_type, text_content, context_str)
        indicator_task.cancel()

        from app.core.formatters import format_grouped_campaign_summary

        # 5. Handle Intents
        if intent_res.intent == IntentType.CREATE:
            saved_campaigns = []
            for c in intent_res.campaigns:
                campaign_data = c.model_dump(exclude={"id"}, exclude_none=True)
                brand = campaign_data.pop("brand_name", None)
                
                campaign_data["user_id"] = user_id
                campaign_data["status"] = "draft"
                if message_id:
                    campaign_data["special_notes"] = f"{campaign_data.get('special_notes', '')} [wa_msg:{message_id}]".strip()
                
                resp = await supabase_admin.table("campaigns").insert(campaign_data).execute()
                if resp.data:
                    saved_c = resp.data[0]
                else:
                    saved_c = campaign_data
                    
                if brand:
                    saved_c["brand_name"] = brand
                saved_campaigns.append(saved_c)
                
            summary_msg = format_grouped_campaign_summary(
                saved_campaigns, 
                is_review=bool(intent_res.missing_fields), 
                missing_fields=intent_res.missing_fields,
                platform="wa"
            )
            await send_whatsapp_message(sender_id, summary_msg)
            if not intent_res.missing_fields:
                await send_whatsapp_message(sender_id, "", interactive=get_whatsapp_campaign_buttons(saved_campaigns))

        elif intent_res.intent == IntentType.UPDATE:
            updated_campaigns = []
            for c in intent_res.campaigns:
                target_id = c.id
                if not target_id and recent_campaigns.data:
                    # Fallback to most recent if AI couldn't map ID
                    target_id = recent_campaigns.data[0]["id"]
                
                if target_id:
                    updates = c.model_dump(exclude={"id"}, exclude_none=True)
                    brand = updates.pop("brand_name", None)
                    if updates:
                        await supabase_admin.table("campaigns").update(updates).eq("id", target_id).execute()
                        
                        updated_resp = await (supabase_admin.table("campaigns")
                            .select("*")
                            .eq("id", target_id)
                            .limit(1)
                            .execute()
                        )
                        if updated_resp.data:
                            fresh_c = updated_resp.data[0]
                            if brand:
                                fresh_c["brand_name"] = brand
                            updated_campaigns.append(fresh_c)
            
            if updated_campaigns:
                summary_msg = format_grouped_campaign_summary(
                    updated_campaigns, 
                    is_review=False, 
                    missing_fields=intent_res.missing_fields,
                    platform="wa"
                )
                await send_whatsapp_message(sender_id, summary_msg)
                if not intent_res.missing_fields:
                    await send_whatsapp_message(sender_id, "", interactive=get_whatsapp_campaign_buttons(updated_campaigns))
            else:
                await send_whatsapp_message(sender_id, "❌ I couldn't find a recent campaign to update.")

        elif intent_res.intent == IntentType.QUERY:
            await send_whatsapp_message(sender_id, f"📊 *Summary*\n\n{intent_res.recommendation_text or 'Here is the data.'}")

        elif intent_res.intent == IntentType.RECOMMENDATION:
            await send_whatsapp_message(sender_id, f"💡 *Suggestion*\n\n{intent_res.recommendation_text}")

        else:
            await send_whatsapp_message(sender_id, intent_res.recommendation_text or "Sorry, I didn't catch that. Could you rephrase?")

    except Exception as e:
        logger.error("WhatsApp processing error", error=str(e), exc_info=True)
        await send_whatsapp_message(sender_id, "🤖 *Oops!* My servers hit a snag. Please try again.")

@router.post("/whatsapp")
@limiter.limit("60/minute")
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
