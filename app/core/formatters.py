import html
from collections import defaultdict

def resolve_ux_status(campaign: dict, missing_fields: list = None) -> str:
    db_status = campaign.get('status', 'draft').lower()
    notes = campaign.get('special_notes') or ''
    
    if db_status == 'draft':
        if missing_fields:
            return "PENDING DETAILS"
        if "NEGOTIATION:" in notes:
            return "PENDING NEGOTIATION"
        return "READY TO ACTIVATE"
    elif db_status == 'active':
        return "ACTIVE"
    elif db_status in ['cancelled', 'paused']:
        return "PAUSED"
    elif db_status in ['paid', 'completed', 'approved']:
        return "COMPLETED"
        
    return db_status.upper()

def format_grouped_campaign_summary(campaigns: list[dict], is_review: bool = False, missing_fields: list = None, platform: str = "wa") -> str:
    if not campaigns:
        return "No campaigns found."

    grouped = defaultdict(list)
    for c in campaigns:
        brand = c.get('brand_name') or 'Brand Campaign'
        grouped[brand].append(c)
        
    is_tg = (platform == "tg")
    b_tag = "<b>" if is_tg else "*"
    b_end = "</b>" if is_tg else "*"
    
    prefix = f"🤖 {b_tag}EXTRACTION COMPLETE{b_end}\n\n{b_tag}Campaign Summary{b_end}\n\n"
    summary = prefix
    
    camp_counter = 1
    for brand, creators in grouped.items():
        clean_brand = html.escape(brand) if is_tg else brand
        summary += f"───\n{b_tag}Campaign {camp_counter}{b_end}\n"
        summary += f"{b_tag}Brand:{b_end} {clean_brand}\n\n"
        
        # Creators list
        creator_names = []
        for c in creators:
            name = c.get('influencer_name') or c.get('influencer_handle') or 'Unknown'
            creator_names.append(html.escape(name) if is_tg else name)
            
        summary += f"{b_tag}Creators:{b_end}\n"
        for name in creator_names:
            summary += f"- {name}\n"
        summary += "\n"
        
        # Deliverables
        summary += f"{b_tag}Deliverables:{b_end}\n"
        for c in creators:
            name = html.escape(c.get('influencer_name') or 'Unknown') if is_tg else (c.get('influencer_name') or 'Unknown')
            d = html.escape(c.get('deliverables') or 'N/A') if is_tg else (c.get('deliverables') or 'N/A')
            summary += f"- {name} -> {d}\n"
        summary += "\n"
        
        # Payments
        summary += f"{b_tag}Payments / Budget:{b_end}\n"
        for c in creators:
            name = html.escape(c.get('influencer_name') or 'Unknown') if is_tg else (c.get('influencer_name') or 'Unknown')
            raw_pay = c.get('payment_amount')
            notes = c.get('special_notes') or ''
            
            if "NEGOTIATION:" in notes:
                # Extract negotiation text safely
                try:
                    neg_text = notes.split("NEGOTIATION:")[1].split("]")[0].strip()
                    neg_text = html.escape(neg_text) if is_tg else neg_text
                    summary += f"- {name} -> {neg_text}\n"
                except IndexError:
                    summary += f"- {name} -> Pending Negotiation\n"
            elif raw_pay is not None:
                try:
                    pay = float(raw_pay)
                    summary += f"- {name} -> ₹{pay:,.2f}\n"
                except ValueError:
                    summary += f"- {name} -> N/A\n"
            else:
                summary += f"- {name} -> N/A\n"
        summary += "\n"
        
        # Deadlines
        deadlines = list(set([c.get('deadline') for c in creators if c.get('deadline')]))
        summary += f"{b_tag}Deadline:{b_end}\n"
        if not deadlines:
            summary += "N/A\n\n"
        elif len(deadlines) == 1:
            d = html.escape(deadlines[0]) if is_tg else deadlines[0]
            summary += f"{d}\n\n"
        else:
            for c in creators:
                name = html.escape(c.get('influencer_name') or 'Unknown') if is_tg else (c.get('influencer_name') or 'Unknown')
                d = html.escape(c.get('deadline') or 'N/A') if is_tg else (c.get('deadline') or 'N/A')
                summary += f"- {name} -> {d}\n"
            summary += "\n"
            
        # Status
        ux_status = resolve_ux_status(creators[0], missing_fields)
        summary += f"{b_tag}Status:{b_end}\n{ux_status}\n\n"
        
        camp_counter += 1
        
    summary += "───\n\n"
    
    if missing_fields:
        missing_str = "\n- ".join([f.field_name for f in missing_fields])
        summary += f"⚠️ {b_tag}Missing Information:{b_end}\n- {missing_str}\n\nPlease reply naturally to provide the missing details."
        
    return summary

def get_whatsapp_campaign_buttons(campaigns: list[dict]) -> dict:
    if len(campaigns) > 1:
        return {
            "type": "button",
            "body": {"text": f"Found {len(campaigns)} campaigns. What would you like to do?"},
            "action": {
                "buttons": [
                    {"type": "reply", "reply": {"id": "act_all", "title": "Activate All"}},
                    {"type": "reply", "reply": {"id": "camp_edit", "title": "Edit Campaigns"}},
                    {"type": "reply", "reply": {"id": "opts_menu", "title": "More Options"}}
                ]
            }
        }
    else:
        camp = campaigns[0] if campaigns else {}
        brand = camp.get('brand_name') or camp.get('influencer_name') or 'Campaign'
        return {
            "type": "button",
            "body": {"text": f"What would you like to do with {brand[:15]}?"},
            "action": {
                "buttons": [
                    {"type": "reply", "reply": {"id": "act_all", "title": "Activate"}},
                    {"type": "reply", "reply": {"id": "camp_edit", "title": "Edit"}},
                    {"type": "reply", "reply": {"id": "opts_menu", "title": "Options"}}
                ]
            }
        }

def get_whatsapp_edit_menu() -> dict:
    return {
        "type": "list",
        "header": {"type": "text", "text": "Edit Campaign"},
        "body": {"text": "What would you like to edit?"},
        "footer": {"text": "Reply naturally at any time."},
        "action": {
            "button": "Select Field",
            "sections": [
                {
                    "title": "Campaign Details",
                    "rows": [
                        {"id": "edit_field:payment", "title": "Payment Amount"},
                        {"id": "edit_field:deadline", "title": "Deadline"},
                        {"id": "edit_field:deliverables", "title": "Deliverables"},
                        {"id": "edit_field:creators", "title": "Creators"},
                        {"id": "edit_field:notes", "title": "Notes"}
                    ]
                }
            ]
        }
    }

def get_whatsapp_options_menu() -> dict:
    return {
        "type": "list",
        "header": {"type": "text", "text": "More Options"},
        "body": {"text": "Select an action for your campaign:"},
        "action": {
            "button": "Select Action",
            "sections": [
                {
                    "title": "Management",
                    "rows": [
                        {"id": "opts_pause", "title": "Pause Campaign"},
                        {"id": "opts_delete", "title": "Delete Campaign"},
                        {"id": "opts_export", "title": "Export Summary"},
                        {"id": "opts_help", "title": "Help"}
                    ]
                }
            ]
        }
    }

def get_telegram_campaign_buttons(campaigns: list[dict]) -> dict:
    if len(campaigns) > 1:
        return {
            "inline_keyboard": [
                [{"text": "✅ Activate All", "callback_data": "act_all"}],
                [{"text": "✏️ Edit Campaigns", "callback_data": "camp_edit"}, {"text": "⚙️ More Options", "callback_data": "opts_menu"}]
            ]
        }
    else:
        return {
            "inline_keyboard": [
                [{"text": "✅ Activate Campaign", "callback_data": "act_all"}],
                [{"text": "✏️ Edit Campaign", "callback_data": "camp_edit"}, {"text": "⚙️ More Options", "callback_data": "opts_menu"}]
            ]
        }

def get_telegram_edit_menu() -> dict:
    return {
        "inline_keyboard": [
            [{"text": "💰 Payment", "callback_data": "edit_field:payment"}, {"text": "📅 Deadline", "callback_data": "edit_field:deadline"}],
            [{"text": "📝 Deliverables", "callback_data": "edit_field:deliverables"}, {"text": "👥 Creators", "callback_data": "edit_field:creators"}],
            [{"text": "📌 Notes", "callback_data": "edit_field:notes"}]
        ]
    }

def get_telegram_options_menu() -> dict:
    return {
        "inline_keyboard": [
            [{"text": "⏸️ Pause Campaign", "callback_data": "opts_pause"}, {"text": "🗑️ Delete Campaign", "callback_data": "opts_delete"}],
            [{"text": "📥 Export", "callback_data": "opts_export"}, {"text": "❓ Help", "callback_data": "opts_help"}]
        ]
    }
