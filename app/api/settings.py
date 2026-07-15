import logging
import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.api.dependencies import get_current_user, get_user_supabase_client, AuthenticatedUser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["Settings"])

# Maximum digits for a phone number (e.g. 15 per E.164 standard)
_PHONE_RE = re.compile(r"^\d{8,15}$")


from typing import Optional
from app.services.whatsapp import send_whatsapp_message

class SettingsInput(BaseModel):
    whatsapp_number: Optional[str] = None
    email_reminders_enabled: bool = True
    whatsapp_reminders_enabled: bool = True
    username: Optional[str] = None
    telegram_username: Optional[str] = None


@router.post("/whatsapp")
async def save_settings(
    input_data: SettingsInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
    client=Depends(get_user_supabase_client),
):
    """
    Saves or updates the user's WhatsApp settings.
    """
    user_id = current_user.user.id

    # Extract only digits for whatsapp_number if provided
    clean_number = None
    if input_data.whatsapp_number:
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
        from fastapi.concurrency import run_in_threadpool
        # Check current settings to detect if WhatsApp number changed
        current_settings = await (client.table("user_settings").select("whatsapp_number").eq("user_id", user_id).execute())
        old_number = current_settings.data[0].get("whatsapp_number") if current_settings.data else None
        
        payload = {
            "user_id": user_id,
            "email_reminders_enabled": input_data.email_reminders_enabled,
            "whatsapp_reminders_enabled": input_data.whatsapp_reminders_enabled,
        }
        if clean_number is not None:
            payload["whatsapp_number"] = clean_number
        if input_data.username is not None:
            payload["username"] = input_data.username
        if input_data.telegram_username is not None:
            # ensure @ prefix is kept or add it later? Actually, frontend will just send string.
            tg = input_data.telegram_username.strip()
            if tg and not tg.startswith("@"):
                tg = f"@{tg}"
            payload["telegram_username"] = tg if tg else None

        await (client.table("user_settings").upsert(payload).execute())
        
        # Trigger notification if WhatsApp number was newly linked or updated
        if clean_number and clean_number != old_number:
            try:
                from app.api.dependencies import get_service_client
                from app.services.notifications import create_notification
                service_client = await get_service_client()
                await create_notification(
                    service_client=service_client,
                    user_id=user_id,
                    title="WhatsApp Linked 🎉",
                    message=f"Your number ending in {clean_number[-4:]} is now connected to the Collabo Bot.",
                    type="success",
                    link_url="/settings"
                )
            except Exception as e:
                logger.error(f"Failed to create whatsapp link notification: {e}")

        return {
            "message": "Settings saved successfully",
            "whatsapp_number": clean_number,
            "email_reminders_enabled": input_data.email_reminders_enabled,
            "whatsapp_reminders_enabled": input_data.whatsapp_reminders_enabled,
            "username": input_data.username,
            "telegram_username": input_data.telegram_username,
        }
    except Exception as e:
        error_str = str(e).lower()
        if "unique constraint" in error_str or "duplicate key" in error_str:
            if "username" in error_str:
                raise HTTPException(
                    status_code=400,
                    detail="This username is already taken. Please choose another one.",
                )
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
async def get_settings(
    current_user: AuthenticatedUser = Depends(get_current_user),
    client=Depends(get_user_supabase_client),
):
    user_id = current_user.user.id

    try:
        response = (
            await client.table("user_settings")
            .select("whatsapp_number, email_reminders_enabled, whatsapp_reminders_enabled, username, telegram_username")
            .eq("user_id", user_id)
            .execute()
        )
        if response.data:
            return response.data[0]
        return {
            "whatsapp_number": None,
            "email_reminders_enabled": True,
            "whatsapp_reminders_enabled": True,
            "username": None,
            "telegram_username": None,
        }
    except Exception as e:
        logger.error("Failed to fetch user settings", user_id=user_id, error=type(e).__name__)
        return {
            "whatsapp_number": None,
            "email_reminders_enabled": True,
            "whatsapp_reminders_enabled": True,
            "telegram_username": None,
        }

@router.post("/whatsapp/verify")
async def verify_whatsapp_connection(
    current_user: AuthenticatedUser = Depends(get_current_user),
    client=Depends(get_user_supabase_client),
):
    """
    Sends a test WhatsApp message to verify the connection.
    """
    user_id = current_user.user.id
    
    # 1. Fetch user settings
    response = await client.table("user_settings").select("whatsapp_number").eq("user_id", user_id).execute()
    if not response.data or not response.data[0].get("whatsapp_number"):
        raise HTTPException(status_code=400, detail="No WhatsApp number linked. Please save your number first.")
        
    whatsapp_number = response.data[0]["whatsapp_number"]
    
    # 2. Send test message
    test_msg = (
        "✅ *Collabo Verification Successful*\n\n"
        "Your WhatsApp is successfully connected to your Collabo account! "
        "You can now forward chats, voice notes, and screenshots here to instantly extract campaign data."
    )
    
    success = await send_whatsapp_message(to_number=whatsapp_number, body=test_msg)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to send verification message. Please check the number and try again.")
        
    return {"message": "Verification message sent successfully!", "status": "connected"}
