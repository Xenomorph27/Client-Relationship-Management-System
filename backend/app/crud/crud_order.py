from typing import Optional
from datetime import datetime
from sqlalchemy import func
from sqlalchemy.orm import Session

from crud import crud_inventory
from models.enums import (
    Delivery_Status,
    Order_Kind,
    Priority_Level,
    Return_Type,
    Stock_Status,
)
from models.inventory import InventoryItem
from models.orders import Order
from models.tasks import Task
from schemas.order import OrderCreate, OrderUpdate, ReturnCreate


# Returns that put the piece back on the shelf. exchange_modified does not:
# the item goes to the workshop to be altered, so it is not sellable stock.
# This mirrors RETURN_META in frontend/src/lib/domain.js.
RESTOCKING_RETURNS = {Return_Type.refund, Return_Type.exchange}

REF_PREFIX = "WC-"
REF_START = 1000


def next_order_ref(db: Session) -> str:
    """
    Allocate the next human-facing reference.

    Derived from the highest NUMBER already issued, not from MAX(id). Both an
    id-based and a COUNT-based scheme are wrong here:

      COUNT(*)  hands out the same number again after a delete.
      MAX(id)   ignores what the refs actually are. The seeded orders start at
                WC-1021 while ids start at 1, so MAX(id) would issue WC-1016
                today and then collide with the existing WC-1021 once ids
                reached 21 - a unique-constraint error weeks later, on a
                perfectly ordinary order.

    Returns are skipped by the isdigit() check: their refs look like WC-R108,
    so "R108" is not a number and cannot drag the counter around.

    Not safe against two simultaneous orders - both could read the same
    highest value. The unique index on order_ref is the backstop, so the
    outcome is a failed insert rather than two orders sharing a reference. A
    Postgres sequence would remove even that; noted in the backend contract.
    """
    highest = REF_START
    for (ref,) in db.query(Order.order_ref).filter(
        Order.order_ref.like(f"{REF_PREFIX}%")
    ):
        tail = ref[len(REF_PREFIX):]
        if tail.isdigit():
            highest = max(highest, int(tail))
    return f"{REF_PREFIX}{highest + 1}"


def get_order(db: Session, order_id: int) -> Optional[Order]:
    return db.query(Order).filter(Order.id == order_id).first()


def get_all_orders(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    kind: Optional[str] = None,
    delivery_status: Optional[str] = None,
    source: Optional[str] = None,
):
    """
    One query behind Orders, Returns and the Logistics board.

    They are the same rows filtered differently, which is why the board and
    the ledger cannot disagree: there is nothing to keep in step.
    """
    query = db.query(Order)
    if kind:
        query = query.filter(Order.kind == kind)
    if delivery_status:
        query = query.filter(Order.delivery_status == delivery_status)
    if source:
        query = query.filter(Order.source == source)
    return query.order_by(Order.id).offset(skip).limit(limit).all()


def place_order(db: Session, payload: OrderCreate) -> dict:
    """
    The stock rule, server-side and in ONE transaction.

        item ordered
          |- in inventory? -> take one, confirm        (fulfilled)
          |- otherwise     -> ACCEPT THE ORDER ANYWAY  (shortfall) + making task

    A shortfall is not a rejection. The business wants the order; it just has
    to make the piece first. So the order is always written, and the shortfall
    becomes someone's job through a task rather than an error the customer sees.

    Everything below happens in a single transaction with one commit at the
    end. That is the point: a crash midway cannot consume stock without
    producing an order, nor raise a making task for an order that was never
    written. The browser version of this could do neither.
    """
    data = payload.model_dump(exclude_unset=False)
    data.pop("order_ref", None)

    item: Optional[InventoryItem] = None
    if data.get("inventory_id") is not None:
        item = crud_inventory.get_item(db, data["inventory_id"])

    stock_status = Stock_Status.fulfilled
    shortfall_reason = None

    if data.get("inventory_id") is not None:
        # commit=False: this decrement belongs to the same transaction as the
        # order insert below.
        result = crud_inventory.adjust_stock(
            db, data["inventory_id"], -1, commit=False
        )
        if not result["ok"]:
            stock_status = Stock_Status.shortfall
            shortfall_reason = result["reason"]

    # Fall back to the catalogue photo, but only if the caller did not supply
    # one. Copied onto the order so the picture of what was sold does not
    # change later when the catalogue image is replaced.
    if not data.get("image") and item is not None:
        data["image"] = item.image

    if data.get("priority_lvl") is None:
        data["priority_lvl"] = Priority_Level.low_priority

    order = Order(
        **data,
        order_ref=payload.order_ref or next_order_ref(db),
        kind=Order_Kind.delivery,
        stock_status=stock_status,
    )
    if order.delivery_status == Delivery_Status.delivered and order.delivered_at is None:
        order.delivered_at = datetime.now()

    db.add(order)
    db.flush()  # assigns order.id without ending the transaction

    task_id = None
    message = None
    if stock_status == Stock_Status.shortfall:
        label = item.name if item is not None else order.name
        if shortfall_reason == "not_found":
            title = f"Make {label} - item not in inventory"
            message = "Order accepted. The item is not in inventory at all, so it has been flagged."
        else:
            title = f"Make {label} - not in stock"
            message = "Order accepted. The item is out of stock, so a making task was raised."
        task = Task(
            title=title,
            notes=f"Raised automatically for order {order.order_ref}.",
            priority_lvl=Priority_Level.high_priority,
            order_id=order.id,
            assignee_id=order.owner_id,
            due_date=order.delivery_due,
        )
        db.add(task)
        db.flush()
        task_id = task.id

    db.commit()
    db.refresh(order)

    return {
        "order": order,
        "stock_status": stock_status,
        "shortfall": stock_status == Stock_Status.shortfall,
        "task_id": task_id,
        "message": message,
    }


def record_return(db: Session, payload: ReturnCreate) -> dict:
    """
    Record a return and reverse the stock effect - but not uniformly.

        refund             -> item goes back into inventory
        exchange           -> returned item back in, replacement taken out
        exchange_modified  -> does NOT go back into stock; a rework task is
                              raised instead, because the piece is going to
                              the workshop, not the shelf

    Treating all three the same is the obvious bug here: counting a modified
    exchange as sellable stock would promise a customer a piece that is in
    pieces on a bench.
    """
    data = payload.model_dump(exclude_unset=True)
    original = None
    if payload.returns_order_id is not None:
        original = get_order(db, payload.returns_order_id)
        if original is None:
            return {"error": "original_not_found"}
        # Copy from the original rather than trusting the client to restate
        # it. A return whose price disagrees with what was sold is unusable
        # for revenue reporting.
        for field in ("name", "price", "image", "inventory_id", "customer_id", "owner_id"):
            if data.get(field) is None:
                data[field] = getattr(original, field)
        if data.get("source") is None:
            data["source"] = original.source

    return_type = payload.return_type
    inventory_id = data.get("inventory_id")

    restocked = 0
    rework_task_id = None

    if inventory_id is not None and return_type in RESTOCKING_RETURNS:
        back = crud_inventory.adjust_stock(db, inventory_id, +1, commit=False)
        if back["ok"]:
            restocked = 1
        if return_type == Return_Type.exchange:
            # The replacement leaves stock. If there is none, that is itself a
            # shortfall - the exchange is still accepted and flagged.
            crud_inventory.adjust_stock(db, inventory_id, -1, commit=False)

    order = Order(
        name=data.get("name") or "Return",
        price=data.get("price") or 0,
        deposit_paid=0,
        image=data.get("image"),
        kind=Order_Kind.returned,
        delivery_status=Delivery_Status.processing,
        source=data.get("source") or (original.source if original else None) or "direct",
        stock_status=Stock_Status.fulfilled,
        priority_lvl=data.get("priority_lvl") or Priority_Level.medium_priority,
        inventory_id=inventory_id,
        customer_id=data.get("customer_id"),
        owner_id=data.get("owner_id"),
        return_type=return_type,
        remarks=data.get("remarks"),
        returns_order_id=payload.returns_order_id,
        order_ref=next_order_ref(db),
    )
    db.add(order)
    db.flush()

    if return_type == Return_Type.exchange_modified:
        task = Task(
            title=f"Modify {order.name} - exchange with modification",
            notes=payload.remarks or "No modification notes supplied.",
            priority_lvl=Priority_Level.high_priority,
            order_id=order.id,
            assignee_id=order.owner_id,
        )
        db.add(task)
        db.flush()
        rework_task_id = task.id

    db.commit()
    db.refresh(order)

    return {
        "order": order,
        "restocked": restocked,
        "rework_task_id": rework_task_id,
    }


def update_order(db: Session, order_id: int, payload: OrderUpdate) -> Optional[Order]:
    """
    Partial update, with one piece of bookkeeping the client cannot do.

    delivered_at is stamped when delivery_status becomes "delivered" and
    CLEARED when it moves back off it. Without the clearing half, dragging a
    card to Delivered and then back leaves a delivery date on an undelivered
    order, and every lead-time average silently includes it.
    """
    order = get_order(db, order_id)
    if order is None:
        return None

    fields = payload.model_dump(exclude_unset=True)
    new_status = fields.get("delivery_status")

    for field, value in fields.items():
        setattr(order, field, value)

    if new_status is not None:
        if new_status == Delivery_Status.delivered:
            if order.delivered_at is None:
                order.delivered_at = datetime.now()
        else:
            order.delivered_at = None

    db.commit()
    db.refresh(order)
    return order


def delete_order(db: Session, order_id: int) -> bool:
    order = get_order(db, order_id)
    if order is None:
        return False
    db.delete(order)
    db.commit()
    return True
