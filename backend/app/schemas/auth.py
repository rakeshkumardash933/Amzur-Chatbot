"""
Pydantic schemas for authentication.
"""
from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    """Register request schema."""

    name: str | None = Field(default=None, description="Display name")
    email: EmailStr = Field(..., description="Email address (must end with @amzur.com)")
    password: str = Field(..., min_length=6, description="Password (min 6 characters)")


class UserLogin(BaseModel):
    """Login request schema."""

    email: EmailStr = Field(..., description="Email address")
    password: str = Field(..., description="Password")


class TokenResponse(BaseModel):
    """Token response schema."""

    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field(default="bearer", description="Token type")
    user_id: int = Field(..., description="User ID")
    name: str = Field(..., description="User display name")
    email: str = Field(..., description="User email")


class GoogleAuthRequest(BaseModel):
    """Google auth request schema."""

    token: str = Field(..., min_length=10, description="Google ID token")


class UserResponse(BaseModel):
    """User response schema."""

    id: int = Field(..., description="User ID")
    email: str = Field(..., description="Email address")

    class Config:
        from_attributes = True
