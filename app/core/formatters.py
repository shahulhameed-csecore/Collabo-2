import html

def format_campaign_summary(campaign: dict, is_review: bool = False, missing_fields: list = None) -> str:
    """Helper to format the summary message consistently."""
    handle = campaign.get('influencer_handle') or 'N/A'
    plat = campaign.get('platform') or 'N/A'
    deliv = campaign.get('deliverables') or 'N/A'
    deadl = campaign.get('deadline') or 'N/A'
    notes = campaign.get('special_notes') or 'None'
    status = str(campaign.get('status', 'draft')).title()
    
    raw_pay = campaign.get('payment_amount', 0.0)
    try:
        pay = float(raw_pay) if raw_pay is not None else 0.0
    except ValueError:
        pay = 0.0
        
    influencer_name = campaign.get('influencer_name')
    if not influencer_name or influencer_name == 'Unknown Influencer':
        influencer = handle if handle != 'N/A' else 'Unknown'
    else:
        influencer = influencer_name
        
    clean_influencer = html.escape(influencer)
    
    prefix = "🤖 <b>Collabo AI</b>\n\n⚠️ Some details were unclear to me. I've saved this as a <b>Draft</b>.\n\n" if is_review else "🤖 <b>Extraction Complete!</b>\n\nHere is your campaign summary:\n\n"
    
    summary = (
        f"{prefix}"
        f"👤 <b>Creator:</b> {clean_influencer}\n"
        f"🔗 <b>Handle:</b> {html.escape(handle)}\n"
        f"📱 <b>Platform:</b> {html.escape(plat)}\n"
        f"📦 <b>Deliverables:</b> {html.escape(deliv)}\n"
        f"⏳ <b>Deadline:</b> {html.escape(deadl)}\n"
        f"💰 <b>Payment:</b> ₹{pay:,.2f}\n"
        f"📝 <b>Notes:</b> {html.escape(notes)}\n"
        f"📌 <b>Status:</b> {html.escape(status)}\n\n"
    )
    
    if missing_fields:
        missing_str = "\n- ".join([f.field_name for f in missing_fields])
        summary += f"⚠️ <b>I'm missing:</b>\n- {missing_str}\n\nReply to add them or make corrections (e.g., 'Increase payment to 30k')."
    else:
        summary += (
            f"───\n"
            f"<b>Ready to proceed?</b>\n"
            f"Reply <b>Activate</b> to make it live.\n"
            f"Reply <b>Delete</b> to discard this campaign.\n\n"
            f"Or, reply with corrections (e.g., 'Payment: 15000')."
        )
        
    return summary

def format_campaign_summary_wa(campaign: dict, is_review: bool = False, missing_fields: list = None) -> str:
    """Helper to format the summary message consistently for WhatsApp using *bold* instead of HTML."""
    handle = campaign.get('influencer_handle') or 'N/A'
    plat = campaign.get('platform') or 'N/A'
    deliv = campaign.get('deliverables') or 'N/A'
    deadl = campaign.get('deadline') or 'N/A'
    notes = campaign.get('special_notes') or 'None'
    status = str(campaign.get('status', 'draft')).title()
    
    raw_pay = campaign.get('payment_amount', 0.0)
    try:
        pay = float(raw_pay) if raw_pay is not None else 0.0
    except ValueError:
        pay = 0.0
        
    influencer_name = campaign.get('influencer_name')
    if not influencer_name or influencer_name == 'Unknown Influencer':
        influencer = handle if handle != 'N/A' else 'Unknown'
    else:
        influencer = influencer_name
        
    prefix = "🤖 *Collabo AI*\n\n⚠️ Some details were unclear to me. I've saved this as a *Draft*.\n\n" if is_review else "🤖 *Extraction Complete!*\n\nHere is your campaign summary:\n\n"
    
    summary = (
        f"{prefix}"
        f"👤 *Creator:* {influencer}\n"
        f"🔗 *Handle:* {handle}\n"
        f"📱 *Platform:* {plat}\n"
        f"📦 *Deliverables:* {deliv}\n"
        f"⏳ *Deadline:* {deadl}\n"
        f"💰 *Payment:* ₹{pay:,.2f}\n"
        f"📝 *Notes:* {notes}\n"
        f"📌 *Status:* {status}\n\n"
    )
    
    if missing_fields:
        missing_str = "\n- ".join([f.field_name for f in missing_fields])
        summary += f"⚠️ *I'm missing:*\n- {missing_str}\n\nReply to add them or make corrections (e.g., 'Increase payment to 30k')."
    else:
        summary += (
            f"───\n"
            f"*Ready to proceed?*\n"
            f"Reply *Activate* to make it live.\n"
            f"Reply *Delete* to discard this campaign.\n\n"
            f"Or, reply with corrections (e.g., 'Payment: 15000')."
        )
        
    return summary
