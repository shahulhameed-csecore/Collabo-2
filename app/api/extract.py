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
        logger.info("extract_endpoint_called", user_id=user.user.id, filename=file.filename, content_type=file.content_type)
        
        # Enforce Billing / Trial Limits
        client = get_user_supabase_client(request)
        sub_res = client.table("subscriptions").select("tier, trial_ends_at").eq("user_id", user.user.id).execute()
        
        from app.api.billing import IS_TESTING_PHASE
        if not IS_TESTING_PHASE and sub_res.data:
            sub = sub_res.data[0]
            tier = sub.get("tier", "free")
            trial_str = sub.get("trial_ends_at")
            
            parsed_trial = None
            if isinstance(trial_str, str):
                try:
                    parsed_trial = datetime.fromisoformat(trial_str.replace("Z", "+00:00"))
                except: pass
                
            now = datetime.now(timezone.utc)
            is_trial_active = parsed_trial and parsed_trial > now
            
            # If they are not pro (which includes active trials) or they are marked pro but trial expired
            if tier != "pro" or (tier == "pro" and parsed_trial and not is_trial_active):
                raise HTTPException(status_code=403, detail="AI Extraction requires a Pro plan or an active free trial.")
                
        
        # Security: Prevent OOM by enforcing a strict 10MB limit before loading into memory.
        # We read chunk+1 bytes. If the length is > 10MB, we reject immediately.
        MAX_SIZE = 10 * 1024 * 1024
        file_bytes = await file.read(MAX_SIZE + 1)
        if len(file_bytes) > MAX_SIZE:
            logger.warning("extract_endpoint_rejected_file_too_large", user_id=user.user.id, size=len(file_bytes))
            raise HTTPException(status_code=413, detail="File too large. Maximum size allowed is 10MB.")
            
        
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
            "influencer_name": "",
            "influencer_handle": "",
            "platform": "",
            "deliverables": "",
            "deadline": "",
            "payment_amount": 0.0,
            "special_notes": f"AI Extraction failed ({str(e)}). Please enter details manually.",
            "status": "draft",
            "requires_human_review": True
        }
