import structlog
from fastapi import APIRouter, Depends, UploadFile, File, Request, HTTPException
from app.api.dependencies import get_current_user, AuthenticatedUser, get_user_supabase_client
from app.core.limiter import limiter
from app.services.gemini import extract_campaign_data
from datetime import datetime, timezone

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
        from fastapi.concurrency import run_in_threadpool
        logger.info("extract_endpoint_called", user_id=user.user.id, filename=file.filename, content_type=file.content_type)
        
        # Enforce Billing / Trial Limits via unified helper
        from app.services.supabase import is_user_pro_or_paid
        client = await get_user_supabase_client(user)
        is_pro, _ = await is_user_pro_or_paid(client, user.user.id)
        if not is_pro:
            raise HTTPException(status_code=403, detail="AI Extraction requires a Pro plan or an active free trial.")
                
        # Security: Prevent OOM by enforcing a strict 10MB limit via chunked reading.
        MAX_SIZE = 10 * 1024 * 1024
        file_bytes = bytearray()
        
        while chunk := await file.read(1024 * 1024): # 1MB chunks
            file_bytes.extend(chunk)
            if len(file_bytes) > MAX_SIZE:
                logger.warning("extract_endpoint_rejected_file_too_large", user_id=user.user.id, size=len(file_bytes))
                raise HTTPException(status_code=413, detail="File too large. Maximum size allowed is 10MB.")
                
        # Delegate to the robust gemini service
        extracted_data = await extract_campaign_data(
            file_bytes=bytes(file_bytes),
            filename=file.filename,
            mime_type=file.content_type or "application/octet-stream"
        )
        
        # Track usage in the database
        if extracted_data:
            client = await get_user_supabase_client(user)
            try:
                await client.rpc("increment_ai_extractions", {"p_user_id": user.user.id}).execute()
            except Exception as e:
                logger.warning("failed_to_increment_ai_extraction_count", error=str(e))
        
        return extracted_data
    except HTTPException:
        raise
    except Exception as e:
        logger.error("extract_endpoint_failed", error=str(e), user_id=user.user.id if hasattr(user, 'user') else None)
        raise HTTPException(status_code=500, detail="An internal server error occurred while processing the file.")
