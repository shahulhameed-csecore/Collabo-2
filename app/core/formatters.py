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

def format_single_campaign_summary(campaign: dict, missing_fields: list = None, platform: str = "wa") -> str:
    brand = campaign.get('brand_name') or campaign.get('influencer_name') or 'Brand Campaign'
    
    summary = f"AI Campaign Manager\n\nExtraction Completed Successfully.\n\nCampaign Name:\n{brand}\n\nFields Extracted:\n\n"
    
    fields_present = []
    fields_missing = []
    
    field_map = {
        'influencer_name': 'Influencer Name',
        'influencer_handle': 'Handle',
        'platform': 'Platform',
        'payment_amount': 'Payment',
        'deadline': 'Deadline',
        'deliverables': 'Deliverables',
        'special_notes': 'Special Notes',
        'destination_url': 'Destination URL'
    }
    
    for key, display_name in field_map.items():
        val = campaign.get(key)
        if val is not None and str(val).strip() != "":
            fields_present.append(display_name)
        else:
            fields_missing.append(display_name)
            
    for f in fields_present:
        summary += f"✓ {f}\n"
        
    if fields_missing:
        summary += "\nMissing Fields:\n\n"
        for f in fields_missing:
            summary += f"- {f}\n"
            
    ux_status = resolve_ux_status(campaign, missing_fields)
    summary += f"\nStatus:\n\n{ux_status}"
    
    return summary

def get_whatsapp_single_campaign_buttons(campaign: dict) -> dict:
    camp_id = campaign.get('id', '')
    brand = campaign.get('brand_name') or campaign.get('influencer_name') or 'Campaign'
    status_text = resolve_ux_status(campaign).upper()
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
