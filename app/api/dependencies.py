import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, ClientOptions
from app.services.supabase import supabase
from app.core.config import settings

logger = logging.getLogger(__name__)

security = HTTPBearer()

class AuthenticatedUser:
    def __init__(self, user, jwt_token):
        self.user = user
        self.jwt_token = jwt_token

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> AuthenticatedUser:
    """
    Validates the JWT token against Supabase Auth (server-side verification).
    Raises 401 if the token is missing, expired, or invalid.
    Error details are intentionally generic to prevent information leakage.
    """
    token = credentials.credentials
    try:
        user_response = supabase.auth.get_user(token)
        if user_response and user_response.user:
            return AuthenticatedUser(user_response.user, token)
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except HTTPException:
        raise
    except Exception as e:
        # Log internally but never expose exception internals to the caller
        logger.warning("Token validation failed", error=type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_user_supabase_client(user: AuthenticatedUser = Depends(get_current_user)):
    """
    Returns a Supabase client authenticated with the user's JWT.
    This client will respect Row Level Security (RLS) policies.
    Defined once here to avoid duplication across router files.
    """
    client = create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_ANON_KEY,
        options=ClientOptions(headers={"Authorization": f"Bearer {user.jwt_token}"})
    )
    return client

def get_service_client():
    """
    Returns a Supabase client authenticated with the SERVICE ROLE KEY.
    Use ONLY for internal/background tasks that need to bypass RLS.
    """
    if not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=500, 
            detail="Supabase service role key not configured."
        )
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

