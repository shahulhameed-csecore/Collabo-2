import json
import logging
from datetime import datetime
from google import genai
from google.genai import types
from google.genai.errors import APIError
from PIL import Image, ImageOps
from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.GEMINI_API_KEY)


class GeminiExtractionSchema(BaseModel):
    influencer_name: str = Field(description="Full name of the influencer or contact person")
    influencer_handle: str | None = Field(description="Social handle like @riya_creates")
    platform: str = Field(description="Instagram, TikTok, YouTube, or Others")
    deliverables: str = Field(description="What they agreed to do (e.g. '2 Reels + 3 Stories')")
    deadline: str | None = Field(description="Deadline in YYYY-MM-DD format")
    payment_amount: float | None = Field(description="Payment in INR. 0.0 if gifted or barter")
    special_notes: str | None = Field(description="Any additional context or instructions")


def get_extraction_prompt(today_str: str, filename: str = "image.png") -> str:
    return f"""
You are an expert micro-influencer campaign manager for Indian D2C brands.

Analyze the uploaded file ({filename}) and extract the deal.
The file could be an image screenshot, a PDF contract, a text email, or a Word document.

Today's date is: {today_str}

Return ONLY valid JSON with these exact keys:

{{
  "influencer_name": string,
  "influencer_handle": string or null,
  "platform": "Instagram" or "TikTok" or "YouTube" or "Others",
  "deliverables": string,
  "deadline": "YYYY-MM-DD" or null,
  "payment_amount": number or null,
  "special_notes": string or null
}}

CRITICAL RULES:
- If it's a gifted product, sample, or barter → payment_amount = 0.0
- For relative dates ("next Friday", "this Wednesday", "by EOD") calculate from today's date
- Be precise with deliverables
- If information is missing, make best logical guess

Do not add any extra text outside the JSON.
"""


def extract_campaign_details(content: Image.Image | str, filename: str = "image.png") -> dict:
    try:
        today_str = datetime.now().strftime("%Y-%m-%d (%A)")
        gemini_content = [get_extraction_prompt(today_str, filename)]

        if isinstance(content, Image.Image):
            # --- Image Preprocessing (Critical for Reliability) ---
            if content.mode != "RGB":
                content = content.convert("RGB")
            
            # Resize to max 1024px while keeping aspect ratio
            content.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
            
            # Auto-rotate based on EXIF if needed
            content = ImageOps.exif_transpose(content)
            gemini_content.append(content)
        else:
            # Append extracted text
            gemini_content.append(f"--- START OF FILE CONTENT ---\n{content}\n--- END OF FILE CONTENT ---")

        response = client.models.generate_content(
            model="gemini-2.0-flash-exp",   # Best stable model
            contents=gemini_content,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=GeminiExtractionSchema,
                temperature=0.1,
            )
        )

        # Clean response text
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:-3].strip()
        elif text.startswith("```"):
            text = text[3:-3].strip()

        data = json.loads(text)

        # Smart defaults & Human-in-the-Loop
        data['requires_human_review'] = not bool(data.get('influencer_name') and data.get('deliverables'))
        data['status'] = 'draft'

        if data.get('payment_amount') is None:
            data['payment_amount'] = 0.0

        # Protect against strict Pydantic date crashes
        deadline_str = data.get('deadline')
        if deadline_str:
            try:
                datetime.strptime(deadline_str, "%Y-%m-%d")
            except ValueError:
                data['deadline'] = None

        return data

    except Exception as e:
        logger.error(f"Gemini Extraction Failed: {str(e)}", exc_info=True)
        return {
            "influencer_name": None,
            "influencer_handle": None,
            "platform": None,
            "deliverables": None,
            "deadline": None,
            "payment_amount": 0.0,
            "special_notes": "AI Extraction failed. Please enter details manually.",
            "requires_human_review": True,
            "status": "draft"
        }