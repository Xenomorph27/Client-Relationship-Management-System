from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from crud import crud_order
from database.database import get_db
from models.enums import Delivery_Status, Order_Kind, Source
from schemas.order import Order, OrderUpdate, ReturnCreate

# A separate prefix rather than POST /orders/returns. Under /orders it would
# sit beside GET /orders/{order_id}, and "returns" would be tried as an
# integer id - a 422 that reads like a validation bug in the client.
router = APIRouter(prefix="/returns", tags=["returns"])


@router.post("/", status_code=201)
def record_return(payload: ReturnCreate, db: Session = Depends(get_db)):
    """
    Record a return and reverse the stock effect according to its type:

        refund             -> back into inventory
        exchange           -> back in, replacement out
        exchange_modified  -> NOT back into stock; raises a rework task

    Returns the created row plus whether anything was restocked and the id of
    any rework task, because the UI reports all three.
    """
    result = crud_order.record_return(db, payload)
    if result.get("error") == "original_not_found":
        raise HTTPException(
            status_code=404, detail="The order this return refers to does not exist"
        )
    return {
        "order": Order.model_validate(result["order"]),
        "restocked": result["restocked"],
        "rework_task_id": result["rework_task_id"],
    }


@router.get("/", response_model=List[Order])
def list_returns(
    skip: int = 0,
    limit: int = 100,
    delivery_status: Optional[Delivery_Status] = None,
    source: Optional[Source] = None,
    db: Session = Depends(get_db),
):
    """Same table as /orders, with kind pinned to return."""
    return crud_order.get_all_orders(
        db,
        skip=skip,
        limit=limit,
        kind=Order_Kind.returned.value,
        delivery_status=delivery_status.value if delivery_status else None,
        source=source.value if source else None,
    )


@router.get("/{order_id}", response_model=Order)
def read_return(order_id: int, db: Session = Depends(get_db)):
    order = crud_order.get_order(db, order_id)
    if order is None or order.kind != Order_Kind.returned:
        raise HTTPException(status_code=404, detail="Return not found")
    return order


@router.patch("/{order_id}", response_model=Order)
def patch_return(order_id: int, payload: OrderUpdate, db: Session = Depends(get_db)):
    existing = crud_order.get_order(db, order_id)
    if existing is None or existing.kind != Order_Kind.returned:
        raise HTTPException(status_code=404, detail="Return not found")
    return crud_order.update_order(db, order_id, payload)


@router.delete("/{order_id}", status_code=204)
def remove_return(order_id: int, db: Session = Depends(get_db)):
    existing = crud_order.get_order(db, order_id)
    if existing is None or existing.kind != Order_Kind.returned:
        raise HTTPException(status_code=404, detail="Return not found")
    crud_order.delete_order(db, order_id)
    return None
