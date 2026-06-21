import httpx
import structlog
from app.core.config import settings

logger = structlog.get_logger(__name__)

# Graph API version — update here when Meta deprecates v20.0
_GRAPH_API_VERSION = "v20.0"

# Default max bytes for media downloads (16 MB) — can be overridden per call
_DEFAULT_MAX_MEDIA_BYTES = 16 * 1024 * 1024


async def send_whatsapp_message(to_number: str, body: str) -> bool:
    """
    Sends a WhatsApp text message using the Official Meta Cloud API.
    """
    if not settings.WHATSAPP_TOKEN or not settings.WHATSAPP_PHONE_NUMBER_ID:
        logger.error("Meta WhatsApp credentials missing (WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID).")
        return False

    url = f"https://graph.facebook.com/{_GRAPH_API_VERSION}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {settings.WHATSAPP_TOKEN}",
        "Content-Type": "application/json",
    }

    # Meta expects the number without '+' and without 'whatsapp:' prefix
    clean_to = to_number.replace("whatsapp:", "").lstrip("+")

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": clean_to,
        "type": "text",
        "text": {"preview_url": False, "body": body},
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=10.0)
            if response.status_code not in (200, 201):
                logger.error(
                    "WhatsApp API error",
                    status=response.status_code,
                    body=response.text[:500],
                )
                return False
            return True
    except Exception as e:
        logger.error("Exception sending WhatsApp message", error=str(e), exc_info=True)
        return False


async def download_whatsapp_media(
    media_id: str, max_bytes: int = _DEFAULT_MAX_MEDIA_BYTES
) -> bytes | None:
    """
    Downloads media (voice notes, images) from WhatsApp servers.
    Enforces a byte limit to prevent OOM from malicious/large files.

    Steps:
      1. Fetch the media download URL via Graph API.
      2. Stream-download the binary, stopping if max_bytes is exceeded.
    """
    if not settings.WHATSAPP_TOKEN:
        logger.error("WHATSAPP_TOKEN not set — cannot download media.")
        return None

    metadata_url = f"https://graph.facebook.com/{_GRAPH_API_VERSION}/{media_id}"
    headers = {"Authorization": f"Bearer {settings.WHATSAPP_TOKEN}"}

    try:
        async with httpx.AsyncClient() as client:
            # Step 1: Get the short-lived download URL
            res = await client.get(metadata_url, headers=headers, timeout=10.0)
            if res.status_code != 200:
                logger.error("Failed to fetch media metadata", status=res.status_code, media_id=media_id)
                return None

            media_url = res.json().get("url")
            if not media_url:
                logger.error("Media URL missing in metadata response", media_id=media_id)
                return None

            # Step 2: Stream-download with size guard
            chunks: list[bytes] = []
            total = 0
            async with client.stream("GET", media_url, headers=headers, timeout=30.0) as stream:
                if stream.status_code != 200:
                    logger.error("Failed to download media binary", status=stream.status_code)
                    return None
                async for chunk in stream.aiter_bytes(chunk_size=65536):
                    total += len(chunk)
                    if total > max_bytes:
                        logger.warning(
                            "Media download aborted — exceeded size limit",
                            media_id=media_id,
                            max_bytes=max_bytes,
                        )
                        return None
                    chunks.append(chunk)

            return b"".join(chunks)

    except Exception as e:
        logger.error("Exception downloading WhatsApp media", media_id=media_id, error=str(e))
        return None
