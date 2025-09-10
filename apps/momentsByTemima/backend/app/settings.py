from pydantic_settings import BaseSettings
from typing import List, Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Temima Photography API"
    API_PREFIX: str = "/api"

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173"]

    # DB
    DATABASE_URL: str = "sqlite:///./temima.db"  # swap to Postgres via env

    # Media
    MEDIA_ROOT: str = "./media"
    MEDIA_BASE_URL: str = "http://localhost:8000/media"

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
    AUTH_JWT_SECRET: Optional[str] = None  # HS256 secret
    AUTH_JWKS_URL: Optional[str] = None    # optional JWKS endpoint (not used if secret present)
    AUTH_AUDIENCE: Optional[str] = None
    AUTH_ISSUER: Optional[str] = None

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
