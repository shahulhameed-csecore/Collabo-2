import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from app.services.supabase import supabase
from app.core.limiter import limiter

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/token")
@limiter.limit("10/minute")
def login_for_access_token(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    try:
        # In OAuth2, the client sends 'username' and 'password'.
        # We map 'username' to 'email' for Supabase authentication.
        auth_response = supabase.auth.sign_in_with_password({
            "email": form_data.username,
            "password": form_data.password
        })
        if not auth_response or not auth_response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return {"access_token": auth_response.session.access_token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        # Log internally but NEVER expose raw exception details to the caller
        logger.warning("Login failed for user", email=form_data.username, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
