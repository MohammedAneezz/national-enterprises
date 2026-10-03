from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_token
from app.models.models import User

bearer = HTTPBearer(auto_error=False)


def current_user(db: Session = Depends(get_db), credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> User:
    sub = decode_token(credentials.credentials) if credentials else None
    user = db.query(User).filter(User.username == sub).first() if sub else None
    if user is None:
        raise HTTPException(401, "Sign in to continue", headers={"WWW-Authenticate": "Bearer"})
    return user
