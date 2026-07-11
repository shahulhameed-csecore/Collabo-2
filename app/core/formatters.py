import html

def format_campaign_summary(campaign: dict, is_review: bool = False) -> str:
    """Helper to format the summary message consistently."""
    handle = campaign.get('influencer_handle') or 'N/A'
    plat = campaign.get('platform') or 'N/A'
    deliv = campaign.get('deliverables') or 'N/A'
    deadl = campaign.get('deadline') or 'N/A'
    
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
    
    prefix = "🤖 <b>Collabo AI</b>\n\n⚠️ Some details were unclear to me. I've saved this as a <b>Draft</b>.\n\n" if is_review else "🤖 <b>I've extracted the following details:</b>\n\n"
    
    return (
        f"{prefix}"
        f"👤 <b>Name:</b> {clean_influencer}\n"
        f"🔗 <b>Handle:</b> {html.escape(handle)}\n"
        f"📱 <b>Platform:</b> {html.escape(plat)}\n"
        f"📦 <b>Deliverables:</b> {html.escape(deliv)}\n"
        f"⏳ <b>Deadline:</b> {html.escape(deadl)}\n"
        f"💰 <b>Payment:</b> ₹{pay:,.2f}\n\n"
        f"───\n"
        f"<b>Is this correct?</b>\n"
        f"Reply <b>Yes</b> to make it Active.\n"
        f"Reply <b>Draft</b> to save it for later.\n"
        f"Reply <b>Delete</b> to discard this campaign.\n\n"
        f"Or, reply with corrections (e.g., 'Payment: 15000', 'Deadline: 20 July')."
    )

def format_campaign_summary_wa(campaign: dict, is_review: bool = False) -> str:
    """Helper to format the summary message consistently for WhatsApp using *bold* instead of HTML."""
    handle = campaign.get('influencer_handle') or 'N/A'
    plat = campaign.get('platform') or 'N/A'
    deliv = campaign.get('deliverables') or 'N/A'
    deadl = campaign.get('deadline') or 'N/A'
    
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
        
    # No HTML escaping needed for WhatsApp, just basic string replacement
    prefix = "🤖 *Collabo AI*\n\n⚠️ Some details were unclear to me. I've saved this as a *Draft*.\n\n" if is_review else "🤖 *I've extracted the following details:*\n\n"
    
    return (
        f"{prefix}"
        f"👤 *Name:* {influencer}\n"
        f"🔗 *Handle:* {handle}\n"
        f"📱 *Platform:* {plat}\n"
        f"📦 *Deliverables:* {deliv}\n"
        f"⏳ *Deadline:* {deadl}\n"
        f"💰 *Payment:* ₹{pay:,.2f}\n\n"
        f"───\n"
        f"*Is this correct?*\n"
        f"Reply *Yes* to make it Active.\n"
        f"Reply *Draft* to save it for later.\n"
        f"Reply *Delete* to discard this campaign.\n\n"
        f"Or, reply with corrections (e.g., 'Payment: 15000', 'Deadline: 20 July')."
    )
