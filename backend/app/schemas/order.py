from typing import Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, computed_field
from models.enums import (
    Delivery_Status,
    Order_Kind,
    Priority_Level,
    Return_Type,
    Source,
    Stock_Status,
)


class OrderBase(BaseModel):
    name: str
    price: Decimal = Decimal("0")
    deposit_paid: Decimal = Decimal("0")
    image: Optional[str] = None
    delivery_status: Delivery_Status = Delivery_Status.processing
    source: Source = Source.direct
    priority_lvl: Optional[Priority_Level] = None
    delivery_due: Optional[datetime] = None
    inventory_id: Optional[int] = None
    customer_id: Optional[int] = None
    owner_id: Optional[int] = None


class OrderCreate(OrderBase):
    """
    Placing a DELIVERY order. Posting this runs the stock rule.

    order_ref is deliberately absent: the server allocates it, because two
    browsers both guessing "WC-1043" would collide on the unique index. Same
    for stock_status - it is the OUTCOME of the stock rule, not an input, and
    letting a client assert "fulfilled" would let it claim stock it never took.
    """

    order_ref: Optional[str] = None


class ReturnCreate(BaseModel):
    """
    Recording a RETURN. Separate from OrderCreate because the required fields
    genuinely differ: a return must say what kind it is, and it points back at
    the order it reverses.
    """

    returns_order_id: Optional[int] = None
    return_type: Return_Type
    remarks: Optional[str] = None
    # All optional: when returns_order_id is given, the server copies the
    # original order's name, price, image, customer and item rather than
    # trusting a client to restate them consistently.
    name: Optional[str] = None
    price: Optional[Decimal] = None
    image: Optional[str] = None
    source: Optional[Source] = None
    inventory_id: Optional[int] = None
    customer_id: Optional[int] = None
    owner_id: Optional[int] = None
    priority_lvl: Optional[Priority_Level] = None


class OrderUpdate(BaseModel):
    """
    Partial update. Setting delivery_status to "delivered" also stamps
    delivered_at server-side, and moving it back off "delivered" clears it -
    see crud_order.update_order. A client cannot set delivered_at directly,
    because a cycle time the client chose is not a measurement.
    """

    name: Optional[str] = None
    price: Optional[Decimal] = None
    deposit_paid: Optional[Decimal] = None
    image: Optional[str] = None
    delivery_status: Optional[Delivery_Status] = None
    source: Optional[Source] = None
    priority_lvl: Optional[Priority_Level] = None
    delivery_due: Optional[datetime] = None
    inventory_id: Optional[int] = None
    customer_id: Optional[int] = None
    owner_id: Optional[int] = None
    return_type: Optional[Return_Type] = None
    remarks: Optional[str] = None


class Order(OrderBase):
    id: int
    order_ref: str
    kind: Order_Kind
    stock_status: Stock_Status
    priority_lvl: Priority_Level
    ordered_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    return_type: Optional[Return_Type] = None
    remarks: Optional[str] = None
    returns_order_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @computed_field
    @property
    def balance(self) -> Decimal:
        """
        Derived, never stored. A balance column would be a second version of
        the truth, free to disagree with price and deposit_paid.
        """
        return (self.price or Decimal("0")) - (self.deposit_paid or Decimal("0"))

    class Config:
        from_attributes = True


class OrderPlacement(BaseModel):
    """
    The result of placing an order: the order itself, plus what the stock rule
    did. The frontend needs both - it badges the order AND tells the user a
    making task was raised.
    """

    order: Order
    stock_status: Stock_Status
    shortfall: bool
    task_id: Optional[int] = None
    message: Optional[str] = None
