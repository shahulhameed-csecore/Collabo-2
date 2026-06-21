import logging
import uuid
import magic
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.core.limiter import limiter
from fastapi import Request
from supabase import create_client
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/campaigns", tags=["Uploads"])

ALLOWED_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov"
}

MAX_IMAGE_SIZE = 5 * 1024 * 1024 # 5MB
MAX_VIDEO_SIZE = 50 * 1024 * 1024 # 50MB

def get_service_client():
    if not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Supabase service role key not configured.")
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

@router.post("/{token}/upload-proof")
@limiter.limit("10/minute")
async def upload_proof(
    request: Request,
    token: str,
    file: UploadFile = File(...),
):
    service_client = get_service_client()

    # 1. Validate Token and Campaign State
    campaign_resp = service_client.table("campaigns").select("id", "status").eq("magic_link_token", token).execute()
    if not campaign_resp.data:
        raise HTTPException(status_code=404, detail="Invalid token.")
    
    campaign = campaign_resp.data[0]
    if campaign["status"] != "active":
        raise HTTPException(status_code=400, detail="Campaign is not active. Proof cannot be uploaded.")

    # 2. File Size Validation
    content = await file.read()
    file_size = len(content)

    # 3. Magic Number Validation
    file_mime = magic.from_buffer(content, mime=True)
    if file_mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, MP4, and MOV are allowed.")
    
    if file_mime.startswith("image/") and file_size > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Image size exceeds the 5MB limit.")
    if file_mime.startswith("video/") and file_size > MAX_VIDEO_SIZE:
        raise HTTPException(status_code=413, detail="Video size exceeds the 50MB limit.")

    # 4. Generate Secure Filename
    ext = ALLOWED_MIME_TYPES[file_mime]
    secure_filename = f"{uuid.uuid4()}{ext}"

    # 5. Upload to Supabase Storage
    try:
        bucket_name = "proof-uploads"
        # Supabase Python SDK storage upload expects bytes
        res = service_client.storage.from_(bucket_name).upload(
            path=secure_filename,
            file=content,
            file_options={"content-type": file_mime}
        )
        
        # Get public URL
        public_url = service_client.storage.from_(bucket_name).get_public_url(secure_filename)
        
        # 6. Update Campaign Status to 'content_received'
        update_data = {
            "status": "content_received",
            "proof_url": public_url
        }
        service_client.table("campaigns").update(update_data).eq("id", campaign["id"]).execute()

        return {"message": "Proof uploaded successfully.", "proof_url": public_url}
        
    except Exception as e:
        logger.error(f"Failed to upload proof: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to upload file.")
