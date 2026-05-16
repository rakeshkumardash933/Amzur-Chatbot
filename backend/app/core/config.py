"""
Application configuration loaded from environment variables.
"""
from typing import Optional
from dotenv import load_dotenv
from pydantic_settings import BaseSettings


load_dotenv()


class Settings(BaseSettings):
    """Application settings."""

    # Core
    APP_NAME: str = "Amzur Chat"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # Database
    DATABASE_URL: str
    
    # Auth
    JWT_SECRET: Optional[str] = None
    SECRET_KEY: Optional[str] = None
    JWT_EXPIRE_MINUTES: int = 30
    
    # OAuth - Google
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: Optional[str] = None
    GOOGLE_SERVICE_ACCOUNT_JSON: Optional[str] = None
    
    # LiteLLM Proxy
    LITELLM_PROXY_URL: str = "https://litellm.amzur.com/v1"
    LITELLM_API_KEY: str
    LITELLM_VIRTUAL_KEY: Optional[str] = None
    LITELLM_USER_ID: Optional[str] = None
    LITELLM_DEPARTMENT: Optional[str] = "Development"
    LITELLM_ENVIRONMENT: Optional[str] = "development"
    LLM_MODEL: str = "gpt-4o"
    LITELLM_EMBEDDING_MODEL: str = "text-embedding-3-large"
   
    # Google Gemini API
    GOOGLE_GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-pro"
    GEMINI_IMAGE_MODEL: str = "gemini-2.5-flash-image"

    # Image generation via LiteLLM proxy
    IMAGE_GEN_MODEL: str = "gemini/gemini-2.5-flash"
    
    # ChromaDB
    CHROMA_PERSIST_DIR: str = "./chroma_data"

    # File uploads
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE_MB: int = 20
    
    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
    ]
    
    class Config:
        env_file = ".env"
        case_sensitive = True

    @property
    def jwt_signing_key(self) -> str:
        """Resolve JWT signing key with backward compatibility."""
        key = self.JWT_SECRET or self.SECRET_KEY
        if not key:
            raise ValueError("JWT secret is not configured. Set JWT_SECRET in backend/.env")
        return key


settings = Settings()
