from typing import Optional
from sqlalchemy import update
from sqlalchemy.orm import Session
from models.inventory import InventoryItem
from schemas.inventory import InventoryItemCreate, InventoryItemUpdate


def create_item(db: Session, payload: InventoryItemCreate) -> InventoryItem:
    item = InventoryItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def get_item(db: Session, item_id: int) -> Optional[InventoryItem]:
    return db.query(InventoryItem).filter(InventoryItem.id == item_id).first()


def get_all_items(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    item_class: Optional[str] = None,
    low_stock: bool = False,
):
    query = db.query(InventoryItem)
    if item_class:
        query = query.filter(InventoryItem.item_class == item_class)
    if low_stock:
        # Compared column-to-column in SQL, not in Python, so paging and
        # counting stay correct. Filtering after the fact would make
        # "page 2 of low stock" mean page 2 of everything, then filtered.
        query = query.filter(InventoryItem.quantity <= InventoryItem.reorder_level)
    return query.order_by(InventoryItem.id).offset(skip).limit(limit).all()


def update_item(
    db: Session, item_id: int, payload: InventoryItemUpdate
) -> Optional[InventoryItem]:
    item = get_item(db, item_id)
    if item is None:
        return None
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


def delete_item(db: Session, item_id: int) -> bool:
    item = get_item(db, item_id)
    if item is None:
        return False
    db.delete(item)
    db.commit()
    return True


def adjust_stock(db: Session, item_id: int, delta: int, commit: bool = True) -> dict:
    """
    Move stock by `delta` and report what happened.

    THIS IS THE FUNCTION THE WHOLE STOCK RULE RESTS ON, and it is written as a
    single UPDATE with the guard in the WHERE clause:

        UPDATE inventory SET quantity = quantity - 1
         WHERE id = :id AND quantity >= 1

    The obvious version - read quantity, check it in Python, write it back -
    is a lost-update race. Two customers ordering the last chair at the same
    moment both read quantity = 1, both decide it is fine, and both write 0.
    One chair, two confirmed orders, stock that never went negative so nothing
    looks wrong. The database is the only place that check can be trusted,
    because only it can evaluate the guard and apply the change without
    anything slipping in between.

    rowcount is the answer: 1 means this caller got the stock, 0 means someone
    else did. No exception on shortfall - it RETURNS the failure, because the
    caller has to accept the order either way.

    `commit=False` lets place_order keep the decrement and the order insert in
    one transaction, so a crash between them cannot consume stock without
    producing an order.
    """
    if delta == 0:
        return {"ok": True, "reason": None, "taken": 0, "item": get_item(db, item_id)}

    stmt = update(InventoryItem).where(InventoryItem.id == item_id)
    if delta < 0:
        # Only guard removals. Putting stock back must always succeed.
        stmt = stmt.where(InventoryItem.quantity >= abs(delta))
    stmt = stmt.values(quantity=InventoryItem.quantity + delta)

    result = db.execute(stmt)

    if result.rowcount == 0:
        # Nothing to undo: an UPDATE that matched no rows changed nothing.
        # Rolling back here would be actively wrong - place_order calls this
        # with commit=False inside its own transaction, and a rollback would
        # throw away work the caller still intends to keep.
        #
        # Distinguish the two causes, because "no such item" and "out of
        # stock" are different problems for whoever reads the report.
        exists = get_item(db, item_id)
        return {
            "ok": False,
            "reason": "not_found" if exists is None else "insufficient_stock",
            "taken": 0,
            "item": exists,
        }

    if commit:
        db.commit()
    else:
        db.flush()

    item = get_item(db, item_id)
    return {"ok": True, "reason": None, "taken": abs(delta), "item": item}
