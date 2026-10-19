from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from models.enums import Priority_Level

class OrganisationBase(BaseModel):
    name: str
    website: Optional[str] = None
    industry: Optional[str] = None
    official_email: Optional[str] = None
    support_contact: Optional[str] = None
    priority_lvl: Optional[Priority_Level] = None

class OrganisationCreate(OrganisationBase):
    pass


class OrganisationUpdate(BaseModel):
    name: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None
    official_email: Optional[str] = None
    support_contact: Optional[str] = None
    priority_lvl: Optional[Priority_Level] = None

class Organisation(OrganisationBase):
    id: int
    priority_lvl: Priority_Level
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
