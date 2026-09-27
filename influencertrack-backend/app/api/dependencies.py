import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_async_client, AsyncClient, ClientOptions
from app.services.supabase import get_supabase_admin
from app.core.config import settings

logger = logging.getLogger(__name__)

security = HTTPBearer()

class AuthenticatedUser:
    def __init__(self, user, jwt_token):
        self.user = user
        self.jwt_token = jwt_token

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> AuthenticatedUser:
    """
    Validates the JWT token.
    Fast path: Uses local PyJWT verification via Supabase JWKS (JSON Web Key Set).
    Fallback path: Uses Supabase Auth API (get_user) if local validation fails.
    """
    token = credentials.credentials
    
    try:
        import jwt
        # PyJWKClient automatically caches the JWKS so it only makes a network request once
        jwks_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/jwks"
        jwks_client = jwt.PyJWKClient(jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["HS256", "ES256", "RS256"],
            audience="authenticated"
        )
        
        class MockUser:
            def __init__(self, id, email):
                self.id = id
                self.email = email
                
        user_id = payload.get("sub")
        email = payload.get("email")
        if not user_id:
            raise ValueError("Missing 'sub' in token payload")
            
        return AuthenticatedUser(MockUser(id=user_id, email=email), token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        # If local decoding fails (e.g., PyJWKClient error), we silently fall back to Supabase API
        pass
        
    # Fallback to Supabase Auth API
    try:
        service_client = await get_service_client()
        user_response = await service_client.auth.get_user(token)
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
        logger.warning("Token validation fallback failed", error=type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_user_supabase_client(user: AuthenticatedUser = Depends(get_current_user)):
    """
    Returns a Supabase client authenticated with the user's JWT.
    This client will respect Row Level Security (RLS) policies.
    Defined once here to avoid duplication across router files.
    """
    client = await create_async_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_ANON_KEY,
        options=ClientOptions(headers={"Authorization": f"Bearer {user.jwt_token}"})
    )
    return client

async def get_service_client():
    """
    Returns a Supabase client authenticated with the SERVICE ROLE KEY.
    Use ONLY for internal/background tasks that need to bypass RLS.
    """
    if not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=500, 
            detail="Supabase service role key not configured."
        )
    return await get_supabase_admin()

