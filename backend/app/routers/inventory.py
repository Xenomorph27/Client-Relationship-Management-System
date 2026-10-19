from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from crud import crud_inventory
from database.database import get_db
from models.enums import Item_Class
from schemas.inventory import (
    InventoryItem,
    InventoryItemCreate,
    InventoryItemUpdate,
    StockAdjustResult,
)

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.post("/", response_model=InventoryItem, status_code=201)
def create_item(payload: InventoryItemCreate, db: Session = Depends(get_db)):
    return crud_inventory.create_item(db, payload)


@router.get("/", response_model=List[InventoryItem])
def list_items(
    skip: int = 0,
    limit: int = 100,
    item_class: Optional[Item_Class] = None,
    low_stock: bool = False,
    db: Session = Depends(get_db),
):
    """low_stock=true backs the "Needs making" list: quantity at or below the
    item's own reorder level, compared in SQL rather than per row."""
    return crud_inventory.get_all_items(
        db,
        skip=skip,
        limit=limit,
        item_class=item_class.value if item_class else None,
        low_stock=low_stock,
    )


@router.get("/{item_id}", response_model=InventoryItem)
def read_item(item_id: int, db: Session = Depends(get_db)):
    item = crud_inventory.get_item(db, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return item


@router.patch("/{item_id}", response_model=InventoryItem)
def patch_item(
    item_id: int, payload: InventoryItemUpdate, db: Session = Depends(get_db)
):
    item = crud_inventory.update_item(db, item_id, payload)
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return item


@router.delete("/{item_id}", status_code=204)
def remove_item(item_id: int, db: Session = Depends(get_db)):
    if not crud_inventory.delete_item(db, item_id):
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return None


@router.post("/{item_id}/adjust", response_model=StockAdjustResult)
def adjust_stock(item_id: int, delta: int, db: Session = Depends(get_db)):
    """
    Move stock by a RELATIVE amount: /inventory/3/adjust?delta=-1.

    Relative, not absolute, on purpose. PATCH with quantity=4 means "I believe
    it is 5, make it 4", which quietly overwrites whatever happened in between.
    delta=-1 means "take one", which is true whoever else is also taking one.

    Reports a shortfall as ok=false with a reason rather than raising, because
    the caller normally has to carry on regardless.
    """
    result = crud_inventory.adjust_stock(db, item_id, delta)
    if result["reason"] == "not_found":
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return result
