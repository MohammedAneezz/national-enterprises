from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_token
from app.models.models import User

oauth = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def current_user(db: Session = Depends(get_db), token: str = Depends(oauth)) -> User:
    sub = decode_token(token)
    if not sub:
        raise HTTPException(401, "Invalid token")
    u = db.query(User).filter(User.username == sub).first()
    if not u:
        raise HTTPException(401, "User not found")
    return u
