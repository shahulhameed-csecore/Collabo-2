import hmac
import hashlib
import logging
import json
from fastapi import APIRouter, Request, HTTPException, Response, BackgroundTasks
from app.core.config import settings
from supabase import create_client, ClientOptions
from app.services.gemini import extract_campaign_details
from app.services.whatsapp import send_whatsapp_message, download_whatsapp_media

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhook", tags=["WhatsApp Webhook"])

# Initialize Supabase service client (bypasses RLS)
supabase_admin = None
if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
    supabase_admin = create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_ROLE_KEY
    )

def verify_signature(payload: bytes, signature_header: str) -> bool:
    if not signature_header or not settings.WHATSAPP_APP_SECRET:
        return False
    
    # Signature looks like "sha256=1234abcd..."
    elements = signature_header.split('=')
    if len(elements) != 2:
        return False
        
    expected_sig = hmac.new(
        settings.WHATSAPP_APP_SECRET.encode('utf-8'),
        msg=payload,
        digestmod=hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(expected_sig, elements[1])

@router.get("/whatsapp")
async def verify_webhook(request: Request):
    """
    Required by Meta to verify the webhook URL.
    """
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    if mode and token:
        if mode == "subscribe" and token == settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN:
            return Response(content=challenge, status_code=200)
        else:
            raise HTTPException(status_code=403, detail="Verification failed")
    
    raise HTTPException(status_code=400, detail="Missing parameters")

async def process_whatsapp_message(sender_id: str, message: dict):
    """
    Background task to process the message and talk to Gemini.
    """
    try:
        # 1. Lookup User in Supabase
        if not supabase_admin:
            logger.error("Supabase Admin client not initialized.")
            await send_whatsapp_message(sender_id, "System configuration error. Please contact support.")
            return
            
        clean_number = sender_id.lstrip('+') # e.g. 919876543210
        user_response = supabase_admin.table('user_settings').select('user_id').eq('whatsapp_number', clean_number).execute()
        
        if not user_response.data or len(user_response.data) == 0:
            await send_whatsapp_message(
                sender_id, 
                "Hello! 👋 Your WhatsApp number is not linked to any Collabo account.\n\nPlease log in to your Collabo dashboard -> Settings, and link this phone number to start forwarding campaigns."
            )
            return
            
        user_id = user_response.data[0]['user_id']
        
        # 2. Extract Data (Text vs Audio vs Image)
        msg_type = message.get("type")
        content_for_gemini = None
        
        if msg_type == "text":
            content_for_gemini = message.get("text", {}).get("body", "").strip()
            if not content_for_gemini:
                await send_whatsapp_message(sender_id, "Please forward a text message or voice note containing the deal terms.")
                return
                
        elif msg_type == "audio":
            audio_id = message.get("audio", {}).get("id")
            if not audio_id:
                await send_whatsapp_message(sender_id, "❌ Could not retrieve voice note ID.")
                return
                
            await send_whatsapp_message(sender_id, "Downloading your voice note... 🎧")
            audio_bytes = await download_whatsapp_media(audio_id)
            if not audio_bytes:
                await send_whatsapp_message(sender_id, "❌ Failed to download the voice note from WhatsApp servers. Please try again or send a text message.")
                return
            
            # Pass as a dict so gemini.py can handle the raw bytes
            content_for_gemini = {"audio_bytes": audio_bytes, "mime_type": "audio/ogg"}
            
        elif msg_type == "image":
            image_id = message.get("image", {}).get("id")
            caption = message.get("image", {}).get("caption", "")
            
            if not image_id:
                await send_whatsapp_message(sender_id, "❌ Could not retrieve image ID.")
                return
                
            await send_whatsapp_message(sender_id, "Analyzing your image... 🖼️")
            image_bytes = await download_whatsapp_media(image_id)
            if not image_bytes:
                await send_whatsapp_message(sender_id, "❌ Failed to download the image from WhatsApp. Please try again.")
                return
                
            # Pass as a dict so gemini.py can handle the raw bytes
            content_for_gemini = {
                "image_bytes": image_bytes, 
                "mime_type": message.get("image", {}).get("mime_type", "image/jpeg"),
                "caption": caption
            }
            
        else:
            await send_whatsapp_message(sender_id, f"Unsupported message type: {msg_type}. Please send text, voice notes, or images.")
            return

        # 3. Process with Gemini
        await send_whatsapp_message(sender_id, "Processing your campaign details... 🤖")
        
        extracted_data = extract_campaign_details(content_for_gemini, filename="whatsapp_input")
        
        if extracted_data.get('requires_human_review'):
            await send_whatsapp_message(sender_id, "⚠️ I extracted the details, but some fields were missing or unclear. Creating a Draft campaign for you to review.")
            
        # 4. Insert into Supabase
        campaign_data = extracted_data
        campaign_data['user_id'] = user_id
        campaign_data['status'] = 'draft' # Always draft from WhatsApp
        
        insert_response = supabase_admin.table('campaigns').insert(campaign_data).execute()
        
        if insert_response.data:
            influencer = extracted_data.get('influencer_handle') or extracted_data.get('influencer_name') or 'Unknown'
            success_msg = f"✅ Campaign created successfully for *{influencer}*!\n\nCheck your dashboard."
            await send_whatsapp_message(sender_id, success_msg)
        else:
            await send_whatsapp_message(sender_id, "❌ Failed to save the campaign to the database. Please try again.")
            
    except Exception as e:
        logger.error(f"WhatsApp processing error: {e}", exc_info=True)
        await send_whatsapp_message(sender_id, "❌ Could not understand the message. Please try forwarding again.")


@router.post("/whatsapp")
async def meta_whatsapp_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Receives incoming WhatsApp messages via Meta Cloud API.
    """
    # 1. Validate Meta Signature (Security)
    payload_bytes = await request.body()
    signature_header = request.headers.get("X-Hub-Signature-256", "")
    
    # In production, ALWAYS verify signature.
    if settings.ENVIRONMENT == "production":
        if not verify_signature(payload_bytes, signature_header):
            logger.warning(f"Meta signature validation failed. Signature: {signature_header}")
            raise HTTPException(status_code=403, detail="Invalid signature")

    # 2. Parse Meta JSON Payload
    try:
        data = await request.json()
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Ensure it's a WhatsApp webhook event
    if data.get("object") != "whatsapp_business_account":
        return Response(status_code=404)
        
    try:
        for entry in data.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                
                # We only care about user messages, not status updates (delivered, read, etc)
                messages = value.get("messages", [])
                for message in messages:
                    sender_id = message.get("from") # e.g. "919876543210"
                    
                    # Offload the heavy processing (Gemini + DB) to a background task
                    # so we can return 200 OK to Meta immediately (required within 3 seconds).
                    background_tasks.add_task(process_whatsapp_message, sender_id, message)
                    
    except Exception as e:
        logger.error(f"Error parsing Meta webhook payload: {e}")

    return Response(content="OK", status_code=200)
