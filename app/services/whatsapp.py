import httpx
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

async def send_whatsapp_message(to_number: str, body: str) -> bool:
    """
    Sends a WhatsApp text message using the Official Meta Cloud API.
    """
    if not settings.WHATSAPP_TOKEN or not settings.WHATSAPP_PHONE_NUMBER_ID:
        logger.error("Meta WhatsApp credentials missing.")
        return False

    url = f"https://graph.facebook.com/v20.0/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {settings.WHATSAPP_TOKEN}",
        "Content-Type": "application/json",
    }
    
    # Meta expects the number without the '+' sign and without 'whatsapp:' prefix
    clean_to = to_number.replace('whatsapp:', '').lstrip('+')

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": clean_to,
        "type": "text",
        "text": {"preview_url": False, "body": body}
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=10.0)
            
            if response.status_code not in (200, 201):
                logger.error(f"WhatsApp API Error: {response.status_code} - {response.text}")
                return False
            return True
    except Exception as e:
        logger.error(f"Exception sending WhatsApp message: {e}", exc_info=True)
        return False

async def download_whatsapp_media(media_id: str) -> bytes | None:
    """
    Downloads media (like voice notes) from WhatsApp servers.
    Requires 2 steps:
    1. Get the media URL via Graph API
    2. Download the binary data
    """
    if not settings.WHATSAPP_TOKEN:
        return None

    url = f"https://graph.facebook.com/v20.0/{media_id}"
    headers = {"Authorization": f"Bearer {settings.WHATSAPP_TOKEN}"}
    
    try:
        async with httpx.AsyncClient() as client:
            # Step 1: Get media URL
            res = await client.get(url, headers=headers, timeout=10.0)
            if res.status_code != 200:
                logger.error(f"Failed to fetch media metadata: {res.text}")
                return None
                
            media_url = res.json().get('url')
            if not media_url:
                return None

            # Step 2: Download binary data
            media_res = await client.get(media_url, headers=headers, timeout=30.0)
            if media_res.status_code == 200:
                return media_res.content
            else:
                logger.error(f"Failed to download media binary: {media_res.status_code}")
                return None
    except Exception as e:
        logger.error(f"Exception downloading media: {e}")
        return None
