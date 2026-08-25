import os
from typing import Optional
from pydantic_settings import BaseSettings

DOTENV=os.path.join(os.path.dirname(__file__), ".env")
class Settings(BaseSettings):
    sendgrid_api_key: Optional[str] = None
    database_url: Optional[str] = None 
    
    class Config:
        env_file = DOTENV  

settings = Settings()