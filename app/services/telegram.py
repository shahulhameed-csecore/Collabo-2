import httpx
import structlog
from app.core.config import settings

logger = structlog.get_logger(__name__)

# Default max bytes for media downloads (16 MB) — can be overridden per call
_DEFAULT_MAX_MEDIA_BYTES = 16 * 1024 * 1024

from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type

@retry(
    wait=wait_exponential(multiplier=1, min=2, max=10),
    stop=stop_after_attempt(3),
    retry=retry_if_exception_type((httpx.RequestError, httpx.TimeoutException)),
    reraise=True
)
async def _do_send_telegram_message(url: str, payload: dict, client: httpx.AsyncClient | None = None) -> bool:
    is_local_client = client is None
    http_client = client or httpx.AsyncClient()
    try:
        response = await http_client.post(url, json=payload, timeout=10.0)
        if response.status_code != 200:
            logger.error("Telegram API error", status=response.status_code, detail=response.text)
            return False
        return True
    finally:
        if is_local_client:
            await http_client.aclose()


async def send_telegram_message(chat_id: int | str, text: str, reply_markup: dict | None = None, client: httpx.AsyncClient | None = None) -> bool:
    """
    Sends a text message using the Telegram Bot API.
    Optionally accepts a reply_markup dict (for inline keyboards).
    """
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.error("Telegram credentials missing (TELEGRAM_BOT_TOKEN).")
        return False

    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup

    try:
        return await _do_send_telegram_message(url, payload, client)
    except Exception as e:
        logger.error("Exception sending Telegram message", error=str(e), exc_info=True)
        return False

async def answer_callback_query(callback_query_id: str, text: str = "") -> bool:
    """
    Answers a callback query (when a user presses an inline button).
    This removes the loading state from the button in the Telegram app.
    """
    if not settings.TELEGRAM_BOT_TOKEN:
        return False
        
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/answerCallbackQuery"
    payload = {
        "callback_query_id": callback_query_id,
        "text": text
    }
    
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(url, json=payload, timeout=5.0)
            return res.status_code == 200
    except Exception as e:
        logger.error("Exception answering callback query", error=str(e))
        return False

async def download_telegram_media(
    file_id: str, max_bytes: int = _DEFAULT_MAX_MEDIA_BYTES
) -> bytes | None:
    """
    Downloads media (voice notes, images) from Telegram servers.
    Enforces a byte limit to prevent OOM from malicious/large files.
    """
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not set — cannot download media.")
        return None

    try:
        async with httpx.AsyncClient() as client:
            # Step 1: Get the file_path
            file_url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/getFile"
            res = await client.get(file_url, params={"file_id": file_id}, timeout=10.0)
            if res.status_code != 200:
                logger.error("Failed to fetch file metadata", status=res.status_code, file_id=file_id)
                return None

            data = res.json()
            if not data.get("ok"):
                logger.error("Telegram API getFile returned not OK", data=data)
                return None
                
            file_path = data.get("result", {}).get("file_path")
            if not file_path:
                logger.error("file_path missing in metadata response", file_id=file_id)
                return None

            # Step 2: Stream-download with size guard
            download_url = f"https://api.telegram.org/file/bot{settings.TELEGRAM_BOT_TOKEN}/{file_path}"
            chunks: list[bytes] = []
            total = 0
            
            async with client.stream("GET", download_url, timeout=45.0) as stream:
                if stream.status_code != 200:
                    logger.error("Failed to download media binary from Telegram", status=stream.status_code)
                    return None
                async for chunk in stream.aiter_bytes(chunk_size=65536):
                    total += len(chunk)
                    if total > max_bytes:
                        logger.warning(
                            "Media download aborted — exceeded size limit",
                            file_id=file_id,
                            max_bytes=max_bytes,
                            bytes_downloaded=total
                        )
                        return None
                    chunks.append(chunk)

            return b"".join(chunks)

    except Exception as e:
        logger.error("Exception downloading Telegram media", file_id=file_id, error=str(e))
        return None
