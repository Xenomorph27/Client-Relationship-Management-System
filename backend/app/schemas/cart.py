from typing import Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel
from models.enums import Source


class CartBase(BaseModel):
    customer_id: Optional[int] = None
    item_count: int = 0
    value: Decimal = Decimal("0")
    source: Source = Source.website


class CartCreate(CartBase):
    pass


class CartUpdate(BaseModel):
    customer_id: Optional[int] = None
    item_count: Optional[int] = None
    value: Optional[Decimal] = None
    source: Optional[Source] = None


class Cart(CartBase):
    id: int
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
