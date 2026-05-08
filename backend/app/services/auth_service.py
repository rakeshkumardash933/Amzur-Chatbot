"""
Authentication service for user registration and login.
"""
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models import User
from app.core.security import hash_password, verify_password, create_access_token
from app.schemas.auth import UserRegister, UserLogin, TokenResponse
from fastapi import HTTPException, status


class AuthService:
    """Service for authentication operations."""

    @staticmethod
    def _validate_domain(email: str) -> None:
        if not (
            email.endswith("@amzur.com")
            or email.endswith("@stackyon.com")
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email must be from @amzur.com or @stackyon.com domain"
            )

    @staticmethod
    def _token_response_for_user(user: User) -> TokenResponse:
        access_token = create_access_token(data={"sub": str(user.id)})
        return TokenResponse(
            access_token=access_token,
            user_id=user.id,
            name=user.name,
            email=user.email,
        )

    @staticmethod
    def register(db: Session, user_data: UserRegister) -> TokenResponse:
        """
        Register a new user.
        
        Args:
            db: Database session
            user_data: Registration data
            
        Returns:
            TokenResponse with access token
            
        Raises:
            HTTPException: If email is invalid or already exists
        """
        # Validate email domain
        AuthService._validate_domain(user_data.email)
        
        # Check if user already exists
        stmt = select(User).where(User.email == user_data.email)
        existing_user = db.execute(stmt).scalars().first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Create new user
        hashed_password = hash_password(user_data.password)
        user = User(
            name=(user_data.name or user_data.email.split("@")[0]).strip() or "User",
            email=user_data.email,
            password_hash=hashed_password
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        return AuthService._token_response_for_user(user)

    @staticmethod
    def login(db: Session, user_data: UserLogin) -> TokenResponse:
        """
        Authenticate a user and return a token.
        
        Args:
            db: Database session
            user_data: Login credentials
            
        Returns:
            TokenResponse with access token
            
        Raises:
            HTTPException: If credentials are invalid
        """
        # Find user
        stmt = select(User).where(User.email == user_data.email)
        user = db.execute(stmt).scalars().first()
        
        if not user or not user.password_hash or not verify_password(user_data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        return AuthService._token_response_for_user(user)

    @staticmethod
    def login_or_register_google(db: Session, email: str, name: str, google_id: str) -> TokenResponse:
        """Authenticate with Google identity by upserting a user."""
        AuthService._validate_domain(email)

        stmt = select(User).where(User.email == email)
        user = db.execute(stmt).scalars().first()
        if not user:
            user = User(
                name=name.strip() or email.split("@")[0],
                email=email,
                google_id=google_id,
                password_hash=None,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            has_changes = False
            if name and user.name != name:
                user.name = name.strip()
                has_changes = True
            if google_id and user.google_id != google_id:
                user.google_id = google_id
                has_changes = True
            if has_changes:
                db.add(user)
                db.commit()
                db.refresh(user)

        return AuthService._token_response_for_user(user)

    @staticmethod
    def get_user_by_id(db: Session, user_id: int) -> User | None:
        """
        Get user by ID.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            User object or None if not found
        """
        stmt = select(User).where(User.id == user_id)
        return db.execute(stmt).scalars().first()


auth_service = AuthService()
