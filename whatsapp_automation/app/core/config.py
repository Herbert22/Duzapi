import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional, List
from functools import lru_cache

# Project root directory (whatsapp_automation/)
_BASE_DIR = str(Path(__file__).resolve().parent.parent.parent)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    APP_NAME: str = "WhatsApp Automation API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    API_PREFIX: str = "/api/v1"

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # "json" or "text"

    # Security
    SECRET_KEY: str = "dev-secret-key-change-in-production-min-32-chars"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Shared secrets between backend and bridge
    BRIDGE_AUTH_TOKEN: str = "dev-bridge-token-change-in-production"
    WEBHOOK_SECRET: str = "dev-webhook-secret-change-in-production"
    # Fernet key for encrypting sensitive values (e.g. OpenAI API keys).
    # Generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    ENCRYPTION_KEY: str = ""

    # PostgreSQL
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "whatsapp_automation"

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def DATABASE_URL_SYNC(self) -> str:
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "whatsapp_logs"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # AI Provider: "gemini" or "openai"
    AI_PROVIDER: str = "gemini"

    # Google Gemini (default provider)
    GOOGLE_API_KEY: Optional[str] = None

    # OpenAI (fallback — can be overridden per tenant)
    OPENAI_API_KEY: Optional[str] = None

    # CORS — comma-separated origins, e.g. "http://localhost:3001,https://app.example.com"
    # Use "*" only for local development (never with allow_credentials=True).
    CORS_ORIGINS_STR: str = "http://localhost:3000,http://localhost:3001"

    @property
    def CORS_ORIGINS(self) -> List[str]:
        raw = self.CORS_ORIGINS_STR.strip()
        if raw == "*":
            if not self.DEBUG:
                import logging
                logging.getLogger(__name__).warning(
                    "CORS wildcard '*' is not allowed in production — falling back to empty list"
                )
                return []
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]

    # WhatsApp Bridge (internal container URL)
    WHATSAPP_BRIDGE_URL: str = "http://whatsapp_bridge:3000"

    # Legacy WPPConnect direct URL — kept for compatibility
    WPPCONNECT_URL: str = "http://localhost:21465"

    # Message log TTL in days (MongoDB TTL index)
    MESSAGE_LOG_TTL_DAYS: int = 90

    # Base directory for file storage
    BASE_DIR: str = _BASE_DIR

    class Config:
        env_file = ".env"
        case_sensitive = True

    def validate_production_secrets(self) -> None:
        """Log warnings if default/weak secrets are in use."""
        import logging
        logger = logging.getLogger(__name__)
        weak = {
            "dev-secret-key-change-in-production-min-32-chars",
            "your-secret-key-change-in-production",
        }
        if self.SECRET_KEY in weak:
            logger.warning("SECRET_KEY is using a default value — set a strong key in production!")
        if self.BRIDGE_AUTH_TOKEN == "dev-bridge-token-change-in-production":
            logger.warning("BRIDGE_AUTH_TOKEN is using a default value — change it in production!")
        if self.WEBHOOK_SECRET == "dev-webhook-secret-change-in-production":
            logger.warning("WEBHOOK_SECRET is using a default value — change it in production!")


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
