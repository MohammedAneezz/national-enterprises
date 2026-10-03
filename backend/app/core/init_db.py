from sqlalchemy.orm import Session
from app.core.database import Base, engine, SessionLocal
from app.core.security import hash_pw
from app.core.config import settings
from app.models.models import Line, User

def init_db(db: Session):
    bind = db.get_bind() if hasattr(db, "get_bind") else engine
    if settings.APP_ENV != "production":
        Base.metadata.create_all(bind=bind)
    for name in ["A-Line", "B-Line", "C-Line"]:
        if not db.query(Line).filter(Line.name == name).first():
            db.add(Line(name=name))
    if not db.query(User).filter(User.username == "admin").first():
        db.add(User(username="admin", hashed=hash_pw(settings.ADMIN_PASSWORD), role="admin"))
    db.commit()
