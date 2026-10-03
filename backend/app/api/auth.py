from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_pw, create_token, hash_pw
from app.models.models import User
from app.schemas.schemas import LoginIn

router = APIRouter(tags=["auth"])

@router.post("/auth/login")
def login(b: LoginIn, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.username == b.username).first()
    if not u or not verify_pw(b.password, u.hashed):
        raise HTTPException(401, "Invalid credentials")
    if not u.hashed.startswith("pbkdf2_sha256$"):
        u.hashed = hash_pw(b.password)
        db.commit()
    return {"access_token": create_token(u.username), "token_type": "bearer", "role": u.role, "username": u.username}
