import json
import structlog
import os
import asyncio
from enum import Enum
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
    QUERY = "QUERY"
    RECOMMENDATION = "RECOMMENDATION"
    CONFIRM_BULK = "CONFIRM_BULK"
    UNKNOWN = "UNKNOWN"

class MissingFieldPriority(str, Enum):
    CRITICAL = "CRITICAL"
    IMPORTANT = "IMPORTANT"

class MissingFieldInfo(BaseModel):
    field_name: str
    priority: MissingFieldPriority
    message: str = Field(description="Polite message asking for this field")

class CampaignExtraction(BaseModel):
    id: Optional[str] = Field(default=None, description="The UUID of the campaign if updating an existing one.")
    brand_name: Optional[str] = Field(default=None, description="The brand or company name. If multiple creators belong to the same brand, group them by this.")
    influencer_name: Optional[str] = Field(default=None, description="Creator Name (CRITICAL)")
    deliverables: Optional[str] = Field(default=None, description="Deliverables (CRITICAL)")
    payment_amount: Optional[float] = Field(default=None, description="Budget / Payment Amount (IMPORTANT)")
    deadline: Optional[str] = Field(default=None, description="Deadline in YYYY-MM-DD (IMPORTANT)")
    platform: Optional[str] = Field(default=None, description="Platform (Optional)")
    special_notes: Optional[str] = Field(default=None, description="Notes (Optional)")
    influencer_handle: Optional[str] = Field(default=None, description="Creator Handle (Optional)")
    destination_url: Optional[str] = Field(default=None, description="Destination URL (Optional)")
    status: Optional[str] = Field(default="draft", description="Status of the campaign: draft, active, cancelled")

class IntentResponse(BaseModel):
    intent: IntentType = Field(description="The primary intent of the user's message.")
    campaigns: List[CampaignExtraction] = Field(default_factory=list, description="Extracted campaigns if CREATE or UPDATE.")
    missing_fields: List[MissingFieldInfo] = Field(default_factory=list, description="Any critical or important fields missing for creation.")
    query_text: Optional[str] = Field(default=None, description="The user's query if intent is QUERY.")
    recommendation_text: Optional[str] = Field(default=None, description="AI suggestion if intent is RECOMMENDATION.")
    target_campaign_id: Optional[str] = Field(default=None, description="If updating, the name or context ID of the campaign to update.")

def get_ai_manager_prompt(context: str = "") -> str:
    return f"""You are the Collabo AI Campaign Manager, an expert assistant for busy founders.
You handle influencer campaigns quickly, accurately, and naturally.

**Your Goal**: Parse the user's message, determine their intent, and extract necessary data.

**Context (Recent Campaigns)**:
{context}

**Intent Types**:
- CREATE: The user is creating one or more new campaigns (e.g. "1 Reel for Priya 15k"). Group by brand if applicable.
- UPDATE: The user is correcting or activating an existing campaign (e.g. "Change deadline to Friday", "Activate Mamaearth", "Delete Sneha").
- QUERY: The user is asking about their campaigns.
- RECOMMENDATION: The user is mentioning a problem or status update naturally.
- CONFIRM_BULK: The user is trying to delete/activate multiple campaigns at once.

**Extraction Rules (For CREATE/UPDATE)**:
1. **Critical Fields**: 'influencer_name' and 'deliverables'. If these are missing in a CREATE intent, add them to `missing_fields`.
2. **Important Fields**: 'payment_amount' and 'deadline'. If missing, add them to `missing_fields`.
3. **Negotiations**: If you detect a budget negotiation (e.g., creator asks for 1.5L, brand says 1.2L max), DO NOT assume the final payment. Set `payment_amount` to null, and STRICTLY prepend 'NEGOTIATION: [summary]' into `special_notes`.
4. **Targeted Activation**: If the user commands an action (e.g., "Activate Mamaearth", "Remove TechGuruji"), identify the matching campaign(s) in context, set their `status` to 'active' or 'cancelled', and return them in the `campaigns` array with the `UPDATE` intent.
5. **Standalone Updates**: If the user provides an isolated value (e.g., '30k', 'tomorrow', '2 Reels') without naming a creator, interpret this as an `UPDATE` intent for the MOST RECENT campaign in the context array.
6. **Languages**: You understand English, Hindi, Tamil, and Hinglish.

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

    api_key = settings.GEMINI_API_KEY_1 or settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY_1") or os.getenv("GEMINI_API_KEY")
    if not api_key:
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

    client = genai.Client(api_key=api_key)
    try:
        return await analyze_message_intent(client, contents, context_str)
    except Exception as e:
        logger.error("process_with_ai_manager_failed", error=str(e))
        # Provide AI Fallback per user requirements
        return IntentResponse(
            intent=IntentType.UNKNOWN,
            recommendation_text="Oops, I couldn't quite understand that. Could you send the campaign details again, or upload a clear screenshot?"
        )
