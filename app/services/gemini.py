import json
import logging
from google import genai
from google.genai.errors import APIError
from PIL import Image
from pydantic import ValidationError
from app.core.config import settings
from app.schemas.campaign import ExtractionResult

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.GEMINI_API_KEY)

PROMPT = """
You are an AI assistant specialized in extracting micro-influencer campaign details from screenshots of WhatsApp chats, Instagram DMs, or emails, specifically tailored to Indian influencer colloquialisms.

Extract the following details from the provided image:
- influencer_name: The name of the influencer.
- influencer_handle: Their social media handle (e.g., @username).
- platform: The platform (e.g., Instagram, YouTube).
- deliverables: What the influencer is expected to post (e.g., 1 Reel, 2 Stories).
- deadline: The expected deadline in YYYY-MM-DD format, if available.
- payment_amount: The monetary compensation in INR. If it's a "barter" or "gifted" collaboration, set this to 0.0. Look out for "k" meaning thousand (e.g., 5k = 5000.0).
- special_notes: Any other specific instructions or notes.

Return the data STRICTLY as a valid JSON object matching this schema:
{
  "influencer_name": "string or null",
  "influencer_handle": "string or null",
  "platform": "string or null",
  "deliverables": "string or null",
  "deadline": "YYYY-MM-DD or null",
  "payment_amount": 0.0,
  "special_notes": "string or null"
}
Do not include markdown blocks or any other text outside the JSON object.
"""

def extract_campaign_details(image: Image.Image) -> dict:
    try:
        response = client.models.generate_content(
            model='gemini-3.5-flash',
            contents=[PROMPT, image]
        )
        response_text = response.text.strip()
        
        if response_text.startswith("```json"):
            response_text = response_text[7:-3].strip()
        elif response_text.startswith("```"):
            response_text = response_text[3:-3].strip()
            
        data = json.loads(response_text)
        validated_data = ExtractionResult(**data)
        
        requires_review = False
        if not validated_data.influencer_handle or not validated_data.deliverables:
            requires_review = True
            
        result_dict = validated_data.model_dump()
        result_dict['requires_human_review'] = requires_review
        return result_dict
        
    except (APIError, json.JSONDecodeError, ValidationError) as e:
        logger.error(f"Gemini AI Extraction Failed: {str(e)}")
        # Fallback to manual entry if AI fails
        return {
            "influencer_name": None,
            "influencer_handle": None,
            "platform": None,
            "deliverables": None,
            "deadline": None,
            "payment_amount": 0.0,
            "special_notes": "AI Extraction failed. Please enter details manually.",
            "requires_human_review": True
        }
    except Exception as e:
        logger.exception("Unexpected error during Gemini extraction")
        return {
            "influencer_name": None,
            "influencer_handle": None,
            "platform": None,
            "deliverables": None,
            "deadline": None,
            "payment_amount": 0.0,
            "special_notes": "Critical error during AI processing. Please enter details manually.",
            "requires_human_review": True
        }
