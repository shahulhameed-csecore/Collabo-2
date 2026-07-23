import uuid
import structlog

logger = structlog.get_logger(__name__)

try:
    import magic
    HAS_MAGIC = True
except ImportError:
    HAS_MAGIC = False
    logger.warning("python-magic not installed or missing libmagic DLLs. Mime type detection will fallback to basic validation.")

from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from app.core.limiter import limiter
from fastapi import Request
from app.services.supabase import get_supabase_admin
from app.core.config import settings

router = APIRouter(prefix="/campaigns", tags=["Uploads"])

ALLOWED_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov"
}

MAX_IMAGE_SIZE = 5 * 1024 * 1024 # 5MB
MAX_VIDEO_SIZE = 50 * 1024 * 1024 # 50MB

def get_proof_received_email_html(inf_name: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<body style="font-family:system-ui,-apple-system,sans-serif;background:#0f172a;margin:0;padding:40px 16px;">
  <div style="max-width:600px;margin:0 auto;background:#1e293b;border-radius:16px;padding:32px;color:#e2e8f0;border:1px solid #334155;">
    <h1 style="color:#34d399;margin-top:0;">🎉 Proof Received!</h1>
    <p>The influencer <strong style="color:#fbbf24;">{inf_name}</strong> just uploaded their proof of posting.</p>
    <p>Please log in to review and approve the content.</p>
    <a href="{settings.BASE_URL}/dashboard" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:8px;margin-top:16px;">View Dashboard →</a>
  </div>
</body>
</html>"""

# get_service_client removed, using get_supabase_admin directly

async def notify_owner_of_proof(user_id: str, inf_name: str):
    service_client = await get_supabase_admin()
    
    # Fetch user settings
    resp = await service_client.table("user_settings").select("*").eq("user_id", user_id).execute()
    if not resp.data:
        return
    
    user_settings = resp.data[0]
    wa_num = user_settings.get("whatsapp_number")
    wa_enabled = user_settings.get("whatsapp_reminders_enabled", True)
    email_enabled = user_settings.get("email_reminders_enabled", True)

    from app.services.whatsapp import send_whatsapp_message
    from app.services.notifications import create_notification
    
    # Send in-app notification
    await create_notification(
        service_client=service_client,
        user_id=user_id,
        title="Proof Received",
        message=f"{inf_name} just uploaded their proof of posting.",
        type="success",
        link_url="/dashboard"
    )
    
    if wa_enabled and wa_num:
        body = (
            f"🎉 *Proof Received!*\nThe influencer *{inf_name}* just uploaded their proof of posting.\n\n"
            "Please log into Collabo to review and approve the content:\n"
            f"{settings.BASE_URL}/dashboard"
        )
        await send_whatsapp_message(wa_num, body)

    if email_enabled:
        from app.services.reminders import _send_email, _get_user_email
        email = await _get_user_email(service_client, user_id)
        if email:
            subject = f"🎉 Proof Received for {inf_name}"
            html = get_proof_received_email_html(inf_name)
            await _send_email(email, subject, html)

@router.post("/{token}/upload-proof")
@limiter.limit("10/minute")
async def upload_proof(
    request: Request,
    token: str,
    background_tasks: BackgroundTasks,
):
    # 1. Pre-Validate Content-Length Header (Before downloading body)
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_VIDEO_SIZE:
        raise HTTPException(status_code=413, detail="File size exceeds the absolute limit (50MB).")

    service_client = await get_supabase_admin()

    # 2. Pre-Validate Token and Campaign State (Before downloading body)
    campaign_resp = await service_client.table("campaigns").select("id", "status", "user_id", "influencer_name", "proof_url", "proof_history", "updated_at").eq("magic_link_token", token).execute()
    
    if not campaign_resp.data:
        raise HTTPException(status_code=404, detail="Invalid token.")
    
    campaign = campaign_resp.data[0]
    if campaign["status"] not in ["active", "rejected", "needs_revision"]:
        raise HTTPException(status_code=400, detail="Campaign is not ready for proof upload.")

    # 3. Manually parse the multipart form data now that validation passed
    try:
        form = await request.form()
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to parse form data.")
        
    file = form.get("file")
    if not file or not isinstance(file, UploadFile):
        raise HTTPException(status_code=400, detail="No file uploaded.")

    # 4. Dynamic File Size Validation & OOM Prevention
    import tempfile
    
    # Check Magic Bytes and Size dynamically as we stream
    # 2048 is enough for magic byte detection
    first_chunk = await file.read(2048)
    if not first_chunk:
        raise HTTPException(status_code=400, detail="Empty file.")
        
    if HAS_MAGIC:
        file_mime = magic.from_buffer(first_chunk, mime=True)
    else:
        file_mime = file.content_type or "application/octet-stream"
        
    if file_mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, MP4, and MOV are allowed.")
        
    is_image = file_mime.startswith("image/")
    max_size_allowed = MAX_IMAGE_SIZE if is_image else MAX_VIDEO_SIZE

    # Check file size accurately
    await file.seek(0, 2) # Seek to end
    file_size = file.file.tell()
    await file.seek(0) # Reset to start
    
    if file_size > max_size_allowed:
        raise HTTPException(status_code=413, detail=f"File size exceeds the limit ({'5MB' if is_image else '50MB'}).")

    # 3. Generate Secure Filename
    ext = ALLOWED_MIME_TYPES[file_mime]
    secure_filename = f"{uuid.uuid4()}{ext}"

    # 4. Upload to Supabase Storage (Async, Streaming)
    try:
        bucket_name = "proof-uploads"
        
        # [FIX] Stream the file directly from FastAPI's SpooledTemporaryFile to Supabase
        # This completely avoids holding the 50MB file in RAM or creating redundant temp files.
        await service_client.storage.from_(bucket_name).upload(
            path=secure_filename,
            file=file.file, 
            file_options={"content-type": file_mime}
        )
        
        try:
            public_url = await service_client.storage.from_(bucket_name).get_public_url(secure_filename)
        except TypeError:
            public_url = service_client.storage.from_(bucket_name).get_public_url(secure_filename)
        
        # 6. Update Campaign Status to 'content_received'
        from datetime import datetime, timezone
        current_proof = campaign.get("proof_url")
        current_history = campaign.get("proof_history") or []
        
        if current_proof:
            current_history.append({
                "url": current_proof,
                "uploaded_at": campaign.get("updated_at") or datetime.now(timezone.utc).isoformat(),
            })

        update_data = {
            "status": "content_received",
            "proof_url": public_url,
            "proof_history": current_history
        }
        await service_client.table("campaigns").update(update_data).eq("id", campaign["id"]).execute()

        # 7. Notify Owner
        inf_name = campaign.get("influencer_name") or "Unknown Creator"
        if campaign.get("user_id"):
            background_tasks.add_task(notify_owner_of_proof, campaign["user_id"], inf_name)

        return {"message": "Proof uploaded successfully.", "proof_url": public_url}
        
    except Exception as e:
        logger.exception("Failed to upload proof")
        raise HTTPException(status_code=500, detail="Failed to upload file.")
