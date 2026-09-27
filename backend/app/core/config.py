from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "NATIONAL ENTERPRISES"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "national-enterprises-secret-change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12
    BACKEND_CORS_ORIGINS: list[str] = ["*"]
    DATABASE_URL: str = "sqlite:///./national.db"

settings = Settings()
