from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from models.enums import Priority_Level

class CustomerBase(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    priority_lvl: Optional[Priority_Level] = None

class CustomerCreate(CustomerBase):
    pass

class Customer(CustomerBase):
    id: int
    priority_lvl: Priority_Level
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
