import os
from typing import Optional
from pydantic_settings import BaseSettings

DOTENV=os.path.join(os.path.dirname(__file__), ".env")
class Settings(BaseSettings):
    sendgrid_api_key: Optional[str] = None
    database_url: Optional[str] = None
    # Comma-separated list of browser origins allowed to call this API.
    # Read as a plain string rather than a List[str], because
    # pydantic-settings parses a list-typed field as JSON and a bare
    # "http://localhost:5173" in .env then fails to start the app.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    
    class Config:
        env_file = DOTENV  

settings = Settings()