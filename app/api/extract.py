from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Request
from PIL import Image
import io
from app.services.gemini import extract_campaign_details
from app.schemas.campaign import ExtractionResult
from app.api.dependencies import get_current_user
from app.core.limiter import limiter

router = APIRouter(prefix="/extract", tags=["Extract"])

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

@router.post("/", response_model=ExtractionResult)
@limiter.limit("10/minute")
async def extract_details(request: Request, file: UploadFile = File(...), user=Depends(get_current_user)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Read file with size limit check
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File size exceeds the 5MB limit")
        
    try:
        image = Image.open(io.BytesIO(contents))
        
        # Optimize image for Gemini (resize & compress)
        if image.mode != "RGB":
            image = image.convert("RGB")
            
        image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        
        # Re-save to a compressed buffer to pass to Gemini efficiently
        optimized_buffer = io.BytesIO()
        image.save(optimized_buffer, format="JPEG", quality=85)
        optimized_buffer.seek(0)
        
        optimized_image = Image.open(optimized_buffer)
            
        extracted_data = extract_campaign_details(optimized_image)
        return extracted_data
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
