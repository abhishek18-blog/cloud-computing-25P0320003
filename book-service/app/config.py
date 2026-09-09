import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PORT: int = int(os.getenv("PORT", "8001"))
    APP_ENV: str = os.getenv("APP_ENV", "development")
    
    DB_HOST: str = os.getenv("DB_HOST", "postgres-db")
    DB_PORT: int = int(os.getenv("DB_PORT", "5432"))
    DB_NAME: str = os.getenv("DB_NAME", "library_books_db")
    DB_USER: str = os.getenv("DB_USER", "libuser")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "libpass_secure_123")
    
    @property
    def database_url(self) -> str:
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
