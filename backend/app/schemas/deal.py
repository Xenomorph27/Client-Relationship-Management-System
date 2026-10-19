from typing import Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel
from models.enums import Priority_Level

class DealBase(BaseModel):
    name: str
    amount: Optional[Decimal] = None
    stage: Optional[str] = None
    expiry_date: Optional[datetime] = None
    lead_id: Optional[int] = None
    customer_id: Optional[int] = None
    priority_lvl: Optional[Priority_Level] = None

class DealCreate(DealBase):
    pass

class Deal(DealBase):
    id: int
    priority_lvl: Priority_Level
    initiated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
