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

class IntentResponse(BaseModel):
    intent: IntentType = Field(description="The primary intent of the user's message.")
    campaigns: List[CampaignExtraction] = Field(default_factory=list, description="Extracted campaigns if CREATE or UPDATE.")
    query_text: Optional[str] = Field(default=None, description="The user's query if intent is QUERY.")
    recommendation_text: Optional[str] = Field(default=None, description="AI suggestion if intent is RECOMMENDATION.")
    target_campaign_id: Optional[str] = Field(default=None, description="If updating, the name or context ID of the campaign to update.")

def get_ai_manager_prompt(context: str = "") -> str:
    return f"""You are the Collabo AI Campaign Manager, an expert assistant for busy founders.

**Context (Recent Drafts/Campaigns)**:
{context}

**Intent Types**:
- CREATE: The user is creating new collaborations.
- UPDATE: The user is correcting/activating existing collaborations.
- QUERY: Asking about campaigns.
- RECOMMENDATION: Mentioning a problem naturally.
- CONFIRM_BULK: Bulk actions.

**Extraction Resolvers (CRITICAL RULES)**:

1. **Conversation & Replacement Resolver**: 
   - Read the ENTIRE message history provided.
   - Extract ONLY the FINAL state. If a creator was mentioned but then cancelled or removed later in the text, DO NOT extract them. Do not create rows for removed creators.

2. **Campaign Name Resolver**:
   - Determine Campaign Name and Brand Name.
   - IF Campaign Name exists, store it.
   - IF only Brand Name exists, use the Brand Name as `campaign_name` temporarily.
   - IF neither exists, output "Unknown Campaign".
   - NEVER hallucinate names (e.g. "Brand Campaign", "Campaign XYZ").

3. **Ambiguity Rule**:
   - If a value (like payment or deadline) is ambiguous (e.g., "around 20-25k"), incomplete, or conflicting, you MUST leave it as `null`. 
   - Never guess. Missing or ambiguous info is perfectly fine and will be handled by the system later.

4. **Multiple Creator Logic**:
   - For a single campaign with N final creators, output exactly N objects in the `campaigns` array (one per creator collaboration).

5. **Negotiations**:
   - If you detect a budget negotiation, set `payment_amount` to null, and prepend 'NEGOTIATION: [summary]' into `special_notes`.

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
