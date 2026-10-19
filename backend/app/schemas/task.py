from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from models.enums import Priority_Level


class TaskBase(BaseModel):
    title: str
    notes: Optional[str] = None
    due_date: Optional[datetime] = None
    is_done: bool = False
    priority_lvl: Optional[Priority_Level] = None
    assignee_id: Optional[int] = None
    lead_id: Optional[int] = None
    order_id: Optional[int] = None
    customer_id: Optional[int] = None
    organisation_id: Optional[int] = None
    campaign_id: Optional[int] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    """
    completed_at is absent on purpose: it is stamped by the server when
    is_done flips to true and cleared when it flips back, so "when was this
    finished" is a record of what happened rather than a client's claim.
    """

    title: Optional[str] = None
    notes: Optional[str] = None
    due_date: Optional[datetime] = None
    is_done: Optional[bool] = None
    priority_lvl: Optional[Priority_Level] = None
    assignee_id: Optional[int] = None
    lead_id: Optional[int] = None
    order_id: Optional[int] = None
    customer_id: Optional[int] = None
    organisation_id: Optional[int] = None
    campaign_id: Optional[int] = None


class Task(TaskBase):
    id: int
    priority_lvl: Priority_Level
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
