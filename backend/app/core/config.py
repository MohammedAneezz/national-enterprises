import secrets
from pathlib import Path
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")
    PROJECT_NAME: str = "NATIONAL ENTERPRISES"
    VERSION: str = "1.1.0"
    API_V1_STR: str = "/api/v1"
    APP_ENV: str = "development"
    SECRET_KEY: str = ""
    ADMIN_PASSWORD: str = "admin123"
    BUSINESS_TIMEZONE: str = "Asia/Kolkata"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12
    BACKEND_CORS_ORIGINS: list[str] = ["*"]
    DATABASE_URL: str = f"sqlite:///{(BACKEND_DIR / 'national.db').as_posix()}"

    @model_validator(mode="after")
    def validate_environment(self):
        if self.APP_ENV == "production":
            if len(self.SECRET_KEY) < 32:
                raise ValueError("Production SECRET_KEY must have at least 32 characters")
            if self.ADMIN_PASSWORD == "admin123" or len(self.ADMIN_PASSWORD) < 12:
                raise ValueError("Set a unique ADMIN_PASSWORD with at least 12 characters for production")
            if not self.DATABASE_URL.startswith(("postgresql://", "postgres://", "postgresql+psycopg://")):
                raise ValueError("Production requires a PostgreSQL DATABASE_URL")
        elif not self.SECRET_KEY:
            self.SECRET_KEY = secrets.token_urlsafe(48)
        return self


settings = Settings()
