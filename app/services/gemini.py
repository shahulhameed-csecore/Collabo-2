import io
import os
import structlog
from pydantic import BaseModel, Field
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception, RetryError
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

def _get_full_err_str(e: Exception) -> str:
    err_str = str(e)
    if isinstance(e, RetryError) and e.last_attempt:
        try:
            err_str += " " + str(e.last_attempt.exception())
        except Exception:
            pass
    return err_str.lower()

def detect_prompt_injection(text: str) -> bool:
    """
    Checks for explicit prompt injection patterns.
    Uses multi-word phrases to avoid false positives on words like 'system' or 'ignore'.
    """
    if not text:
        return False
        
    lower_text = text.lower()
    suspicious_phrases = [
        "ignore previous instructions",
        "disregard all instructions",
        "system prompt",
        "you are now an",
        "override instructions",
        "output the preceding",
        "print your instructions",
        "forget previous",
        "bypass security",
        "new rule:"
    ]
    
    # Check for direct phrase matches
    for phrase in suspicious_phrases:
        if phrase in lower_text:
            logger.warning("prompt_injection_detected", phrase=phrase)
            return True
            
    # Check for suspicious JSON structure injection
    if '{"influencer_name":' in lower_text and '}' in lower_text and "ignore" in lower_text:
        return True
        
    return False

class ExtractionResult(BaseModel):
    influencer_name: str | None = Field(default=None, description="string or null")
    brand_name: str | None = Field(default=None, description="string or null")
    platform: str | None = Field(default=None, description="string or null")
    deliverables: str | None = Field(default=None, description="string or null")
    payment_amount: float | None = Field(default=None, description="number or null")
    deadline: str | None = Field(default=None, description="YYYY-MM-DD or null")
    special_notes: str | None = Field(default=None, description="string or null")

def get_system_prompt() -> str:
    return """You are a fast and accurate extraction engine for Collabo.

Extract campaign details from the chat and output ONLY clean JSON.

**Strict Rules**:
- Special Notes: ONLY include relevant human instructions. NEVER include system tags or error notes.
- Clean all HTML entities.
- For dates: You MUST extract the deadline. Pay very close attention to any mentioned dates (e.g., "12 Oct", "20 July") and convert them strictly to YYYY-MM-DD format. Assume the year is 2026 if not specified. Extract the date even if it is hidden in the middle or end of the chat.

JSON format:
{
  "influencer_name": "string or null",
  "brand_name": "string or null",
  "platform": "string or null",
  "deliverables": "string or null",
  "payment_amount": "number or null",
  "deadline": "YYYY-MM-DD or null",
  "special_notes": "string or null"
}"""

def compress_image(image_bytes: bytes, max_size_kb: int = 500, max_dim: int = 1600) -> bytes | None:
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
        return None # Return None if compression fails to prevent sending invalid image bytes to Gemini

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
                        compressed = compress_image(img_obj.data)
                        if compressed:
                            extracted_images.append(compressed)
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
            text, images = await asyncio.to_thread(parse_pdf, file_bytes)
            if text.strip():
                contents.append(text)
                text_fallback = text
            for img_bytes in images:
                contents.append(
                    types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg")
                )
                has_images = True
        elif mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document" or filename.endswith(".docx"):
            text = await asyncio.to_thread(parse_docx, file_bytes)
            if text.strip():
                contents.append(text)
                text_fallback = text
        elif mime_type.startswith("image/") or mime_type.startswith("audio/"):
            if mime_type.startswith("image/"):
                compressed = await asyncio.to_thread(compress_image, file_bytes)
                if compressed:
                    final_mime = "image/jpeg" if compressed != file_bytes else mime_type
                    contents.append(
                        types.Part.from_bytes(data=compressed, mime_type=final_mime)
                    )
                else:
                    contents.append(
                        types.Part.from_bytes(data=file_bytes, mime_type=mime_type)
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
            
        # Ensure contents is never empty to prevent 400 ClientError from Gemini
        if not contents:
            contents.append("The uploaded file was empty, unreadable, or contained no supported text/images.")

        # Stage 0: Pre-flight Prompt Injection Check
        if detect_prompt_injection(text_fallback):
            return {
                "influencer_name": None,
                "brand_name": None,
                "platform": None,
                "deliverables": None,
                "deadline": None,
                "payment_amount": 0.0,
                "special_notes": "Security Alert: Suspicious instructions detected in the uploaded file. Please upload a legitimate screenshot or text.",
                "status": "draft",
                "influencer_handle": "N/A",
                "requires_human_review": True
            }

        last_error = None
        for key_name, api_key in keys_to_try:
            logger.info(f"attempting_gemini_extraction_with_{key_name.lower().replace(' ', '_')}")
            client = genai.Client(api_key=api_key)
            
            try:
                # Stage 1: Attempt extraction with all contents (images + text)
                result = await _call_gemini_with_fallback(client, contents)
                
                result_dict = result.model_dump()
                
                # Output Validation
                if result_dict.get("payment_amount") and result_dict["payment_amount"] < 0:
                    result_dict["payment_amount"] = 0.0
                    
                if result_dict.get("influencer_name") and len(result_dict["influencer_name"]) > 100:
                    result_dict["influencer_name"] = result_dict["influencer_name"][:100]
                
                # Post-process to ensure requires_human_review is true if critical fields are missing
                if not result.influencer_name or not result.deadline or not result.deliverables:
                    result_dict["requires_human_review"] = True
                else:
                    result_dict["requires_human_review"] = False
                    
                result_dict["status"] = "draft"
                result_dict["influencer_handle"] = "N/A"
                    
                return result_dict
            except Exception as e:
                sentry_sdk.capture_exception(e)
                logger.warning("gemini_stage1_failed", key=key_name, error=str(e))
                last_error = e
                err_str = _get_full_err_str(e)
                
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
                        err2_str = _get_full_err_str(e2)
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
        full_err_str = _get_full_err_str(e)
        if "429" in full_err_str or "quota" in full_err_str or "resource_exhausted" in full_err_str:
            error_msg = "Google AI Quota exceeded (Rate limit). Please try again in 1 minute."
            
        if mime_type and mime_type.startswith("audio/"):
            error_msg = "Voice note transcription failed or was unclear. Please send text or a screenshot instead."
        
        # Complete fallback: Never crash, always return usable JSON
        return {
            "influencer_name": None,
            "brand_name": None,
            "platform": None,
            "deliverables": None,
            "deadline": None,
            "payment_amount": 0.0,
            "special_notes": error_msg,
            "status": "draft",
            "influencer_handle": "N/A",
            "requires_human_review": True
        }
