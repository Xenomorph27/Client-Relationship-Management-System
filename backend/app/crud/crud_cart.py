from typing import Optional
from sqlalchemy.orm import Session
from models.carts import Cart
from schemas.cart import CartCreate, CartUpdate


def create_cart(db: Session, payload: CartCreate) -> Cart:
    cart = Cart(**payload.model_dump())
    db.add(cart)
    db.commit()
    db.refresh(cart)
    return cart


def get_cart(db: Session, cart_id: int) -> Optional[Cart]:
    return db.query(Cart).filter(Cart.id == cart_id).first()


def get_all_carts(
    db: Session, skip: int = 0, limit: int = 100, min_items: Optional[int] = None
):
    """
    min_items backs the Prospects column on Insights, which shows baskets with
    two or more items in them. Filtered in SQL so the count in the column
    header is the real total, not the size of whatever page was fetched.
    """
    query = db.query(Cart)
    if min_items is not None:
        query = query.filter(Cart.item_count >= min_items)
    return query.order_by(Cart.id).offset(skip).limit(limit).all()


def update_cart(db: Session, cart_id: int, payload: CartUpdate) -> Optional[Cart]:
    cart = get_cart(db, cart_id)
    if cart is None:
        return None
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(cart, field, value)
    db.commit()
    db.refresh(cart)
    return cart


def delete_cart(db: Session, cart_id: int) -> bool:
    cart = get_cart(db, cart_id)
    if cart is None:
        return False
    db.delete(cart)
    db.commit()
    return True
