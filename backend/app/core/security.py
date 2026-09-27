from datetime import datetime, timedelta
import hashlib
from jose import jwt
from app.core.config import settings

def hash_pw(p: str) -> str:
    return hashlib.sha256(("ne::" + p).encode()).hexdigest()

def verify_pw(p: str, h: str) -> bool:
    return hash_pw(p) == h

def create_token(sub: str) -> str:
    exp = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": sub, "exp": exp}, settings.SECRET_KEY, algorithm="HS256")

def decode_token(t: str) -> str | None:
    try:
        return jwt.decode(t, settings.SECRET_KEY, algorithms=["HS256"]).get("sub")
    except Exception:
        return None
