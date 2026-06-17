from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.api.dependencies import get_current_user, AuthenticatedUser
from app.core.config import settings
from supabase import create_client, ClientOptions

router = APIRouter(prefix="/settings", tags=["Settings"])

def get_user_client(user=Depends(get_current_user)):
    client = create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_ANON_KEY,
        options=ClientOptions(headers={'Authorization': f'Bearer {user.jwt_token}'})
    )
    return client

class WhatsAppSettingsInput(BaseModel):
    whatsapp_number: str
    email_reminders_enabled: bool = True
    whatsapp_reminders_enabled: bool = True

@router.post("/whatsapp")
async def save_whatsapp_settings(
    input_data: WhatsAppSettingsInput, 
    current_user: AuthenticatedUser = Depends(get_current_user),
    client = Depends(get_user_client)
):
    """
    Saves or updates the user's settings.
    """
    user_id = current_user.user.id
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user token")

    # Basic sanitization: extract only digits
    clean_number = "".join(filter(str.isdigit, input_data.whatsapp_number))
    if not clean_number:
        raise HTTPException(status_code=400, detail="Invalid phone number format. Please provide a valid number.")

    # Strip leading zero if 11 digits (common in India)
    if len(clean_number) == 11 and clean_number.startswith("0"):
        clean_number = clean_number[1:]

    # Auto-prepend India country code if length is exactly 10
    if len(clean_number) == 10:
        clean_number = "91" + clean_number

    # Ensure it's not too short after cleaning
    if len(clean_number) < 10:
        raise HTTPException(status_code=400, detail="Phone number is too short.")

    # Upsert the settings using the user's authenticated client
    try:
        response = client.table("user_settings").upsert({
            "user_id": user_id, 
            "whatsapp_number": clean_number,
            "email_reminders_enabled": input_data.email_reminders_enabled,
            "whatsapp_reminders_enabled": input_data.whatsapp_reminders_enabled
        }).execute()
        
        return {
            "message": "Settings saved successfully", 
            "whatsapp_number": clean_number,
            "email_reminders_enabled": input_data.email_reminders_enabled,
            "whatsapp_reminders_enabled": input_data.whatsapp_reminders_enabled
        }
    except Exception as e:
        error_str = str(e).lower()
        if "unique constraint" in error_str or "duplicate key" in error_str:
             raise HTTPException(status_code=400, detail="This WhatsApp number is already linked to another account.")
        if "relation \"public.user_settings\" does not exist" in error_str:
            raise HTTPException(status_code=500, detail="Database table 'user_settings' is missing. Please run the SQL setup script.")
        
        raise HTTPException(status_code=500, detail="Failed to save settings. Please try again.")

@router.get("/whatsapp")
async def get_whatsapp_settings(
    current_user: AuthenticatedUser = Depends(get_current_user),
    client = Depends(get_user_client)
):
    user_id = current_user.user.id
    
    try:
        response = client.table("user_settings").select("whatsapp_number, email_reminders_enabled, whatsapp_reminders_enabled").eq("user_id", user_id).execute()
        if response.data:
            return response.data[0]
        return {"whatsapp_number": None, "email_reminders_enabled": True, "whatsapp_reminders_enabled": True}
    except Exception:
        return {"whatsapp_number": None, "email_reminders_enabled": True, "whatsapp_reminders_enabled": True}
