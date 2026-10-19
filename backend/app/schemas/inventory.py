from typing import Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel
from models.enums import Item_Class, Unit


class InventoryItemBase(BaseModel):
    sku: str
    name: str
    item_class: Item_Class = Item_Class.product
    category: Optional[str] = None
    wood_type: Optional[str] = None
    unit: Unit = Unit.piece
    quantity: int = 0
    reorder_level: int = 0
    unit_price: Optional[Decimal] = None
    image: Optional[str] = None


class InventoryItemCreate(InventoryItemBase):
    pass


class InventoryItemUpdate(BaseModel):
    """
    Every field optional, so a PATCH can send only what changed.

    quantity is settable here for stock-taking corrections, but ordinary
    order traffic must NOT come through this route - it would read the current
    value, add, and write back, which is the lost-update race the stock rule
    exists to avoid. Use the adjust endpoint for relative changes.
    """

    sku: Optional[str] = None
    name: Optional[str] = None
    item_class: Optional[Item_Class] = None
    category: Optional[str] = None
    wood_type: Optional[str] = None
    unit: Optional[Unit] = None
    quantity: Optional[int] = None
    reorder_level: Optional[int] = None
    unit_price: Optional[Decimal] = None
    image: Optional[str] = None


class InventoryItem(InventoryItemBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class StockAdjustResult(BaseModel):
    """
    What the adjust endpoint reports back.

    It REPORTS a shortfall rather than raising one, because the caller - the
    stock rule - has to carry on and accept the order either way. An exception
    here would abort an order the business actually wants to take.
    """

    ok: bool
    reason: Optional[str] = None
    taken: int = 0
    item: Optional[InventoryItem] = None
