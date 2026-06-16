import json
import logging
import re
from datetime import datetime
from google import genai
from google.genai import types
from google.genai.errors import APIError
from PIL import Image, ImageOps
from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger(__name__)

# STRIP whitespace and hidden quotes! Extremely common issue when pasting into Render Dashboard
clean_api_key = settings.GEMINI_API_KEY.strip(' "\'')
client = genai.Client(api_key=clean_api_key)


class GeminiExtractionSchema(BaseModel):
    influencer_name: str | None = Field(description="Full name of the influencer or contact person")
    influencer_handle: str | None = Field(description="Social handle like @riya_creates")
    platform: str | None = Field(description="Instagram, TikTok, YouTube, or Others")
    deliverables: str | None = Field(description="What they agreed to do (e.g. '2 Reels + 3 Stories')")
    deadline: str | None = Field(description="Deadline in YYYY-MM-DD format")
    payment_amount: float | None = Field(description="Payment in INR. 0.0 if gifted or barter")
    special_notes: str | None = Field(description="Any additional context or instructions")


def get_extraction_prompt(today_str: str, filename: str = "image.png") -> str:
    return f"""
You are an elite, highly intelligent micro-influencer campaign extraction engine.
Your sole purpose is to analyze unstructured real-world messy data (WhatsApp/Instagram DMs, formal emails, contracts, PDF acceptance documents, briefs) and extract precise campaign details for Indian D2C brands.

Today's date for relative calculations is: {today_str}
Context File: {filename}

CRITICAL DIRECTIVES:
1. FORMAL DOCUMENTS & EMAILS: If this is a PDF contract, proposal, or formal email, carefully extract the exact deliverables, compensation, and deadlines. Look for terms like "Compensation:", "Deliverables:", "Timeline:", "Go-live date".
2. PAYMENT vs GIFTED: If the text mentions "barter", "collab", "gifted", "sending a sample", "trying the product", "PR package", "send details", or similar without monetary value, it is Barter. Set payment_amount to EXACTLY 0.0. ONLY set a payment_amount if a specific monetary value (e.g., INR, Rs, ₹) is explicitly negotiated and agreed upon.
3. DATES & DEADLINES: Convert all relative dates ("next Friday", "by EOD", "kal", "in 3 days") into strict YYYY-MM-DD format based on {today_str}. If no deadline is mentioned or it's vague, set it to null. Do NOT hallucinate dates.
4. HINGLISH & MESSY TEXT: You are fluent in Hinglish (Hindi + English) and informal chat shorthand. Infer intent accurately even with typos, bad grammar, or poor screenshot quality.
5. DELIVERABLES: Be concise but comprehensive. Extract exactly what was agreed (e.g., "1 IG Reel + 2 Stories", "1 Dedicated YouTube Integration").
6. MISSING DATA: It is very common for documents to miss certain fields (e.g. handle, platform). If a field is not explicitly present or highly obvious, return null. Do not guess handles.
7. NEVER FAIL: Even if the document is totally empty or irrelevant, DO NOT crash. Simply return null for all fields. Always output valid JSON matching the exact schema below.
8. WHATSAPP FORWARDS: If this is a forwarded WhatsApp chat log, parse the conversation flow carefully. Pay close attention to the final agreed terms (the last messages) rather than initial offers.

Return ONLY valid JSON matching this exact structure:

{{
  "influencer_name": string (Full name if found, else handle, else null),
  "influencer_handle": string (e.g., "@username" or null),
  "platform": "Instagram" | "TikTok" | "YouTube" | "Others" | null,
  "deliverables": string (The core ask) | null,
  "deadline": "YYYY-MM-DD" or null,
  "payment_amount": number (float, use 0.0 for barter/gifted) | null,
  "special_notes": string (Brief summary of any specific requests, tracking links, or brand mandates) | null
}}

DO NOT include markdown formatting like ```json.
DO NOT include any commentary. Output raw JSON only.
"""


def extract_campaign_details(content: Image.Image | str | dict, filename: str = "image.png") -> dict:
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
        elif isinstance(content, dict) and "audio_bytes" in content:
            # Handle WhatsApp Voice Notes (raw bytes)
            audio_part = types.Part.from_bytes(
                data=content["audio_bytes"],
                mime_type=content.get("mime_type", "audio/ogg")
            )
            gemini_content.append(audio_part)
            gemini_content.append("Please transcribe and analyze this voice note to extract the campaign details.")
        else:
            # Append extracted text for PDFs/DOCX/TXT/WhatsApp text
            gemini_content.append(f"--- START OF CONTENT ---\n{content}\n--- END OF CONTENT ---")

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=gemini_content,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=GeminiExtractionSchema,
                temperature=0.1,  # Low temperature to prevent hallucination
            )
        )

        # Handle refused or empty responses gracefully
        if not response.text:
            raise ValueError("Gemini returned an empty response. It may have been blocked by safety filters.")

        # Clean response text robustly
        text = response.text.strip()
        # Regex to strip markdown codeblocks reliably regardless of exact characters
        text = re.sub(r"^```(?:json)?\s*\n", "", text)
        text = re.sub(r"\n```\s*$", "", text)
        text = text.strip()

        data = json.loads(text)

        # Smart defaults & Human-in-the-Loop Validation
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
        error_msg = str(e)
        logger.error(f"Gemini Extraction Failed: {error_msg}", exc_info=True)
        
        # We append a snippet of the ACTUAL error here so it's instantly visible in the frontend!
        friendly_error = f"AI Extraction Failed ({error_msg[:120]}). Please enter details manually."
        
        return {
            "influencer_name": None,
            "influencer_handle": None,
            "platform": None,
            "deliverables": None,
            "deadline": None,
            "payment_amount": 0.0,
            "special_notes": friendly_error,
            "requires_human_review": True,
            "status": "draft"
        }