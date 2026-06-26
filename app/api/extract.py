import structlog
from fastapi import APIRouter, Depends, UploadFile, File, Request, HTTPException
from app.api.dependencies import get_current_user, AuthenticatedUser
from app.core.limiter import limiter
from app.services.gemini import extract_campaign_data

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/extract", tags=["Extraction"])

@router.post("/", response_model=dict)
@limiter.limit("5/minute")
async def extract_data(
    request: Request,
    file: UploadFile = File(...),
    user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        logger.info("extract_endpoint_called", user_id=user.user.id, filename=file.filename, content_type=file.content_type)
        
        # Security: Prevent OOM by enforcing a strict 5MB limit before loading into memory.
        # We read chunk+1 bytes. If the length is > 5MB, we reject immediately.
        MAX_SIZE = 5 * 1024 * 1024
        file_bytes = await file.read(MAX_SIZE + 1)
        if len(file_bytes) > MAX_SIZE:
            logger.warning("extract_endpoint_rejected_file_too_large", user_id=user.user.id, size=len(file_bytes))
            raise HTTPException(status_code=413, detail="File too large. Maximum size allowed is 5MB.")
            
        
        # Delegate to the robust gemini service
        extracted_data = await extract_campaign_data(
            file_bytes=file_bytes,
            filename=file.filename,
            mime_type=file.content_type or "application/octet-stream"
        )
        
        return extracted_data
    except Exception as e:
        logger.error("extract_endpoint_failed", error=str(e), user_id=user.user.id if hasattr(user, 'user') else None)
        return {
            "influencer_name": None,
            "influencer_handle": None,
            "platform": None,
            "deliverables": None,
            "deadline": None,
            "payment_amount": 0.0,
            "special_notes": f"AI Extraction failed ({str(e)}). Please enter details manually.",
            "status": "draft",
            "requires_human_review": True
        }
