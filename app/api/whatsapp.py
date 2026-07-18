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
from app.services.whatsapp import send_whatsapp_message, download_whatsapp_media

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/webhook", tags=["WhatsApp Webhook"])

BULK_CACHE = {}

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
                if action_id == "cancel_ai_action":
                    BULK_CACHE.pop(user_id, None)
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
                    BULK_CACHE[user_id] = {"action": "edit", "field": field, "campaign_id": camp_id}
                    await send_whatsapp_message(sender_id, prompts.get(field, 'Enter the new value:'))
                    return

        elif msg_type == "text":
            text_val = message.get("text", {}).get("body", "").strip()
            text_lower = text_val.lower()
            
            # Check for pending edit
            pending_edit = BULK_CACHE.get(user_id)
            if pending_edit and pending_edit.get("action") == "edit":
                if text_lower == "cancel":
                    BULK_CACHE.pop(user_id, None)
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
                            update_val = float(''.join(c for c in text_val.lower().replace("k", "000") if c.isdigit() or c == '.'))
                        except:
                            pass
                    elif db_field == "deadline":
                        import re
                        m = re.search(r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})", text_val)
                        if m:
                            d, mo, y = m.groups()
                            if int(mo) > 12 and int(d) <= 12:
                                d, mo = mo, d # swap if user gave MM/DD/YYYY
                            update_val = f"{y}-{int(mo):02d}-{int(d):02d}"
                    
                    update_payload = {db_field: update_val}
                    if db_field == "influencer_name":
                        update_payload["influencer_handle"] = update_val  # satisfy constraint
                        
                    try:
                        await supabase_admin.table("campaigns").update(update_payload).eq("id", camp_id).execute()
                        BULK_CACHE.pop(user_id, None)
                        await send_whatsapp_message(sender_id, f"✅ Updated successfully!")
                    except Exception as e:
                        logger.error("Direct edit update failed", error=str(e))
                        await send_whatsapp_message(sender_id, f"❌ Failed to update. Please ensure the value is formatted correctly (e.g., Dates as DD/MM/YYYY).")
                return
            
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
            
            # Check for pending clarification
            pending_clarif = BULK_CACHE.get(user_id)
            if pending_clarif and pending_clarif.get("action") == "clarification":
                original_msg = pending_clarif.get("original_msg", "")
                content_for_gemini = f"Previous Context: {original_msg}\n\nUser Clarification: {content_for_gemini}"
                BULK_CACHE.pop(user_id, None)
                await send_whatsapp_message(sender_id, "📝 Processing clarification...")
            elif user_id not in BULK_CACHE and len(content_for_gemini) > 10:
                await send_whatsapp_message(sender_id, "📝 Analyzing details...")
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

        intent_res = None
        if msg_type == "text" and user_id in BULK_CACHE:
            text_upper = message.get("text", {}).get("body", "").strip().upper()
            if text_upper in ["YES", "Y", "DELETE ALL", "ACTIVATE ALL", "PAUSE ALL", "UPDATE ALL"]:
                intent_res = BULK_CACHE.pop(user_id)

        if not intent_res:
            intent_res = await process_with_ai_manager(file_bytes, mime_type, text_content, context_str)
        
        indicator_task.cancel()

        from app.core.formatters import format_single_campaign_summary

        # 5. Handle Intents
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
                await send_whatsapp_message(sender_id, "No valid creators found to extract.")
                return

            saved_campaigns = []
            campaign_name_for_intro = "Unknown Campaign"
            for c in valid_campaigns_to_create:
                campaign_data = c.model_dump(exclude={"id"}, exclude_none=True)
                brand = campaign_data.pop("brand_name", None)
                camp_name = campaign_data.pop("campaign_name", brand)
                
                if camp_name and campaign_name_for_intro == "Unknown Campaign":
                    campaign_name_for_intro = camp_name
                    
                # We can store the campaign_name logically or just pop it if there is no column yet.
                # Assuming no column yet, we ignore it in db insert.
                
                campaign_data["user_id"] = user_id
                campaign_data["status"] = "draft"
                campaign_data["influencer_handle"] = campaign_data.get("influencer_name") or "Unknown"
                if message_id:
                    campaign_data["special_notes"] = f"{campaign_data.get('special_notes', '')} [wa_msg:{message_id}]".strip()
                
                resp = await supabase_admin.table("campaigns").insert(campaign_data).execute()
                if resp.data:
                    saved_c = resp.data[0]
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
            await send_whatsapp_message(sender_id, intro_msg)
                
            for campaign in saved_campaigns:
                summary_msg = format_single_campaign_summary(
                    campaign, 
                    platform="wa"
                )
                await send_whatsapp_message(sender_id, summary_msg)
                await send_whatsapp_message(sender_id, "", interactive=get_whatsapp_single_campaign_buttons(campaign))

        elif intent_res.intent in [IntentType.UPDATE, IntentType.DELETE, IntentType.ACTIVATE, IntentType.PAUSE]:
            target_ids = intent_res.target_campaign_ids
            if not target_ids and intent_res.campaigns:
                target_ids = [c.id for c in intent_res.campaigns if c.id]
                
            if not target_ids:
                if intent_res.campaigns:
                    valid_ids = [rc["id"] for rc in (recent_campaigns.data or [])]
                    if valid_ids: target_ids = [valid_ids[0]]
            
            if not target_ids:
                await send_whatsapp_message(sender_id, "❌ I couldn't determine which creator collaboration you'd like to update. Please mention the creator's name.")
                return
                
            if len(target_ids) > 1 and not (msg_type == "text" and message.get("text", {}).get("body", "").strip().upper() in ["YES", "Y", "DELETE ALL", "ACTIVATE ALL", "PAUSE ALL", "UPDATE ALL"]):
                BULK_CACHE[user_id] = intent_res
                action_name = intent_res.intent.value.lower()
                cancel_interactive = {
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
                await send_whatsapp_message(sender_id, f"AI Campaign Manager\n\nYou are about to {action_name} {len(target_ids)} creator collaborations.\n\nPlease confirm.\n\nReply with:\n- YES\n- {action_name.upper()} ALL", interactive=cancel_interactive)
                return
                
            if intent_res.intent == IntentType.DELETE:
                await supabase_admin.table("campaigns").delete().in_("id", target_ids).execute()
                if len(target_ids) > 1:
                    await send_whatsapp_message(sender_id, f"AI Campaign Manager\n\nSuccessfully deleted {len(target_ids)} creator collaborations.")
                else:
                    await send_whatsapp_message(sender_id, "🗑️ Creator collaboration deleted successfully.")
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
                    await send_whatsapp_message(sender_id, summary_text)
                else:
                    for cmp in data:
                        summary_msg = format_single_campaign_summary(cmp, platform="wa")
                        await send_whatsapp_message(sender_id, summary_msg)
                        await send_whatsapp_message(sender_id, "", interactive=get_whatsapp_single_campaign_buttons(cmp))

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
                await send_whatsapp_message(sender_id, "📊 No matching campaigns found.")
            else:
                await send_whatsapp_message(sender_id, f"📊 Found {len(data)} matching creator collaborations.\n\nHere they are:")
                for c in data[:5]:
                    summary_msg = format_single_campaign_summary(c, platform="wa")
                    await send_whatsapp_message(sender_id, summary_msg)
                    await send_whatsapp_message(sender_id, "", interactive=get_whatsapp_single_campaign_buttons(c))
                if len(data) > 5:
                    await send_whatsapp_message(sender_id, f"...and {len(data)-5} more.")

        elif intent_res.intent == IntentType.CLARIFICATION:
            cancel_interactive = {
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
            if isinstance(content_for_gemini, str):
                BULK_CACHE[user_id] = {"action": "clarification", "original_msg": content_for_gemini}
                
            await send_whatsapp_message(sender_id, f"AI Campaign Manager\n\n{intent_res.recommendation_text}", interactive=cancel_interactive)

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
