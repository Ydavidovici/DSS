from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from .db import SessionLocal
from .settings import settings
from .utils.jwt import JWTVerifier

verifier = JWTVerifier(secret=settings.AUTH_JWT_SECRET, audience=settings.AUTH_AUDIENCE, issuer=settings.AUTH_ISSUER)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def require_admin(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.split()[1]
    return verifier.verify(token)
