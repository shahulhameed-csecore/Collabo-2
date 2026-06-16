from fastapi import Depends, HTTPException, status, Security
from fastapi.security import OAuth2PasswordBearer
from app.services.supabase import supabase

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

class AuthenticatedUser:
    def __init__(self, user, jwt_token):
        self.user = user
        self.jwt_token = jwt_token

async def get_current_user(token: str = Depends(oauth2_scheme)):
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
