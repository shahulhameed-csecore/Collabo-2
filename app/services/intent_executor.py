import json
import structlog
from typing import Callable, Any, Dict, List
from app.services.ai_manager import IntentType
from app.core.formatters import format_single_campaign_summary

logger = structlog.get_logger(__name__)

async def execute_intent(
    intent_res,
    user_id: str,
    target_id: str,
    supabase_admin,
    recent_campaigns_data: List[Dict],
    platform: str,
    send_message_func: Callable,
    get_buttons_func: Callable,
    get_cancel_interactive_func: Callable,
    is_bulk_confirm: bool = False,
    bulk_cache_dict: dict = None,
    message_id_str: str = None
):
    """
    Executes the database and messaging logic for a given AI intent.
    Shared across both WhatsApp and Telegram to eliminate code duplication.
    """
    try:
        if intent_res.intent == IntentType.CREATE:
            valid_campaigns_to_create = []
            skipped_count = 0
            for c in intent_res.campaigns:
                if not c.influencer_name or c.influencer_name.strip() == "":
                    skipped_count += 1
                    continue
                valid_campaigns_to_create.append(c)
                
            if not valid_campaigns_to_create:
                await send_message_func(target_id, "No valid creators found to extract.")
                return

            saved_campaigns = []
            campaign_name_for_intro = "Unknown Campaign"
            
            # Prepare all payloads
            payloads_to_insert = []
            for c in valid_campaigns_to_create:
                campaign_data = c.model_dump(exclude={"id"}, exclude_none=True)
                brand = campaign_data.pop("brand_name", None)
                camp_name = campaign_data.pop("campaign_name", brand)
                
                if camp_name and campaign_name_for_intro == "Unknown Campaign":
                    campaign_name_for_intro = camp_name
                
                campaign_data["user_id"] = user_id
                campaign_data["status"] = "draft"
                campaign_data["influencer_handle"] = campaign_data.get("influencer_name") or "Unknown"
                if message_id_str:
                    campaign_data["special_notes"] = f"{campaign_data.get('special_notes', '')} [{message_id_str}]".strip()
                    
                # We temporarily store camp_name and brand in the payload dict so we can restore them
                # after Supabase insert (Supabase will ignore extra keys if strict=False, but it's safer to not send them)
                payload_for_db = campaign_data.copy()
                
                payloads_to_insert.append({
                    "db_payload": payload_for_db,
                    "meta": {"camp_name": camp_name, "brand": brand}
                })
                
            if payloads_to_insert:
                db_inserts = [p["db_payload"] for p in payloads_to_insert]
                res = await supabase_admin.table("campaigns").insert(db_inserts).execute()
                
                inserted_rows = res.data if res.data else db_inserts
                
                for idx, saved_c in enumerate(inserted_rows):
                    meta = payloads_to_insert[idx]["meta"]
                    if meta["camp_name"]:
                        saved_c["campaign_name"] = meta["camp_name"]
                    elif meta["brand"]:
                        saved_c["brand_name"] = meta["brand"]
                    saved_campaigns.append(saved_c)
                    
            intro_msg = f"AI Campaign Manager\n\nExtraction completed successfully.\n\nCampaign:\n{campaign_name_for_intro}\n\nCreators Found:\n{len(saved_campaigns)}\n\nPlease review the extracted creator details below before activating them."
            if skipped_count > 0:
                intro_msg += f"\n\nNote: {skipped_count} creator(s) were skipped because their names were missing."
            await send_message_func(target_id, intro_msg)
            
            for campaign in saved_campaigns:
                summary_msg = format_single_campaign_summary(campaign, platform=platform)
                buttons = get_buttons_func(campaign)
                if platform == "tg":
                    await send_message_func(target_id, summary_msg, reply_markup=buttons)
                else:
                    await send_message_func(target_id, summary_msg)
                    await send_message_func(target_id, "", interactive=buttons)

        elif intent_res.intent in [IntentType.UPDATE, IntentType.DELETE, IntentType.ACTIVATE, IntentType.PAUSE]:
            target_ids = intent_res.target_campaign_ids
            if not target_ids and intent_res.campaigns:
                target_ids = [c.id for c in intent_res.campaigns if c.id]
                
            if not target_ids:
                if intent_res.campaigns:
                    valid_ids = [rc["id"] for rc in (recent_campaigns_data or [])]
                    if valid_ids: target_ids = [valid_ids[0]]
            
            if not target_ids:
                await send_message_func(target_id, "❌ I couldn't determine which creator collaboration you'd like to update. Please mention the creator's name.")
                return
                
            if len(target_ids) > 1 and not is_bulk_confirm:
                # Store pending action in DB instead of in-memory cache
                try:
                    await supabase_admin.table("user_settings").update({
                        "pending_action": intent_res.model_dump(mode='json')
                    }).eq("user_id", user_id).execute()
                except Exception as e:
                    logger.error("Failed to save pending_action to DB", error=str(e))
                
                action_name = intent_res.intent.value.lower()
                cancel_interactive = get_cancel_interactive_func()
                msg = f"AI Campaign Manager\n\nYou are about to {action_name} {len(target_ids)} creator collaborations.\n\nPlease confirm.\n\nReply with:\n- YES\n- {action_name.upper()} ALL"
                
                if platform == "tg":
                    await send_message_func(target_id, msg, reply_markup=cancel_interactive)
                else:
                    await send_message_func(target_id, msg, interactive=cancel_interactive)
                return
                
            if intent_res.intent == IntentType.DELETE:
                await supabase_admin.table("campaigns").update({"status": "cancelled"}).in_("id", target_ids).execute()
                if len(target_ids) > 1:
                    await send_message_func(target_id, f"AI Campaign Manager\n\nSuccessfully cancelled {len(target_ids)} creator collaborations.")
                else:
                    await send_message_func(target_id, "🗑️ Creator collaboration cancelled successfully.")
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
                    await send_message_func(target_id, summary_text)
                else:
                    for cmp in data:
                        summary_msg = format_single_campaign_summary(cmp, platform=platform)
                        buttons = get_buttons_func(cmp)
                        if platform == "tg":
                            await send_message_func(target_id, summary_msg, reply_markup=buttons)
                        else:
                            await send_message_func(target_id, summary_msg)
                            await send_message_func(target_id, "", interactive=buttons)

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
                await send_message_func(target_id, "📊 No matching campaigns found.")
            else:
                await send_message_func(target_id, f"📊 Found {len(data)} matching creator collaborations.\n\nHere they are:")
                for c in data[:3]:
                    summary_msg = format_single_campaign_summary(c, platform=platform)
                    buttons = get_buttons_func(c)
                    if platform == "tg":
                        await send_message_func(target_id, summary_msg, reply_markup=buttons)
                    else:
                        await send_message_func(target_id, summary_msg)
                        await send_message_func(target_id, "", interactive=buttons)
                if len(data) > 3:
                    await send_message_func(target_id, f"...and {len(data)-3} more.\n\n_View all {len(data)} results on your Collabo Dashboard._")

        elif intent_res.intent == IntentType.CLARIFICATION:
            cancel_interactive = get_cancel_interactive_func()
            msg = f"AI Campaign Manager\n\n{intent_res.recommendation_text}"
            if platform == "tg":
                await send_message_func(target_id, msg, reply_markup=cancel_interactive)
            else:
                await send_message_func(target_id, msg, interactive=cancel_interactive)

        elif intent_res.intent == IntentType.RECOMMENDATION:
            await send_message_func(target_id, f"💡 *Suggestion*\n\n{intent_res.recommendation_text}")

        elif intent_res.intent == IntentType.GREETING:
            await send_message_func(target_id, "👋 <b>Hi! I'm Collabo AI.</b>\n\nForward me a brand negotiation, send a voice note, or drop a screenshot of an invoice to start tracking campaigns!")

        else:
            await send_message_func(target_id, intent_res.recommendation_text or "Sorry, I didn't catch that. Could you rephrase?")

    except Exception as e:
        logger.error(f"Intent executor failed for {platform}", error=str(e), exc_info=True)
        await send_message_func(target_id, "🤖 <b>Oops!</b> My servers hit a snag.")
