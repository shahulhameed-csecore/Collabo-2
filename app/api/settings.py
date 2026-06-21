import logging
import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.api.dependencies import get_current_user, get_user_supabase_client, AuthenticatedUser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["Settings"])

# Maximum digits for a phone number (e.g. 15 per E.164 standard)
_PHONE_RE = re.compile(r"^\d{8,15}$")


class WhatsAppSettingsInput(BaseModel):
    whatsapp_number: str
    email_reminders_enabled: bool = True
    whatsapp_reminders_enabled: bool = True


@router.post("/whatsapp")
async def save_whatsapp_settings(
    input_data: WhatsAppSettingsInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
    client=Depends(get_user_supabase_client),
):
    """
    Saves or updates the user's WhatsApp settings.
    """
    user_id = current_user.user.id

    # Extract only digits
    clean_number = "".join(filter(str.isdigit, input_data.whatsapp_number))

    # Strip leading zero if 11 digits starting with 0 (common in India)
    if len(clean_number) == 11 and clean_number.startswith("0"):
        clean_number = clean_number[1:]

    # Auto-prepend India country code if exactly 10 digits
    if len(clean_number) == 10:
        clean_number = "91" + clean_number

    # Validate against E.164 range: 8–15 digits after cleanup
    if not _PHONE_RE.match(clean_number):
        raise HTTPException(
            status_code=400,
            detail="Invalid phone number. Please provide a valid number with country code (8–15 digits).",
        )

    try:
        client.table("user_settings").upsert(
            {
                "user_id": user_id,
                "whatsapp_number": clean_number,
                "email_reminders_enabled": input_data.email_reminders_enabled,
                "whatsapp_reminders_enabled": input_data.whatsapp_reminders_enabled,
            }
        ).execute()

        return {
            "message": "Settings saved successfully",
            "whatsapp_number": clean_number,
            "email_reminders_enabled": input_data.email_reminders_enabled,
            "whatsapp_reminders_enabled": input_data.whatsapp_reminders_enabled,
        }
    except Exception as e:
        error_str = str(e).lower()
        if "unique constraint" in error_str or "duplicate key" in error_str:
            raise HTTPException(
                status_code=400,
                detail="This WhatsApp number is already linked to another account.",
            )
        if "relation" in error_str and "user_settings" in error_str:
            raise HTTPException(
                status_code=500,
                detail="Database table 'user_settings' is missing. Please run the SQL setup script.",
            )
        logger.error("Failed to save user settings", user_id=user_id, error=type(e).__name__)
        raise HTTPException(status_code=500, detail="Failed to save settings. Please try again.")


@router.get("/whatsapp")
async def get_whatsapp_settings(
    current_user: AuthenticatedUser = Depends(get_current_user),
    client=Depends(get_user_supabase_client),
):
    user_id = current_user.user.id

    try:
        response = (
            client.table("user_settings")
            .select("whatsapp_number, email_reminders_enabled, whatsapp_reminders_enabled")
            .eq("user_id", user_id)
            .execute()
        )
        if response.data:
            return response.data[0]
        return {
            "whatsapp_number": None,
            "email_reminders_enabled": True,
            "whatsapp_reminders_enabled": True,
        }
    except Exception as e:
        logger.error("Failed to fetch user settings", user_id=user_id, error=type(e).__name__)
        return {
            "whatsapp_number": None,
            "email_reminders_enabled": True,
            "whatsapp_reminders_enabled": True,
        }
