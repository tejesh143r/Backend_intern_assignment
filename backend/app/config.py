import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Secure Role-Based API"
    API_V1_STR: str = "/api/v1"
    
    # JWT Settings
    # In production, these should be set via environment variables
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "super_secret_key_change_me_in_production_1234567890!")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    # Database Settings
    # Using SQLite locally for frictionless setup. Can easily switch to PostgreSQL by changing this URI.
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./sql_app.db")
    
    class Config:
        case_sensitive = True

settings = Settings()
