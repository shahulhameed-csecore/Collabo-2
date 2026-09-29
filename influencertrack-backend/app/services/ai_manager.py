import json
import structlog
import os
import asyncio
from enum import Enum
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from typing import List, Optional, Dict, Any
from app.core.config import settings
from tenacity import retry, wait_exponential, stop_after_attempt

logger = structlog.get_logger(__name__)

class IntentType(str, Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    ACTIVATE = "ACTIVATE"
    PAUSE = "PAUSE"
    QUERY = "QUERY"
    RECOMMENDATION = "RECOMMENDATION"
    CLARIFICATION = "CLARIFICATION"
    GREETING = "GREETING"
    UNKNOWN = "UNKNOWN"

# Missing fields are now calculated in the UI formatter, removing MissingFieldInfo classes

class CampaignExtraction(BaseModel):
    id: Optional[str] = Field(default=None, description="The UUID of the campaign if updating an existing one.")
    campaign_name: Optional[str] = Field(default=None, description="The actual campaign name. Do not hallucinate.")
    brand_name: Optional[str] = Field(default=None, description="The brand name.")
    influencer_name: Optional[str] = Field(default=None, description="Creator Name (Mandatory for creation)")
    deliverables: Optional[str] = Field(default=None, description="Deliverables")
    payment_amount: Optional[float] = Field(default=None, description="Budget / Payment Amount. Set to null if ambiguous.")
    deadline: Optional[str] = Field(default=None, description="Deadline in YYYY-MM-DD. Set to null if ambiguous.")
    platform: Optional[str] = Field(default=None, description="Platform (Optional)")
    special_notes: Optional[str] = Field(default=None, description="Notes (Optional)")
    influencer_handle: Optional[str] = Field(default=None, description="Creator Handle (Optional)")
    destination_url: Optional[str] = Field(default=None, description="Destination URL (Optional)")
    status: Optional[str] = Field(default="draft", description="Status of the campaign: draft, active, cancelled")

class QueryFilters(BaseModel):
    status: Optional[str] = Field(default=None, description="draft, active, paused, cancelled, completed")
    brand_name: Optional[str] = Field(default=None, description="Specific brand to filter by")
    is_negotiation: Optional[bool] = Field(default=None, description="True if asking for pending negotiations")
    due_this_week: Optional[bool] = Field(default=None, description="True if asking for deadlines this week")
    due_today: Optional[bool] = Field(default=None, description="True if asking for deadlines today")
    missing_payment: Optional[bool] = Field(default=None, description="True if asking for missing payments/waiting for details")

class IntentResponse(BaseModel):
    intent: IntentType = Field(description="The primary intent of the user's message.")
    campaigns: List[CampaignExtraction] = Field(default_factory=list, description="Extracted campaigns if CREATE or UPDATE.")
    query_text: Optional[str] = Field(default=None, description="The user's original query if intent is QUERY.")
    query_filters: Optional[QueryFilters] = Field(default=None, description="Structured filters for QUERY intent.")
    recommendation_text: Optional[str] = Field(default=None, description="AI suggestion/clarification text.")
    target_campaign_ids: List[str] = Field(default_factory=list, description="List of target campaign UUIDs for UPDATE, DELETE, ACTIVATE, PAUSE.")

def get_ai_manager_prompt(context: str = "") -> str:
    ist_now = datetime.now(timezone(timedelta(hours=5, minutes=30)))
    current_date = ist_now.strftime("%Y-%m-%d")
    current_year = ist_now.year
    
    return f"""You are the Collabo AI Campaign Manager, an expert assistant for busy founders.

**Context (Recent Drafts/Campaigns)**:
{context}

**Intent Types**:
- CREATE: The user is creating new collaborations.
- UPDATE: The user is updating data (payment, deadline, deliverables) of existing collaborations.
- DELETE: The user wants to delete or remove collaborations.
- ACTIVATE: The user wants to activate collaborations.
- PAUSE: The user wants to pause collaborations.
- QUERY: Asking about campaigns, filtering by status, date, brand, etc. (Mini-dashboard).
- RECOMMENDATION: Proactive suggestions.
- CLARIFICATION: Asking the user for clarification due to ambiguity or safety rules.

**Core Safety & Workflow Rules (CRITICAL)**:

1. **No AI Guessing & Draft Context Window**: 
   - If the user provides a standalone update (e.g. "25k", "Friday") but there are multiple drafts in the context, you MUST NOT guess which one to update. Set intent to `CLARIFICATION` and ask: "I found multiple collaborations. Which creator would you like to update? (e.g. Rohan or Sneha)".
   - If the context is empty or you cannot logically determine the target of an UPDATE, return `CLARIFICATION` and ask: "I couldn't determine which creator collaboration you'd like to update. Please mention the creator's name."
   - HOWEVER, if the user provides a DETAILED campaign brief (brand, payment, deliverables, terms, etc.) but omits the creator's name, treat it as a `CREATE` intent. Extract the details and set `influencer_name` to "Unknown Creator". Do NOT ask for clarification.

2. **Negotiation Safety Rule**:
   - You MUST NEVER assume or calculate payment values.
   - If the user says "Approve negotiation" or "Finalize it", you MUST NOT automatically decide the final amount (even if they previously discussed 1.2L vs 1.5L).
   - Set intent to `CLARIFICATION` and ask: "Please provide the final agreed payment amount."

3. **Bulk Operations Support**:
   - You understand bulk commands like "Activate all Mamaearth creators", "Delete all drafts", "Increase everyone's payment by 5000".
   - Identify ALL matching campaigns from the Context, and output their UUIDs in `target_campaign_ids`.
   - Set the intent to the corresponding action (`ACTIVATE`, `DELETE`, `UPDATE`, `PAUSE`).

4. **Expanded QUERY Capabilities**:
   - If the user asks "Which campaigns are due this week?", "Show active campaigns", "Show pending negotiations", set intent to `QUERY`.
   - Populate `query_filters` with the appropriate booleans/strings. 
   - Never answer the query yourself (you don't have the full DB). Just extract the intent and filters.

5. **Conversation & Replacement Resolver (For CREATE)**: 
   - Extract ONLY the FINAL state. If a creator was mentioned but then cancelled later in the text, DO NOT extract them.

6. **Ambiguity & Date Parsing Rule**:
   - If a value (like payment) is ambiguous, set it to `null`. 
   - If a date is provided without a year (e.g. '20 july' or '20/07'), assume the current year is {current_year} and format it as YYYY-MM-DD. Do NOT mark it as null.
   - For relative dates like "tomorrow" or "today", calculate the date based on the current IST date: {current_date}.

7. **Clarification Follow-ups**:
   - If the user's message starts with "Previous Context:" followed by "User Clarification:", this means the user is answering a previous clarifying question.
   - You MUST combine the details from BOTH the previous context and the clarification into a SINGLE cohesive request.
    - For example, if the previous context was a new campaign brief, the combined result is a `CREATE` intent. Do not mistake it for an `UPDATE` to existing campaigns. Do not ask for clarification again.

8. **Greetings**:
   - If the user sends a simple greeting like "Hi", "Hello", "Good morning", or "Hey bot", set the intent to `GREETING` and do not populate any other fields.

**Language Rules**:
You fluently understand and parse Hinglish (Hindi + English) user input.

**Output Rules**:
Respond STRICTLY in JSON format matching the schema provided. Do not include markdown formatting or outside text.
"""

from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception

def is_retryable_error(exception: Exception) -> bool:
    err_str = str(exception).lower()
    if "404" in err_str or "not_found" in err_str or "400" in err_str or "invalid_argument" in err_str:
        return False
    return True

@retry(wait=wait_exponential(multiplier=1, min=2, max=10), stop=stop_after_attempt(3), retry=retry_if_exception(is_retryable_error))
async def analyze_message_intent(
    client: genai.Client, 
    contents: list, 
    context_str: str = "",
    model: str = 'gemini-3.5-flash'
) -> IntentResponse:
    """Analyzes a message using Gemini to determine intent and extract data."""
    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=get_ai_manager_prompt(context_str),
                response_mime_type="application/json",
                response_schema=IntentResponse,
                temperature=0.1
            )
        )
        # Manually load the JSON since response.text is a JSON string
        data = json.loads(response.text)
        return IntentResponse(**data)
    except Exception as e:
        logger.error("ai_manager_intent_analysis_failed", error=str(e))
        raise e

async def process_with_ai_manager(
    file_bytes: bytes = b"", 
    mime_type: str = "text/plain", 
    text_content: str = "",
    context_str: str = "",
    media_items: list = None
) -> IntentResponse:
    """
    Main entry point for AI analysis. Handles multi-modal inputs.
    Returns a structured IntentResponse.
    """
    from app.services.gemini import compress_image, parse_pdf, parse_docx, detect_prompt_injection

    api_key_1 = settings.GEMINI_API_KEY_1 or settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY_1") or os.getenv("GEMINI_API_KEY")
    api_key_2 = settings.GEMINI_API_KEY_2 or os.getenv("GEMINI_API_KEY_2")
    
    keys_to_try = []
    if api_key_1:
        keys_to_try.append(("Key 1", api_key_1))
    if api_key_2:
        keys_to_try.append(("Key 2", api_key_2))
        
    if not keys_to_try:
        raise ValueError("GEMINI_API_KEY is not configured")

    contents = []
    text_fallback = ""

    # Reuse existing multi-modal parsing logic
    if mime_type == "application/pdf":
        text, images = await asyncio.to_thread(parse_pdf, file_bytes)
        if text.strip():
            contents.append(text)
            text_fallback = text
    elif mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        text = await asyncio.to_thread(parse_docx, file_bytes)
        if text.strip():
            contents.append(text)
            text_fallback = text
    elif mime_type.startswith("image/"):
        compressed = await asyncio.to_thread(compress_image, file_bytes)
        if compressed:
            contents.append(types.Part.from_bytes(data=compressed, mime_type="image/jpeg"))
    elif mime_type.startswith("audio/"):
        contents.append(types.Part.from_bytes(data=file_bytes, mime_type=mime_type))
    elif mime_type.startswith("text/") and file_bytes:
        text_fallback = file_bytes.decode('utf-8', errors='ignore')
        contents.append(text_fallback)

    if media_items:
        for item in media_items:
            m_type = item.get("mime_type", "")
            m_bytes = item.get("bytes", b"")
            if m_type.startswith("image/"):
                compressed = await asyncio.to_thread(compress_image, m_bytes)
                if compressed:
                    contents.append(types.Part.from_bytes(data=compressed, mime_type="image/jpeg"))
            elif m_type.startswith("audio/"):
                contents.append(types.Part.from_bytes(data=m_bytes, mime_type=m_type))

    if text_content:
        contents.append(text_content)
        text_fallback += "\n" + text_content

    if not contents:
        contents.append(text_fallback if text_fallback else "Empty message")

    if detect_prompt_injection(text_fallback):
        return IntentResponse(
            intent=IntentType.UNKNOWN,
            recommendation_text="Security Alert: Suspicious instructions detected. Please send a normal message."
        )

    last_error = None
    for key_name, api_key in keys_to_try:
        client = genai.Client(api_key=api_key)
        try:
            # Stage 1: Try 3.5 Flash
            return await analyze_message_intent(client, contents, context_str, model='gemini-3.5-flash')
        except Exception as e:
            err_str = str(e).lower()
            if "400" in err_str or "invalid" in err_str or "not found" in err_str:
                logger.warning(f"ai_manager_invalid_argument_falling_back_to_2_5_{key_name.lower().replace(' ', '_')}")
                try:
                    # Stage 2: Fallback to 2.5 Flash
                    return await analyze_message_intent(client, contents, context_str, model='gemini-2.5-flash')
                except Exception as fallback_e:
                    logger.error(f"ai_manager_fallback_failed_{key_name.lower().replace(' ', '_')}", error=str(fallback_e))
                    last_error = fallback_e
                    continue
            else:
                logger.error(f"process_with_ai_manager_failed_{key_name.lower().replace(' ', '_')}", error=str(e))
                last_error = e
                continue

    # Provide AI Fallback if all keys fail
    return IntentResponse(
        intent=IntentType.UNKNOWN,
        recommendation_text="Oops, I couldn't quite understand that. Could you send the campaign details again, or upload a clear screenshot?"
    )

async def check_user_eligibility(supabase_admin, sender_id: str, platform: str) -> tuple[bool, str | None]:
    """
    Checks if a user has an active Pro subscription or an active trial.
    Returns (is_eligible, user_id).
    """
    # 1. Normalize the sender ID
    if platform == "wa":
        clean_sender = "".join(filter(str.isdigit, sender_id))
        possible_ids = [clean_sender, f"+{clean_sender}"]
        if clean_sender.startswith("91") and len(clean_sender) > 10:
            base = clean_sender[2:]
            possible_ids.extend([base, f"0{base}", f"+91{base}"])
        elif clean_sender.startswith("1") and len(clean_sender) > 10:
            base = clean_sender[1:]
            possible_ids.extend([base, f"+1{base}"])
        if len(clean_sender) == 10:
            possible_ids.extend([f"91{clean_sender}", f"+91{clean_sender}"])
        possible_ids = list(set(possible_ids))
        column_name = "whatsapp_number"
    else:  # Telegram or other platforms
        possible_ids = [str(sender_id)]
        column_name = "telegram_id"

    # 2. Query user_settings to get the user_id
    try:
        user_response = await (supabase_admin.table("user_settings")
            .select("user_id")
            .in_(column_name, possible_ids)
            .execute()
        )
    except Exception as e:
        logger.error("Failed to query user settings for eligibility", error=str(e))
        return False, None

    if not user_response.data:
        return False, None
        
    user_id = user_response.data[0]["user_id"]
    
    # 3. Query subscriptions for the user_id
    try:
        sub_response = await (supabase_admin.table("subscriptions")
            .select("tier, plan, status, trial_ends_at")
            .eq("user_id", user_id)
            .execute()
        )
    except Exception as e:
        logger.error("Failed to query subscriptions", error=str(e))
        return False, user_id
        
    if not sub_response.data:
        return False, user_id
        
    sub = sub_response.data[0]
    tier = str(sub.get("tier") or sub.get("plan") or "").lower()
    status = str(sub.get("status") or "").lower()
    
    # Eligibility Rule 1: Active Pro Subscription
    if tier == "pro" and status == "active":
        return True, user_id
        
    # Eligibility Rule 2: Active Trial
    trial_ends_at_str = sub.get("trial_ends_at")
    if trial_ends_at_str:
        try:
            if trial_ends_at_str.endswith("Z"):
                trial_ends_at_str = trial_ends_at_str[:-1] + "+00:00"
            trial_ends = datetime.fromisoformat(trial_ends_at_str)
            if trial_ends.tzinfo is None:
                trial_ends = trial_ends.replace(tzinfo=timezone.utc)
                
            if trial_ends > datetime.now(timezone.utc):
                return True, user_id
        except Exception as e:
            logger.error("Error parsing trial_ends_at", error=str(e))
            
    return False, user_id


async def increment_ai_extractions(supabase_admin, user_id: str):
    """
    Safely increments the AI extraction count for the user.
    """
    try:
        sub_resp = await supabase_admin.table("subscriptions").select("ai_extractions_count").eq("user_id", user_id).execute()
        if sub_resp.data:
            current_count = sub_resp.data[0].get("ai_extractions_count") or 0
            await supabase_admin.table("subscriptions").update({"ai_extractions_count": current_count + 1}).eq("user_id", user_id).execute()
    except Exception as e:
        logger.error("Failed to increment ai_extractions_count", error=str(e))
