from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    GEMINI_API_KEY: str
    ALLOWED_ORIGINS: str = "https://collabo-2.vercel.app,http://localhost:3000,http://127.0.0.1:3000,https://mycollabo.online,http://mycollabo.online"
    SENTRY_DSN: Optional[str] = None
    
    # WhatsApp (Meta Cloud API) Integration
    WHATSAPP_TOKEN: Optional[str] = None
    WHATSAPP_PHONE_NUMBER_ID: Optional[str] = None
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: Optional[str] = None
    WHATSAPP_APP_SECRET: Optional[str] = None
    
    # Required for webhook to insert data without user JWT
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None

    # Email Webhook (Google Apps Script)
    GMAIL_WEBHOOK_URL: Optional[str] = None
    GMAIL_WEBHOOK_SECRET: Optional[str] = None
    SCHEDULER_INTERVAL_MINUTES: int = 60  # Default to 1 hour

    # Internal debug endpoint secret (POST /internal/trigger-reminders)
    # Set any random string here; leave empty to disable the endpoint.
    INTERNAL_SECRET: Optional[str] = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

settings = Settings()
