import html
from collections import defaultdict

def resolve_ux_status(campaign: dict) -> str:
    db_status = campaign.get('status', 'draft').lower()
    notes = campaign.get('special_notes') or ''
    
    if db_status == 'draft':
        if "NEGOTIATION:" in notes:
            return "Negotiation Pending"
            
        deliv = campaign.get('deliverables')
        pay = campaign.get('payment_amount')
        dead = campaign.get('deadline')
        
        if not deliv or str(deliv).strip() == "" or pay is None or str(pay).strip() == "" or not dead or str(dead).strip() == "":
            return "Draft"
        return "Ready to Activate"
    elif db_status == 'active':
        return "Active"
    elif db_status in ['cancelled', 'paused']:
        return "Paused"
    elif db_status in ['paid', 'completed', 'approved']:
        return "Completed"
        
    return db_status.capitalize()

def format_single_campaign_summary(campaign: dict, platform: str = "wa") -> str:
    campaign_name = campaign.get('campaign_name') or campaign.get('brand_name') or 'Unknown Campaign'
    influencer = campaign.get('influencer_name') or 'Not provided'
    plat = campaign.get('platform') or 'Not provided'
    deliverables = campaign.get('deliverables') or 'Not provided'
    
    payment = campaign.get('payment_amount')
    if payment is not None and str(payment).strip() != "":
        payment_str = str(payment)
    else:
        payment_str = 'Not provided'
        
    deadline = campaign.get('deadline') or 'Not provided'
    notes = campaign.get('special_notes') or 'None'
    
    summary = f"Campaign Name:\n{campaign_name}\n\n"
    summary += f"Creator:\n{influencer}\n\n"
    summary += f"Platform:\n{plat}\n\n"
    summary += f"Deliverables:\n{deliverables}\n\n"
    summary += f"Payment:\n{payment_str}\n\n"
    summary += f"Deadline:\n{deadline}\n\n"
    summary += f"Special Notes:\n{notes}\n"
    
    # Calculate Missing Fields (Mandatory for activation)
    actions_required = []
    if deliverables == 'Not provided':
        actions_required.append("- Add deliverables.")
    if payment_str == 'Not provided':
        actions_required.append("- Add payment amount.")
    if deadline == 'Not provided':
        actions_required.append("- Add campaign deadline before activation.")
        
    if actions_required:
        summary += "\nAction Required:\n"
        for act in actions_required:
            summary += f"{act}\n"
            
    ux_status = resolve_ux_status(campaign)
    summary += f"\nStatus:\n{ux_status}"
    
    return summary

def get_whatsapp_single_campaign_buttons(campaign: dict) -> dict:
    camp_id = campaign.get('id', '')
    brand = campaign.get('brand_name') or campaign.get('influencer_name') or 'Campaign'
    status_text = resolve_ux_status(campaign)
    return {
        "type": "button",
        "body": {"text": f"Campaign:\n{brand}\n\nStatus:\n{status_text}"},
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
