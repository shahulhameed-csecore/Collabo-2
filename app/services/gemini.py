import io
import os
import structlog
from pydantic import BaseModel, Field
from tenacity import retry, wait_exponential, stop_after_attempt
import asyncio
from pypdf import PdfReader
from PIL import Image
from pillow_heif import register_heif_opener
from google import genai
from google.genai import types

# Register HEIF opener for Pillow
register_heif_opener()

logger = structlog.get_logger(__name__)

class ExtractionResult(BaseModel):
    influencer_name: str | None = Field(description="Name of the influencer")
    influencer_handle: str | None = Field(description="Social media handle (e.g. @username)")
    platform: str | None = Field(description="Platform like Instagram, YouTube, etc.")
    deliverables: str | None = Field(description="What needs to be delivered (e.g. 1 Reel, 2 Stories)")
    deadline: str | None = Field(description="Deadline in YYYY-MM-DD format if present")
    payment_amount: float = Field(default=0.0, description="Payment amount in INR")
    special_notes: str | None = Field(description="Any other important details or requirements")
    status: str = Field(default="draft", description="Current status")
    requires_human_review: bool = Field(default=False, description="True if extraction is uncertain or partial")

SYSTEM_PROMPT = """You are an AI specialized in extracting micro-influencer campaign details from negotiations (chats, emails, voice notes text, contracts).
Extract the following details accurately:
- influencer_name
- influencer_handle
- platform
- deliverables
- deadline (YYYY-MM-DD format if absolute date is given, otherwise null. E.g. 'next Friday' can be null if exact date is unknown)
- payment_amount (float, convert words to numbers. e.g. 15k -> 15000.0)
- special_notes

If you are uncertain about any field, leave it as null. If multiple critical fields are missing, set requires_human_review to true.
"""

def compress_image(image_bytes: bytes, max_size_kb: int = 250) -> bytes:
    """Compresses an image to be under max_size_kb and max 512x512."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        # Convert to RGB if needed (e.g. RGBA or HEIC)
        if img.mode != "RGB":
            img = img.convert("RGB")
        
        # Resize to max 512x512 while maintaining aspect ratio
        img.thumbnail((512, 512), Image.Resampling.LANCZOS)
        
        quality = 85
        out_io = io.BytesIO()
        img.save(out_io, format="JPEG", quality=quality, optimize=True)
        
        # Aggressive compression if still too large
        while len(out_io.getvalue()) > max_size_kb * 1024 and quality > 10:
            quality -= 10
            out_io = io.BytesIO()
            img.save(out_io, format="JPEG", quality=quality, optimize=True)
            
        return out_io.getvalue()
    except Exception as e:
        logger.error("image_compression_failed", error=str(e))
        return image_bytes # Fallback to original if compression fails

def parse_pdf(file_bytes: bytes) -> tuple[str, list[bytes]]:
    """Extracts text from first 4 pages, and up to 2 images."""
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        text_content = []
        extracted_images = []
        
        num_pages = min(len(reader.pages), 4)
        for i in range(num_pages):
            page = reader.pages[i]
            text_content.append(page.extract_text())
            
            # Extract images (max 2 total)
            if len(extracted_images) < 2:
                for img_obj in page.images:
                    if len(extracted_images) < 2:
                        extracted_images.append(compress_image(img_obj.data))
                    else:
                        break
                        
        return "\n".join(text_content), extracted_images
    except Exception as e:
        logger.error("pdf_parsing_failed", error=str(e))
        return "", []

@retry(wait=wait_exponential(multiplier=1, min=2, max=10), stop=stop_after_attempt(4))
async def _call_gemini(client: genai.Client, contents: list) -> ExtractionResult:
    """Makes the actual API call with retries and timeout."""
    # Using asyncio.wait_for to enforce 120s timeout per attempt
    response = await asyncio.wait_for(
        client.aio.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=ExtractionResult,
                temperature=0.1
            )
        ),
        timeout=120.0
    )
    return ExtractionResult.model_validate_json(response.text)

async def extract_campaign_data(file_bytes: bytes, filename: str, mime_type: str) -> dict:
    """Main extraction pipeline with two-stage fallback."""
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.error("gemini_api_key_missing")
            # We don't raise here, we want to return the fallback response
            raise ValueError("GEMINI_API_KEY is not configured on the server")
            
        client = genai.Client(api_key=api_key)
        contents = []
        text_fallback = ""
        has_images = False
        
        if mime_type == "application/pdf":
            text, images = parse_pdf(file_bytes)
            if text.strip():
                contents.append(text)
                text_fallback = text
            for img_bytes in images:
                contents.append(
                    types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg")
                )
                has_images = True
        elif mime_type.startswith("image/") or mime_type.startswith("audio/"):
            if mime_type.startswith("image/"):
                compressed = compress_image(file_bytes)
                final_mime = "image/jpeg" if compressed != file_bytes else mime_type
                contents.append(
                    types.Part.from_bytes(data=compressed, mime_type=final_mime)
                )
            else:
                contents.append(
                    types.Part.from_bytes(data=file_bytes, mime_type=mime_type)
                )
            has_images = True
        elif mime_type.startswith("text/") or filename.endswith(".txt"):
            text_fallback = file_bytes.decode('utf-8', errors='ignore')
            contents.append(text_fallback)
        else:
            # Try parsing as generic text if unknown
            text_fallback = file_bytes.decode('utf-8', errors='ignore')
            contents.append(text_fallback)

        try:
            # Stage 1: Attempt extraction with all contents (images + text)
            result = await _call_gemini(client, contents)
            return result.model_dump()
        except Exception as e:
            logger.warning("gemini_stage1_failed", error=str(e))
            # Stage 2 Fallback: If it had images, try text-only
            if has_images and text_fallback.strip():
                logger.info("gemini_stage2_fallback_triggered")
                fallback_result = await _call_gemini(client, [text_fallback])
                fallback_dict = fallback_result.model_dump()
                fallback_dict["requires_human_review"] = True
                fallback_dict["special_notes"] = (fallback_dict.get("special_notes") or "") + "\n(Note: Image extraction failed. Partial data extracted from text.)"
                return fallback_dict
            else:
                raise e

    except Exception as e:
        logger.error("gemini_extraction_failed_completely", error=str(e))
        # Complete fallback: Never crash, always return usable JSON
        return ExtractionResult(
            influencer_name=None,
            influencer_handle=None,
            platform=None,
            deliverables=None,
            deadline=None,
            payment_amount=0.0,
            special_notes=f"AI Extraction failed ({str(e)}). Please enter details manually.",
            status="draft",
            requires_human_review=True
        ).model_dump()
