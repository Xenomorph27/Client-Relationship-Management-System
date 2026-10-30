from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from database.database import get_db
from models.web_orders import WebOrder as WebOrderModel
from schemas.web_order import WebOrder

router = APIRouter(prefix="/web-orders", tags=["web orders"])


@router.get("/", response_model=List[WebOrder])
def list_web_orders(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Shop orders, newest first, each with its pieces. Read-only: the shop owns
    these rows, and the sync overwrites them from the shop on every change."""
    query = db.query(WebOrderModel).options(selectinload(WebOrderModel.pieces))
    if status:
        query = query.filter(WebOrderModel.status == status)
    if customer_id is not None:
        query = query.filter(WebOrderModel.customer_id == customer_id)
    return query.order_by(WebOrderModel.id.desc()).offset(skip).limit(limit).all()


@router.get("/{web_order_id}", response_model=WebOrder)
def read_web_order(web_order_id: int, db: Session = Depends(get_db)):
    row = (
        db.query(WebOrderModel)
        .options(selectinload(WebOrderModel.pieces))
        .filter(WebOrderModel.id == web_order_id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Shop order not found")
    return row
