from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Request
from PIL import Image
import pillow_heif
import io
import pypdf
import docx

pillow_heif.register_heif_opener()
from app.services.gemini import extract_campaign_details
from app.schemas.campaign import ExtractionResult
from app.api.dependencies import get_current_user
from app.core.limiter import limiter

router = APIRouter(prefix="/extract", tags=["Extract"])

MAX_IMAGE_SIZE = 5 * 1024 * 1024   # 5 MB
MAX_DOC_SIZE = 10 * 1024 * 1024    # 10 MB

@router.post("/", response_model=ExtractionResult)
@limiter.limit("10/minute")
async def extract_details(request: Request, file: UploadFile = File(...), user=Depends(get_current_user)):
    content_type = file.content_type or ""
    filename = file.filename or "unknown_file"
    
    contents = await file.read()
    file_size = len(contents)
    
    is_image = content_type.startswith("image/")
    is_pdf = content_type == "application/pdf" or filename.lower().endswith('.pdf')
    is_docx = content_type in ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"] or filename.lower().endswith('.docx')
    is_text = content_type.startswith("text/") or filename.lower().endswith('.txt')
    
    if is_image:
        if file_size > MAX_IMAGE_SIZE:
            raise HTTPException(status_code=413, detail="Image size exceeds the 5MB limit")
    else:
        if file_size > MAX_DOC_SIZE:
            raise HTTPException(status_code=413, detail="Document size exceeds the 10MB limit")
            
    try:
        extracted_data = None
        
        if is_image:
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
            text = "\n".join(page.extract_text() for page in reader.pages if page.extract_text())
            extracted_data = extract_campaign_details(text, filename=filename)
            
        elif is_docx:
            doc = docx.Document(io.BytesIO(contents))
            text = "\n".join(para.text for para in doc.paragraphs)
            extracted_data = extract_campaign_details(text, filename=filename)
            
        elif is_text:
            text = contents.decode("utf-8", errors="ignore")
            extracted_data = extract_campaign_details(text, filename=filename)
            
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload an image, PDF, DOCX, or TXT file.")
            
        return extracted_data
        
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
