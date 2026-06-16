from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from app.services.supabase import supabase

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
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
    except Exception as e:
        # Catch errors from gotrue/supabase (e.g., Invalid login credentials)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Incorrect username or password. Details: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
