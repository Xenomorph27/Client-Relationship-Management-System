from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from crud import crud_cart
from database.database import get_db
from schemas.cart import Cart, CartCreate, CartUpdate

router = APIRouter(prefix="/carts", tags=["carts"])


@router.post("/", response_model=Cart, status_code=201)
def create_cart(payload: CartCreate, db: Session = Depends(get_db)):
    """
    Open for the storefront to POST to later. Nothing is wired to a real shop
    front yet, so today this is how cart data gets in.
    """
    return crud_cart.create_cart(db, payload)


@router.get("/", response_model=List[Cart])
def list_carts(
    skip: int = 0,
    limit: int = 100,
    min_items: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """min_items=2 is what the Prospects column on Insights asks for."""
    return crud_cart.get_all_carts(db, skip=skip, limit=limit, min_items=min_items)


@router.get("/{cart_id}", response_model=Cart)
def read_cart(cart_id: int, db: Session = Depends(get_db)):
    cart = crud_cart.get_cart(db, cart_id)
    if cart is None:
        raise HTTPException(status_code=404, detail="Cart not found")
    return cart


@router.patch("/{cart_id}", response_model=Cart)
def patch_cart(cart_id: int, payload: CartUpdate, db: Session = Depends(get_db)):
    cart = crud_cart.update_cart(db, cart_id, payload)
    if cart is None:
        raise HTTPException(status_code=404, detail="Cart not found")
    return cart


@router.delete("/{cart_id}", status_code=204)
def remove_cart(cart_id: int, db: Session = Depends(get_db)):
    if not crud_cart.delete_cart(db, cart_id):
        raise HTTPException(status_code=404, detail="Cart not found")
    return None
