from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from crud import crud_order
from database.database import get_db
from models.enums import Delivery_Status, Order_Kind, Source
from schemas.order import Order, OrderCreate, OrderPlacement, OrderUpdate

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("/", response_model=OrderPlacement, status_code=201)
def place_order(payload: OrderCreate, db: Session = Depends(get_db)):
    """
    Place a delivery order. Runs the stock rule.

    Returns 201 with the order AND what the stock rule did, never an error for
    being out of stock: the order is accepted either way. A 4xx here would tell
    the shop to turn away business it wants.
    """
    return crud_order.place_order(db, payload)


@router.get("/", response_model=List[Order])
def list_orders(
    skip: int = 0,
    limit: int = 100,
    kind: Optional[Order_Kind] = None,
    delivery_status: Optional[Delivery_Status] = None,
    source: Optional[Source] = None,
    db: Session = Depends(get_db),
):
    """
    The one query behind the Orders ledger, the Returns ledger and the
    Logistics board - the same rows, filtered differently.

    The enum types on these parameters mean a bad value is rejected with a 422
    naming the legal options, instead of silently matching nothing and looking
    like an empty table.
    """
    return crud_order.get_all_orders(
        db,
        skip=skip,
        limit=limit,
        kind=kind.value if kind else None,
        delivery_status=delivery_status.value if delivery_status else None,
        source=source.value if source else None,
    )


@router.get("/{order_id}", response_model=Order)
def read_order(order_id: int, db: Session = Depends(get_db)):
    order = crud_order.get_order(db, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.patch("/{order_id}", response_model=Order)
def patch_order(order_id: int, payload: OrderUpdate, db: Session = Depends(get_db)):
    """
    Used by the Logistics board when a card is dragged between columns.
    Moving to Delivered stamps delivered_at; moving away clears it.
    """
    order = crud_order.update_order(db, order_id, payload)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.delete("/{order_id}", status_code=204)
def remove_order(order_id: int, db: Session = Depends(get_db)):
    if not crud_order.delete_order(db, order_id):
        raise HTTPException(status_code=404, detail="Order not found")
    return None
