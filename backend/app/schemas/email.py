from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from models.enums import Priority_Level

class EmailBase(BaseModel):
    subject: Optional[str] = None
    body: Optional[str] = None
    sender: str
    recipient: str
    lead_id: Optional[int] = None
    customer_id: Optional[int] = None
    priority_lvl: Optional[Priority_Level] = None

class EmailCreate(EmailBase):
    pass


class EmailUpdate(BaseModel):
    subject: Optional[str] = None
    body: Optional[str] = None
    recipient: Optional[str] = None
    is_opened: Optional[bool] = None
    lead_id: Optional[int] = None
    customer_id: Optional[int] = None
    priority_lvl: Optional[Priority_Level] = None

class Email(EmailBase):
    id: int
    priority_lvl: Priority_Level
    sendgrid_email_id: Optional[str] = None
    sent_at: Optional[datetime] = None
    is_opened: Optional[bool] = None

    class Config:
        from_attributes = True
