from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, constr
from app.api.dependencies import get_current_user, AuthenticatedUser
from app.core.config import settings
from supabase import create_client

router = APIRouter(prefix="/settings", tags=["Settings"])

# Use service role to bypass RLS, or let the user token apply policies.
# Helper function to get admin client safely at runtime
def get_supabase_admin():
    service_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
    return create_client(settings.SUPABASE_URL, service_key)

class WhatsAppSettingsInput(BaseModel):
    whatsapp_number: str

@router.post("/whatsapp")
async def save_whatsapp_settings(input_data: WhatsAppSettingsInput, current_user: AuthenticatedUser = Depends(get_current_user)):
    """
    Saves or updates the user's WhatsApp number for the bot integration.
    """
    user_id = current_user.user.id
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user token")

    # Basic sanitization
    clean_number = "".join(filter(str.isdigit, input_data.whatsapp_number))
    if not clean_number:
        raise HTTPException(status_code=400, detail="Invalid phone number format")

    if not clean_number.startswith("91") and len(clean_number) == 10:
        clean_number = "91" + clean_number

    # Enforce uniqueness globally to avoid multiple accounts with the same number
    try:
        supabase_admin = get_supabase_admin()
        existing = supabase_admin.table("user_settings").select("user_id").eq("whatsapp_number", clean_number).execute()
        if existing.data and existing.data[0]["user_id"] != user_id:
             raise HTTPException(status_code=400, detail="This WhatsApp number is already linked to another account.")
    except Exception as e:
        pass # If table doesn't exist yet, we will catch it in upsert

    # Upsert the number
    try:
        supabase_admin = get_supabase_admin()
        response = supabase_admin.table("user_settings").upsert(
            {"user_id": user_id, "whatsapp_number": clean_number}
        ).execute()
        
        return {"message": "WhatsApp number saved successfully", "whatsapp_number": clean_number}
    except Exception as e:
        error_str = str(e)
        if "relation \"public.user_settings\" does not exist" in error_str:
            raise HTTPException(status_code=500, detail="Database table 'user_settings' is missing. Please run the SQL setup script.")
        raise HTTPException(status_code=500, detail=f"Database error: {error_str}")

@router.get("/whatsapp")
async def get_whatsapp_settings(current_user: AuthenticatedUser = Depends(get_current_user)):
    user_id = current_user.user.id
    
    try:
        supabase_admin = get_supabase_admin()
        response = supabase_admin.table("user_settings").select("whatsapp_number").eq("user_id", user_id).execute()
        if response.data:
            return {"whatsapp_number": response.data[0]["whatsapp_number"]}
        return {"whatsapp_number": None}
    except Exception:
        return {"whatsapp_number": None}
