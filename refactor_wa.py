import re

with open("app/api/whatsapp.py", "r", encoding="utf-8") as f:
    content = f.read()

# Add import
if "from app.services.ai_manager import" not in content:
    content = content.replace(
        "from app.services.gemini import extract_campaign_data",
        "from app.services.gemini import extract_campaign_data\nfrom app.services.ai_manager import process_with_ai_manager, IntentType"
    )

new_func = '''@sentry_sdk.trace(op="webhook", name="Process WhatsApp Message")
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
                safe_message_id = message_id.replace("%", "\\\\%").replace("_", "\\\\_")
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
                "👋 *Hi! I'm Collabo AI.*\\n\\n"
                "I noticed your WhatsApp number isn't linked to a Collabo account yet.\\n\\n"
                "To start tracking campaigns automatically:\\n"
                "1. Go to your Collabo dashboard 👉 *Settings*.\\n"
                "2. Save this exact number.\\n\\n"
                "Once linked, you can forward me chats or voice notes and I'll do the rest! ✨"
            )
            await send_whatsapp_message(sender_id, unlinked_msg)
            return

        user_id = user_response.data[0]["user_id"]
        msg_type = message.get("type")

        # 3. Stage 1: Rules Engine (Hybrid Router)
        if msg_type == "text":
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

        # 5. Handle Intents
        if intent_res.intent == IntentType.CREATE:
            for c in intent_res.campaigns:
                campaign_data = c.model_dump(exclude_none=True)
                campaign_data["user_id"] = user_id
                campaign_data["status"] = "draft"
                if message_id:
                    campaign_data["special_notes"] = f"{campaign_data.get('special_notes', '')} [wa_msg:{message_id}]".strip()
                
                await supabase_admin.table("campaigns").insert(campaign_data).execute()
                
            if intent_res.missing_fields:
                missing_str = "\\n- ".join([f.field_name for f in intent_res.missing_fields])
                await send_whatsapp_message(sender_id, f"📝 *Draft Saved*\\n\\nI'm missing some details:\\n- {missing_str}\\n\\nWould you like to add them?")
            else:
                await send_whatsapp_message(sender_id, "🎉 *Campaign Created Successfully!*\\n\\nReply with *Activate* to make it live.")

        elif intent_res.intent == IntentType.UPDATE:
            if recent_campaigns.data:
                target_id = recent_campaigns.data[0]["id"]
                updates = intent_res.campaigns[0].model_dump(exclude_none=True) if intent_res.campaigns else {}
                if updates:
                    await supabase_admin.table("campaigns").update(updates).eq("id", target_id).execute()
                    await send_whatsapp_message(sender_id, "✅ *Details Updated successfully.*")
            else:
                await send_whatsapp_message(sender_id, "❌ I couldn't find a recent campaign to update.")

        elif intent_res.intent == IntentType.QUERY:
            await send_whatsapp_message(sender_id, f"📊 *Summary*\\n\\n{intent_res.recommendation_text or 'Here is the data.'}")

        elif intent_res.intent == IntentType.RECOMMENDATION:
            await send_whatsapp_message(sender_id, f"💡 *Suggestion*\\n\\n{intent_res.recommendation_text}")

        else:
            await send_whatsapp_message(sender_id, intent_res.recommendation_text or "Sorry, I didn't catch that. Could you rephrase?")

    except Exception as e:
        logger.error("WhatsApp processing error", error=str(e), exc_info=True)
        await send_whatsapp_message(sender_id, "🤖 *Oops!* My servers hit a snag. Please try again.")
'''

# Use regex to replace the function
pattern = r'@sentry_sdk\.trace\(op="webhook", name="Process WhatsApp Message"\).*?async def meta_whatsapp_webhook'
# We want to replace everything from the decorator up to (but not including) meta_whatsapp_webhook
new_content = re.sub(pattern, new_func + '\n@router.post("/whatsapp")', content, flags=re.DOTALL)

with open("app/api/whatsapp.py", "w", encoding="utf-8") as f:
    f.write(new_content)
