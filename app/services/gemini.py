import io
import os
import structlog
from pydantic import BaseModel, Field
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception
import asyncio
import sentry_sdk
from pypdf import PdfReader
import docx
from PIL import Image
from pillow_heif import register_heif_opener
from google import genai
from google.genai import types

# Register HEIF opener for Pillow
register_heif_opener()

logger = structlog.get_logger(__name__)

class ExtractionResult(BaseModel):
    influencer_name: str = Field(default="", description="Name of the influencer")
    influencer_handle: str = Field(default="", description="Social media handle (e.g. @username)")
    platform: str = Field(default="", description="Platform like Instagram, YouTube, etc.")
    deliverables: str = Field(default="", description="What needs to be delivered (e.g. 1 Reel, 2 Stories)")
    deadline: str = Field(default="", description="Deadline in YYYY-MM-DD format if present")
    payment_amount: float = Field(default=0.0, description="Payment amount in INR")
    special_notes: str = Field(default="", description="Any other important details or requirements")
    status: str = Field(default="draft", description="Current status")
    requires_human_review: bool = Field(default=False, description="True if extraction is uncertain or partial")

def get_system_prompt() -> str:
    from datetime import datetime
    import pytz
    ist = pytz.timezone('Asia/Kolkata')
    now = datetime.now(ist)
    date_str = now.strftime('%Y-%m-%d')
    day_str = now.strftime('%A')
    
    return f"""You are an elite AI specialized in extracting micro-influencer campaign details from highly conversational negotiations (WhatsApp chats, voice notes, emails, contracts) for Indian D2C brands.
You MUST have a deep understanding of standard English, 'Hinglish' (Hindi + English), and Indian creator slang.

CRITICAL CONTEXT:
- Today's Date is: {date_str} ({day_str}). Use this to calculate exact relative deadlines!
  - 'aaj' / 'today' = {date_str}
  - 'kal' / 'tomorrow' = Add 1 day
  - 'parso' / 'day after' / 'parson' = Add 2 days
  - 'next week' = Add 7 days

ADVANCED HINGLISH & SLANG DICTIONARY:
1. Money/Amounts:
   - 'k', 'hazaar', 'hazari' = 1,000 (e.g., '10k', '10 hazaar' = 10000.0)
   - 'peti', 'lakh', 'lac' = 100,000 (e.g., '1 peti', '2 peti', '1.5 lakh' = 100000.0, 200000.0, 150000.0)
   - 'khoka', 'koka', 'cr', 'crore' = 10,000,000 (e.g., '1 cr' = 10000000.0)
   - 'barter', 'collab' (without money), 'freebie' = Set payment_amount to 0.0 and note 'Barter deal' in special_notes
   - Note: If numbers are written as '₹1,00,000' or '100000', strip commas and symbols to output exact float (100000.0).

2. Platforms & Deliverables:
   - 'reel', 'story', 'post', 'grid', 'ig' = Assume 'Instagram'
   - 'shorts', 'video', 'vlog', 'youtube integration', 'dedicated' = Assume 'YouTube'
   - 'do' = 2, 'teen' = 3, 'chaar' = 4, 'paanch' = 5 (e.g., 'do reel' = '2 Reels')
   - Translate Hinglish phrases like "deal final ho gayi hai" (deal is finalized) to understand context.
   - Ignore filler words like "bhai", "yaar", "sir", "madam", "bro".

Extract the following details accurately:
- influencer_name: The real name of the creator. If missing, but a handle is present (e.g., '@vlog_queen_delhi'), infer a clean name like 'Vlog Queen Delhi'.
- influencer_handle: Social media handle (MUST start with @). e.g., @vlog_queen_delhi
- platform: e.g., Instagram, YouTube. Detect this even if indirectly mentioned via deliverables (like 'vlog' or 'yt integration').
- deliverables: What needs to be delivered (e.g., 1 Dedicated YouTube Video, 2 Reels).
- deadline: Deadline strictly in YYYY-MM-DD format (e.g., '25th July' -> '2026-07-25', adjusting year logically if it's past).
- payment_amount: Exact float value (e.g., 100000.0). Pick the clearest demanded amount if multiple are stated.
- status: Default is 'draft'. If the text explicitly says "Mark status as Active", "make it active", or "active karo", set to 'active'.
- special_notes: Any other conversational context, strict guidelines, tags, or demands.

INSTRUCTIONS FOR UNCERTAINTY & MESSY DATA:
1. Handle long, messy, conversational texts gracefully. Ignore irrelevant chatter.
2. If uncertain about a field (e.g., vague deadline or unclear amount), leave it as an empty string ("") or 0.0. DO NOT guess blindly.
3. If critical fields (handle/name, deliverables, payment_amount) are highly ambiguous or missing entirely, set `requires_human_review = true`.
"""

def compress_image(image_bytes: bytes, max_size_kb: int = 500, max_dim: int = 1600) -> bytes:
    """Compresses an image to be under max_size_kb and max dimensions while keeping text readable."""
    try:
        # If already small enough and standard format, avoid re-compressing
        if len(image_bytes) < max_size_kb * 1024:
            try:
                img_test = Image.open(io.BytesIO(image_bytes))
                if max(img_test.size) <= max_dim and img_test.format in ('JPEG', 'PNG', 'WEBP'):
                    return image_bytes
            except Exception:
                pass

        img = Image.open(io.BytesIO(image_bytes))
        # Convert to RGB if needed (e.g. RGBA or HEIC)
        if img.mode != "RGB":
            img = img.convert("RGB")
        
        # Resize to max dimensions while maintaining aspect ratio
        img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
        
        quality = 85
        out_io = io.BytesIO()
        img.save(out_io, format="JPEG", quality=quality, optimize=True)
        
        # Aggressive compression if still too large
        while len(out_io.getvalue()) > max_size_kb * 1024 and quality > 20:
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

def parse_docx(file_bytes: bytes) -> str:
    """Extracts text from a Word document."""
    try:
        doc = docx.Document(io.BytesIO(file_bytes))
        full_text = []
        for para in doc.paragraphs:
            if para.text.strip():
                full_text.append(para.text)
        return "\n".join(full_text)
    except Exception as e:
        logger.error("docx_parsing_failed", error=str(e))
        return ""

def is_retryable_error(exception: Exception) -> bool:
    err_str = str(exception).lower()
    if "404" in err_str or "not_found" in err_str or "400" in err_str or "invalid_argument" in err_str:
        return False
    # Always retry on 429/quota to let tenacity's exponential backoff handle temporary spikes
    return True

@retry(wait=wait_exponential(multiplier=1, min=2, max=10), stop=stop_after_attempt(4), retry=retry_if_exception(is_retryable_error))
async def _call_gemini(client: genai.Client, contents: list, model: str = 'gemini-2.5-flash') -> ExtractionResult:
    """Makes the actual API call with retries and timeout."""
    # Using asyncio.wait_for to enforce 120s timeout per attempt
    response = await asyncio.wait_for(
        client.aio.models.generate_content(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=get_system_prompt(),
                response_mime_type="application/json",
                response_schema=ExtractionResult,
                temperature=0.1
            )
        ),
        timeout=120.0
    )
    return ExtractionResult.model_validate_json(response.text)

async def _call_gemini_with_fallback(client: genai.Client, contents: list) -> ExtractionResult:
    """Attempts extraction with 2.5-flash, falls back to 2.0-flash on failure/quota."""
    try:
        return await _call_gemini(client, contents, model='gemini-2.5-flash')
    except Exception as e:
        logger.warning("gemini_2_5_flash_failed_falling_back", error=str(e))
        return await _call_gemini(client, contents, model='gemini-2.0-flash')

@sentry_sdk.trace(op="task", name="Extract AI Data")
async def extract_campaign_data(file_bytes: bytes, filename: str, mime_type: str, text_content: str = "") -> dict:
    """Main extraction pipeline with two-stage fallback."""
    try:
        from app.core.config import settings
        
        api_key_1 = settings.GEMINI_API_KEY_1 or settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY_1") or os.getenv("GEMINI_API_KEY")
        api_key_2 = settings.GEMINI_API_KEY_2 or os.getenv("GEMINI_API_KEY_2")
        
        keys_to_try = []
        if api_key_1:
            keys_to_try.append(("Key 1", api_key_1))
        if api_key_2:
            keys_to_try.append(("Key 2", api_key_2))
            
        if not keys_to_try:
            logger.error("gemini_api_key_missing")
            # We don't raise here, we want to return the fallback response
            raise ValueError("GEMINI_API_KEY is not configured on the server")
            
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
        elif mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document" or filename.endswith(".docx"):
            text = parse_docx(file_bytes)
            if text.strip():
                contents.append(text)
                text_fallback = text
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
            
        if text_content:
            contents.append(text_content)
            text_fallback += "\n" + text_content

        last_error = None
        for key_name, api_key in keys_to_try:
            logger.info(f"attempting_gemini_extraction_with_{key_name.lower().replace(' ', '_')}")
            client = genai.Client(api_key=api_key)
            
            try:
                # Stage 1: Attempt extraction with all contents (images + text)
                result = await _call_gemini_with_fallback(client, contents)
                
                # Post-process to ensure requires_human_review is true if critical fields are missing
                if (not result.influencer_handle and not result.influencer_name) or not result.deadline or not result.deliverables:
                    result.requires_human_review = True
                    
                return result.model_dump()
            except Exception as e:
                sentry_sdk.capture_exception(e)
                logger.warning("gemini_stage1_failed", key=key_name, error=str(e))
                last_error = e
                err_str = str(e).lower()
                
                # We retry quota errors internally now, but if it exhausts 4 attempts and bubbles up here,
                # we switch to the next key.
                if "429" in err_str or "quota" in err_str or "resource_exhausted" in err_str:
                    logger.warning("quota_exhausted_switching_keys_after_retries", key=key_name)
                    continue
                
                # Stage 2 Fallback: If it had images, try text-only
                if has_images and text_fallback.strip():
                    logger.info("gemini_stage2_fallback_triggered", key=key_name)
                    try:
                        fallback_result = await _call_gemini_with_fallback(client, [text_fallback])
                        fallback_dict = fallback_result.model_dump()
                        fallback_dict["requires_human_review"] = True
                        fallback_dict["special_notes"] = (fallback_dict.get("special_notes") or "") + f"\n(Note: Image extraction failed on {key_name}. Partial data extracted from text.)"
                        return fallback_dict
                    except Exception as e2:
                        logger.warning("gemini_stage2_failed", key=key_name, error=str(e2))
                        last_error = e2
                        err2_str = str(e2).lower()
                        if "429" in err2_str or "quota" in err2_str or "resource_exhausted" in err2_str:
                            logger.warning("quota_exhausted_stage2_switching_keys_after_retries", key=key_name)
                            continue
                else:
                    # If we don't have a text fallback and it's not a quota error,
                    # we can still try the next key just in case it was a transient error specific to that endpoint/key.
                    pass
        
        # If we reach here, all keys and stages failed
        raise last_error or ValueError("All Gemini API keys failed")

    except Exception as e:
        logger.error("gemini_extraction_failed_completely", error=str(e), exc_info=True)
        
        error_msg = f"AI Extraction failed ({str(e)}). Please enter details manually."
        
        # Check for Google API Quota limits (429 RESOURCE_EXHAUSTED)
        if "429" in str(e) or "quota" in str(e).lower() or "resource_exhausted" in str(e).lower():
            error_msg = "Google AI Quota exceeded (Rate limit). Please try again in 1 minute."
            
        if mime_type and mime_type.startswith("audio/"):
            error_msg = "Voice note transcription failed or was unclear. Please send text or a screenshot instead."
        
        # Complete fallback: Never crash, always return usable JSON
        return ExtractionResult(
            influencer_name="",
            influencer_handle="",
            platform="",
            deliverables="",
            deadline="",
            payment_amount=0.0,
            special_notes=error_msg,
            status="draft",
            requires_human_review=True
        ).model_dump()
