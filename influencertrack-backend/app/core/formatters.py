import html
from collections import defaultdict

import re

def resolve_ux_status(campaign: dict) -> str:
    db_status = campaign.get('status', 'draft').lower()
    notes = campaign.get('special_notes') or ''
    
    if db_status == 'draft':
        if "NEGOTIATION:" in notes:
            return "Negotiation Pending"
            
        deliv = campaign.get('deliverables')
        pay = campaign.get('payment_amount')
        dead = campaign.get('deadline')
        
        if not deliv or str(deliv).strip() == "" or pay is None or str(pay).strip() == "" or pay == 0.0 or not dead or str(dead).strip() == "":
            return "Draft"
        return "Ready to Activate"
    elif db_status == 'active':
        return "Active"
    elif db_status in ['cancelled', 'paused']:
        return "Paused"
    elif db_status in ['paid', 'completed', 'approved']:
        return "Completed"
        
    return db_status.capitalize()

def format_indian_currency(num: int) -> str:
    s = str(num)
    if len(s) > 3:
        last_3 = s[-3:]
        other = s[:-3]
        other_parts = []
        while other:
            other_parts.append(other[-2:])
            other = other[:-2]
        other_formatted = ",".join(reversed(other_parts))
        return f"₹{other_formatted},{last_3}"
    return f"₹{s}"

def format_single_campaign_summary(campaign: dict, platform: str = "wa") -> str:
    campaign_name = campaign.get('campaign_name') or campaign.get('brand_name') or 'Unknown Campaign'
    influencer = campaign.get('influencer_name') or 'Not provided'
    plat = campaign.get('platform') or 'Not provided'
    deliverables = campaign.get('deliverables') or 'Not provided'
    
    notes_raw = campaign.get('special_notes') or ''
    is_negotiation = "NEGOTIATION:" in notes_raw
    
    payment = campaign.get('payment_amount')
    if is_negotiation or payment == 0.0 or payment == 0:
        payment_str = 'Not finalized'
    elif payment is not None and str(payment).strip() != "":
        try:
            payment_int = int(float(payment))
            payment_str = format_indian_currency(payment_int)
        except ValueError:
            payment_str = str(payment)
    else:
        payment_str = 'Not provided'
        
    deadline = campaign.get('deadline') or 'Not provided'
    
    # Clean notes
    notes_clean = re.sub(r'\[wa_msg:[^\]]+\]', '', notes_raw)
    notes_clean = re.sub(r'\[tg_update:[^\]]+\]', '', notes_clean)
    notes_clean = notes_clean.strip()
    if not notes_clean:
        notes_clean = 'None'
    
    summary = f"Campaign Name: {campaign_name}\n"
    summary += f"Creator: {influencer}\n"
    summary += f"Platform: {plat}\n"
    summary += f"Deliverables: {deliverables}\n"
    summary += f"Payment: {payment_str}\n"
    summary += f"Deadline: {deadline}\n"
    summary += f"Special Notes: {notes_clean}\n"
    
    # Calculate Missing Fields (Mandatory for activation)
    actions_required = []
    if deliverables == 'Not provided':
        actions_required.append("- Add deliverables.")
    if payment_str in ['Not provided', 'Not finalized']:
        actions_required.append("- Add payment amount.")
    if deadline == 'Not provided':
        actions_required.append("- Add campaign deadline before activation.")
        
    if actions_required:
        summary += "\nAction Required:\n"
        for act in actions_required:
            summary += f"{act}\n"
            
    ux_status = resolve_ux_status(campaign)
    summary += f"\nStatus: {ux_status}"
    
    return summary

def get_whatsapp_single_campaign_buttons(campaign: dict) -> dict:
    camp_id = campaign.get('id', '')
    brand = campaign.get('brand_name') or campaign.get('influencer_name') or 'Campaign'
    status_text = resolve_ux_status(campaign)
    return {
        "type": "button",
        "body": {"text": f"Campaign: {brand}\nStatus: {status_text}"},
        "action": {
            "buttons": [
                {"type": "reply", "reply": {"id": f"act_camp:{camp_id}", "title": "Activate"}},
                {"type": "reply", "reply": {"id": f"camp_edit:{camp_id}", "title": "Edit"}},
                {"type": "reply", "reply": {"id": f"del_camp:{camp_id}", "title": "Delete"}}
            ]
        }
    }

def get_whatsapp_edit_menu(campaign_id: str) -> dict:
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
                        {"id": f"edit_field:payment:{campaign_id}", "title": "Payment"},
                        {"id": f"edit_field:deadline:{campaign_id}", "title": "Deadline"},
                        {"id": f"edit_field:deliverables:{campaign_id}", "title": "Deliverables"},
                        {"id": f"edit_field:platform:{campaign_id}", "title": "Platform"},
                        {"id": f"edit_field:creators:{campaign_id}", "title": "Creator Name"},
                        {"id": f"edit_field:notes:{campaign_id}", "title": "Notes"},
                        {"id": f"edit_field:status:{campaign_id}", "title": "Status"},
                        {"id": f"edit_field:url:{campaign_id}", "title": "Destination URL"}
                    ]
                }
            ]
        }
    }

def get_telegram_single_campaign_buttons(campaign: dict) -> dict:
    camp_id = campaign.get('id', '')
    return {
        "inline_keyboard": [
            [{"text": "✅ Activate", "callback_data": f"act_camp:{camp_id}"}],
            [{"text": "✏️ Edit", "callback_data": f"camp_edit:{camp_id}"}],
            [{"text": "🗑️ Delete", "callback_data": f"del_camp:{camp_id}"}]
        ]
    }

def get_telegram_edit_menu(campaign_id: str) -> dict:
    return {
        "inline_keyboard": [
            [{"text": "💰 Payment", "callback_data": f"edit_field:payment:{campaign_id}"}, {"text": "📅 Deadline", "callback_data": f"edit_field:deadline:{campaign_id}"}],
            [{"text": "📝 Deliverables", "callback_data": f"edit_field:deliverables:{campaign_id}"}, {"text": "👥 Creator Name", "callback_data": f"edit_field:creators:{campaign_id}"}],
            [{"text": "📱 Platform", "callback_data": f"edit_field:platform:{campaign_id}"}, {"text": "📌 Notes", "callback_data": f"edit_field:notes:{campaign_id}"}],
            [{"text": "⚙️ Status", "callback_data": f"edit_field:status:{campaign_id}"}, {"text": "🔗 Destination URL", "callback_data": f"edit_field:url:{campaign_id}"}]
        ]
    }
