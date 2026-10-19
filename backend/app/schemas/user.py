from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from models.enums import Priority_Level

class UserBase(BaseModel):
    username: str
    email: str
    full_name: Optional[str] = None
    priority_lvl: Optional[Priority_Level] = None

class UserCreate(UserBase):
    password: str

# Read model deliberately omits `password` so it is never returned in a response.
class User(UserBase):
    id: int
    priority_lvl: Priority_Level
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
