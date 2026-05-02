"""
Authentication API routes.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from app.core.config import settings
from app.db.session import get_db_session
from app.schemas.auth import UserRegister, UserLogin, GoogleAuthRequest, TokenResponse
from app.services.auth_service import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(
    user_data: UserRegister,
    db: Session = Depends(get_db_session)
) -> TokenResponse:
    """
    Register a new user.
    
    Args:
        user_data: Registration data (email, password)
        db: Database session
        
    Returns:
        TokenResponse with JWT access token
    """
    return auth_service.register(db, user_data)


@router.post("/login", response_model=TokenResponse)
async def login(
    user_data: UserLogin,
    db: Session = Depends(get_db_session)
) -> TokenResponse:
    """
    Login a user and return JWT token.
    
    Args:
        user_data: Login credentials (email, password)
        db: Database session
        
    Returns:
        TokenResponse with JWT access token
    """
    return auth_service.login(db, user_data)


@router.post("/google", response_model=TokenResponse)
async def google_login(
    request: GoogleAuthRequest,
    db: Session = Depends(get_db_session),
) -> TokenResponse:
    """Verify Google ID token, then issue local JWT for app access."""
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth is not configured",
        )

    try:
        token_info = id_token.verify_oauth2_token(
            request.token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {str(exc)}",
        )

    email = token_info.get("email")
    name = token_info.get("name") or "User"
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google token did not include email",
        )

    return auth_service.login_or_register_google(db, email=email, name=name)
