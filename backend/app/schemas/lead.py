from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from models.enums import Priority_Level

class LeadBase(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    organisation_id: Optional[int] = None
    priority_lvl: Optional[Priority_Level] = None

class LeadCreate(LeadBase):
    pass

class Lead(LeadBase):
    id: int
    priority_lvl: Priority_Level
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
