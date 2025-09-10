from fastapi import HTTPException, status
from typing import Optional
import jwt

class JWTVerifier:
    def __init__(self, secret: Optional[str] = None, audience: Optional[str] = None, issuer: Optional[str] = None):
        self.secret = secret
        self.audience = audience
        self.issuer = issuer

    def verify(self, token: str) -> dict:
        if not self.secret:
            raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="JWT verification not configured")
        try:
            payload = jwt.decode(token, self.secret, algorithms=["HS256"], audience=self.audience, issuer=self.issuer)
            return payload
        except jwt.PyJWTError as e:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}")
