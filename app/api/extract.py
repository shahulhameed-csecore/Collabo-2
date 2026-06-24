import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Request
from PIL import Image
import pillow_heif
import io
import pypdf
import docx
import pathlib

pillow_heif.register_heif_opener()
from app.services.gemini import extract_campaign_details
from app.schemas.campaign import ExtractionResult
from app.api.dependencies import get_current_user
from app.core.limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/extract", tags=["Extract"])

MAX_IMAGE_SIZE = 5 * 1024 * 1024   # 5 MB
MAX_DOC_SIZE = 10 * 1024 * 1024    # 10 MB
# .heic is included because pillow_heif registers the HEIF opener
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg", ".heic", ".heif"}

@router.post("/", response_model=ExtractionResult)
@limiter.limit("10/minute")
async def extract_details(request: Request, file: UploadFile = File(...), user=Depends(get_current_user)):
    content_type = file.content_type or ""
    filename = file.filename or "unknown_file"
    ext = pathlib.Path(filename).suffix.lower()
    
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Invalid file extension. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")
        
    # Read with hard limit to prevent OOM DoS
    contents = await file.read(MAX_DOC_SIZE + 1)
    file_size = len(contents)
    
    is_image = ext in {".png", ".jpg", ".jpeg", ".heic", ".heif"} or content_type.startswith("image/")
    is_pdf = ext == ".pdf" or content_type == "application/pdf"
    is_docx = ext == ".docx"
    is_text = ext == ".txt" or content_type.startswith("text/")
    
    if is_image and file_size > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Image size exceeds the 5MB limit")
    if file_size > MAX_DOC_SIZE:
        raise HTTPException(status_code=413, detail="Document size exceeds the 10MB limit")
            
    # Protect against decompression bombs
    Image.MAX_IMAGE_PIXELS = 100_000_000
            
    try:
        extracted_data = None
        
        if is_image:
            image = Image.open(io.BytesIO(contents))
            # Verify it's actually an image
            image.verify()
            # Reopen after verify
            image = Image.open(io.BytesIO(contents))
            if image.mode != "RGB":
                image = image.convert("RGB")
            image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
            optimized_buffer = io.BytesIO()
            image.save(optimized_buffer, format="JPEG", quality=85)
            optimized_buffer.seek(0)
            optimized_image = Image.open(optimized_buffer)
            extracted_data = extract_campaign_details(optimized_image, filename=filename)
            
        elif is_pdf:
            reader = pypdf.PdfReader(io.BytesIO(contents))
            hybrid_content = []
            extracted_texts = []
            image_count = 0
            
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    extracted_texts.append(text)
                
                # Extract up to 3 images from the PDF to form a multimodal context
                for image_file_object in page.images:
                    if image_count < 3:
                        try:
                            pdf_img = Image.open(io.BytesIO(image_file_object.data))
                            hybrid_content.append(pdf_img)
                            image_count += 1
                        except Exception as e:
                            logger.warning(f"Failed to read PDF image: {e}")
            
            full_text = "\n".join(extracted_texts)[:50000]
            if full_text.strip():
                hybrid_content.append(full_text)
                
            extracted_data = extract_campaign_details(hybrid_content, filename=filename)
            
        elif is_docx:
            doc = docx.Document(io.BytesIO(contents))
            text = "\n".join(para.text for para in doc.paragraphs)
            text = text[:50000]
            extracted_data = extract_campaign_details(text, filename=filename)
            
        elif is_text:
            text = contents.decode("utf-8", errors="ignore")
            text = text[:50000]
            extracted_data = extract_campaign_details(text, filename=filename)
            
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format.")
            
        return extracted_data

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("File extraction error", filename=filename, error=type(e).__name__, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during extraction. Please try again.")
