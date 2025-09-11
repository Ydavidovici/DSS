# app/settings.py
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl
from typing import List, Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Temima Photography API"
    API_PREFIX: str = "/api"

    # CORS (new)
    CORS_ORIGINS: List[AnyHttpUrl] = ["http://localhost:5173"]
    # Back-compat for older env files (optional but helpful)
    FRONTEND_ORIGINS: Optional[List[AnyHttpUrl]] = None

    # DB
    DATABASE_URL: str = "sqlite:///./temima.db"

    # Media
    MEDIA_ROOT: str = "./media"
    MEDIA_DERIV_ROOT: str = "./media_deriv"
    MEDIA_BASE_URL: str = "/media"
    MAX_UPLOAD_MB: int = 200
    DERIV_WIDTHS: str = "2048,1280,800,480"
    DERIV_QUALITY: int = 82

    # Email
    EMAIL_TO: str = "temimaedgar@gmail.com"
    EMAIL_FROM: str = "no-reply@temima.local"
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_STARTTLS: bool = False
    SMTP_SSL: bool = False

    # Auth (admin endpoints)
    AUTH_JWT_SECRET: Optional[str] = None
    AUTH_JWKS_URL: Optional[str] = None
    AUTH_AUDIENCE: Optional[str] = None
    AUTH_ISSUER: Optional[str] = None

    # Pydantic v2 config
    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore",
    }

    @property
    def allow_origins(self) -> List[str]:
        # Prefer FRONTEND_ORIGINS if present (for back-compat), else CORS_ORIGINS
        return [str(u) for u in (self.FRONTEND_ORIGINS or self.CORS_ORIGINS)]

settings = Settings()
