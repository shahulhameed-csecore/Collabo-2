import re
import html
from datetime import datetime, timedelta

def parse_date_string(date_str: str) -> str | None:
    """Parses natural language dates into YYYY-MM-DD."""
    date_str = date_str.strip().lower()
    
    # 0. Already in YYYY-MM-DD format (from Gemini)
    if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
        try:
            datetime.strptime(date_str, "%Y-%m-%d")
            return date_str
        except ValueError:
            pass
            
    # Remove common conversational time words to simplify parsing
    date_str = re.sub(r'\b(shaam|subah|morning|evening|night|raat|ko|in the|at|by|on)\b', '', date_str).strip()
    
    today = datetime.now()
    
    # 1. Hinglish and relative words
    if date_str in ["today", "aaj"]:
        return today.strftime("%Y-%m-%d")
    if date_str in ["tomorrow", "kal", "tmrw"]:
        return (today + timedelta(days=1)).strftime("%Y-%m-%d")
    if date_str in ["day after tomorrow", "parso", "parson"]:
        return (today + timedelta(days=2)).strftime("%Y-%m-%d")
        
    # 2. Next <day>
    days_of_week = {"monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6}
    if date_str.startswith("next "):
        day_str = date_str.replace("next ", "").strip()
        for day, idx in days_of_week.items():
            if day_str.startswith(day[:3]):
                days_ahead = idx - today.weekday()
                if days_ahead <= 0:
                    days_ahead += 7
                return (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
                
    # 3. Format: DD/MM/YYYY, DD-MM-YYYY, DD/MM
    dm_match = re.search(r'^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$', date_str)
    if dm_match:
        d, m = int(dm_match.group(1)), int(dm_match.group(2))
        y_str = dm_match.group(3)
        y = int(y_str) if y_str else today.year
        if y < 100: y += 2000
        try:
            return datetime(y, m, d).strftime("%Y-%m-%d")
        except ValueError:
            pass
            
    # 4. Format: 5 July, July 5, 10 july 2026
    month_map = {
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6, 
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12
    }
    
    text_date_match = re.search(r'(\d{1,2})[\s]+([a-z]{3,})[\s,]*(\d{2,4})?', date_str)
    if not text_date_match:
        text_date_match = re.search(r'([a-z]{3,})[\s]+(\d{1,2})[\s,]*(\d{2,4})?', date_str)
        if text_date_match:
            m_str, d_str, y_str = text_date_match.groups()
        else:
            return None
    else:
        d_str, m_str, y_str = text_date_match.groups()
        
    for m_key in month_map:
        if m_str.startswith(m_key):
            d, m = int(d_str), month_map[m_key]
            y = int(y_str) if y_str else today.year
            if y < 100: y += 2000
            try:
                return datetime(y, m, d).strftime("%Y-%m-%d")
            except ValueError:
                pass
                
    return None

def parse_corrections(text: str) -> tuple[dict, str | None]:
    """Parses natural key-value pairs like 'Payment 15000', 'name: neha', 'influencer handle @neha'"""
    corrections = {}
    unparsed_date_msg = None
    lines = text.split('\n')
    
    # Matches optional words like "change", "set", "influencer", "campaign", "the" before the keyword
    pattern = re.compile(
        r'^(?:(?:change|set|update|make)\s+)?'
        r'(?:(?:influencer|campaign|the)\s+)?'
        r'(name|handle|platform|deliverables?|deadline|date|payment|amount|price|fee|notes?)'
        r'(?:\s*:\s*|\s*=\s*|\s+is\s+|\s+to\s+|\s+)'
        r'(.+)$', 
        re.IGNORECASE
    )
    
    for line in lines:
        line = line.strip()
        if not line: continue
        
        match = pattern.match(line)
        if match:
            key = match.group(1).lower()
            val = match.group(2).strip()
            if not val: continue
            
            if 'name' in key: 
                corrections['influencer_name'] = val
            elif 'handle' in key: 
                # ensure handle starts with @ if missing and no spaces
                if not val.startswith('@') and ' ' not in val:
                    val = '@' + val
                corrections['influencer_handle'] = val
            elif 'platform' in key: 
                corrections['platform'] = val
            elif 'deliverable' in key: 
                corrections['deliverables'] = val
            elif 'deadline' in key or 'date' in key: 
                parsed_date = parse_date_string(val)
                if parsed_date:
                    corrections['deadline'] = parsed_date
                else:
                    unparsed_date_msg = val
            elif 'payment' in key or 'amount' in key or 'price' in key or 'fee' in key:
                num_match = re.search(r'\d+(?:[.,]\d+)?', val)
                if num_match:
                    # Remove commas for float conversion
                    clean_num = num_match.group(0).replace(',', '')
                    corrections['payment_amount'] = float(clean_num)
            elif 'note' in key: 
                corrections['special_notes'] = val

    return corrections, unparsed_date_msg

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

def get_valid_transitions() -> dict[str, list[str]]:
    """Defines the valid state transitions for campaigns."""
    return {
        "draft": ["active", "cancelled"],
        "active": ["cancelled"], # 'content_received' happens via file upload only
        "content_received": ["approved", "rejected", "cancelled"],
        "approved": ["paid", "cancelled"],
        "paid": ["cancelled"],
        "rejected": ["active", "cancelled", "approved", "content_received"], # allow restoring to active, or direct approval
        "cancelled": ["draft", "active"] # allow restoring from cancelled
    }

def handle_db_error(e: Exception, logger, context: str, user_id: str | None = None) -> None:
    """Parses database errors and raises appropriate HTTP exceptions."""
    from fastapi import HTTPException
    logger.error(context, error=type(e).__name__, detail=str(e), user_id=user_id)
    error_msg = str(e).lower()
    if "violates unique constraint" in error_msg and "short_code" in error_msg:
        raise HTTPException(status_code=400, detail="A tracking code conflict occurred. Please try again.")
    if "foreign key" in error_msg:
        raise HTTPException(status_code=400, detail="Invalid data reference. Make sure the linked data exists.")
    if "not-null" in error_msg:
        raise HTTPException(status_code=400, detail="Please fill in all required fields.")
    if "violates" in error_msg:
        raise HTTPException(status_code=400, detail="The provided data is invalid. Please double-check your inputs.")
    raise HTTPException(status_code=500, detail="An internal error occurred. Please try again or contact support if the issue persists.")
