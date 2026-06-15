import json
import logging
from datetime import datetime
from google import genai
from google.genai import types
from google.genai.errors import APIError
from PIL import Image
from pydantic import BaseModel, Field, ValidationError

from app.core.config import settings

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.GEMINI_API_KEY)

# ─── 1. Strict Output Schema ───────────────────────────────────────────────────
# Defining this schema forces Gemini to guarantee the output structure.
class GeminiExtractionSchema(BaseModel):
    influencer_name: str = Field(description="The human name of the influencer or brand rep (e.g. Riya Sharma, Chloe Summers).")
    influencer_handle: str | None = Field(description="The social media handle (e.g. @riya_creates). If none explicitly stated, leave null.")
    platform: str | None = Field(description="The target platform (Instagram, YouTube, TikTok, Pinterest, LinkedIn). Infer from context (e.g. 'Reel' -> Instagram).")
    deliverables: str = Field(description="Summarize exactly what they need to post (e.g., '1 Reel + 2 Stories', '1 YouTube Integration').")
    deadline: str | None = Field(description="The target date for the draft or final post in strictly YYYY-MM-DD format.")
    payment_amount: float | None = Field(description="Monetary compensation in INR. (e.g. '5k' = 5000.0). If barter/gifted/sample, output 0.0.")
    special_notes: str | None = Field(description="Any brand guidelines, moodboard links, or vital context.")

# ─── 2. Optimized Prompt ───────────────────────────────────────────────────────
def get_extraction_prompt() -> str:
    today_str = datetime.now().strftime("%Y-%m-%d (%A)")
    return f"""
You are a Principal AI Data Extraction Engineer specializing in micro-influencer marketing.
Your goal is to extract structured campaign details from messy screenshots of WhatsApp chats, Instagram DMs, or emails.
The text may be in English, Hindi (Hinglish), or a mix.

CURRENT CONTEXT:
- Today's Date: {today_str}
- If the screenshot has its own date (e.g. an email header), use that as the anchor date instead.

EXTRACTION RULES:
1. `deadline`: Parse relative dates logically. "This Friday" means the upcoming Friday from the anchor date. Format strictly as YYYY-MM-DD.
2. `payment_amount`: Look for terms like "k" (5k = 5000.0).
   CRITICAL: If the text mentions "barter", "collab", "gifted", "sample", "sending product", or no money is discussed, output 0.0.
3. `platform`: If missing, infer heavily from terminology. "Shorts" = YouTube, "Reel/Story" = Instagram.
4. `deliverables`: Be precise. E.g. "1 dedicated video", "2 story frames".
5. `influencer_name` & `influencer_handle`: Differentiate between the brand rep sending the message and the influencer receiving it. If the handle is missing, infer a probable handle based on their name (e.g. @chloesummers).
6. `special_notes`: Capture any creative guidelines. If the agreement is partial/missing key info, note it here so the human reviewer knows.

Extract the data and adhere strictly to the JSON schema.
"""

def get_fallback_data(message: str) -> dict:
    return {
        "influencer_name": None,
        "influencer_handle": None,
        "platform": None,
        "deliverables": None,
        "deadline": None,
        "payment_amount": 0.0,
        "special_notes": message,
        "requires_human_review": True,
        "status": "draft"
    }

# ─── 3. Processing Logic ───────────────────────────────────────────────────────
def extract_campaign_details(image: Image.Image) -> dict:
    try:
        # Preprocessing: Resize to max 1024x1024 to save cost and focus AI on primary content
        if image.mode != "RGB":
            image = image.convert("RGB")
        image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)

        response = client.models.generate_content(
            model='gemini-3.5-flash',
            contents=[get_extraction_prompt(), image],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=GeminiExtractionSchema,
                temperature=0.1, # Low temperature for highly deterministic extraction
            )
        )
        
        # Parse the guaranteed JSON string (stripping markdown if Gemini accidentally adds it)
        response_text = response.text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:-3].strip()
        elif response_text.startswith("```"):
            response_text = response_text[3:-3].strip()
            
        data = json.loads(response_text)
        
        # Enforce HITL (Human-In-The-Loop) rules
        requires_review = False
        # Since influencer_name and deliverables are strictly required by the schema,
        # Gemini will output them. We check if they are empty strings or missing.
        if not data.get('influencer_handle') or not data.get('deliverables') or not data.get('influencer_name'):
            requires_review = True
            
        # Handle Pydantic validation crashes:
        # If Gemini returns null for payment_amount, force it to 0.0 to satisfy the strict FastAPI ExtractionResult schema
        if data.get('payment_amount') is None:
            data['payment_amount'] = 0.0
            
        data['requires_human_review'] = requires_review
        data['status'] = 'draft'
        
        return data
        
    except (APIError, json.JSONDecodeError, ValidationError) as e:
        logger.error(f"Gemini AI Extraction Failed: {str(e)}")
        return get_fallback_data("AI Extraction failed. Please enter details manually.")
    except Exception as e:
        logger.exception("Unexpected error during Gemini extraction")
        return get_fallback_data("Critical error during AI processing. Please enter details manually.")
