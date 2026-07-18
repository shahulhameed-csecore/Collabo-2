import json
import structlog
import os
import asyncio
from enum import Enum
from datetime import datetime
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
   - If the context is empty or you cannot logically determine the target, return `CLARIFICATION` and ask: "I couldn't determine which creator collaboration you'd like to update. Please mention the creator's name."

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
   - If a date is provided without a year (e.g. '20 july' or '20/07'), assume the current year is {datetime.now().year} and format it as YYYY-MM-DD. Do NOT mark it as null.

**Output Rules**:
Respond STRICTLY in JSON format matching the schema provided. Do not include markdown formatting or outside text.
"""

@retry(wait=wait_exponential(multiplier=1, min=2, max=10), stop=stop_after_attempt(3))
async def analyze_message_intent(
    client: genai.Client, 
    contents: list, 
    context_str: str = ""
) -> IntentResponse:
    """Analyzes a message using Gemini to determine intent and extract data."""
    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model='gemini-2.5-flash',
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
    file_bytes: bytes, 
    mime_type: str, 
    text_content: str = "",
    context_str: str = ""
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
    elif mime_type.startswith("text/"):
        text_fallback = file_bytes.decode('utf-8', errors='ignore')
        contents.append(text_fallback)

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
            return await analyze_message_intent(client, contents, context_str)
        except Exception as e:
            logger.error(f"process_with_ai_manager_failed_{key_name.lower().replace(' ', '_')}", error=str(e))
            last_error = e
            continue

    # Provide AI Fallback if all keys fail
        # Provide AI Fallback per user requirements
        return IntentResponse(
            intent=IntentType.UNKNOWN,
            recommendation_text="Oops, I couldn't quite understand that. Could you send the campaign details again, or upload a clear screenshot?"
        )
