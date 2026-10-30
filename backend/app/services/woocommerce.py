"""
The online shop (WooCommerce) -> CRM bridge.

Everything that turns a WooCommerce payload into CRM rows lives here, so the
webhook endpoint and the catch-up sync share ONE set of rules and cannot
disagree about what an order means.

How a shop order maps onto the CRM
----------------------------------
The CRM's Order is ONE PIECE: one row, one price, one inventory item, one
stock decrement. A shop order can hold several items and quantities, so it is
expanded: an order for 2 honey dippers and 1 bowl becomes three CRM orders,

    WEB-1057-1   Hand-Turned Honey Dipper
    WEB-1057-2   Hand-Turned Honey Dipper
    WEB-1057-3   Walnut Salad Bowl

each placed through crud_order.place_order, so the stock rule (take one, or
accept and raise a "Make X" task) runs exactly as it does for an order typed
into the CRM. The "WEB-" prefix keeps shop references apart from the CRM's own
"WC-" sequence, and makes every write idempotent: if WEB-1057-1 exists, order
1057 has already been taken in.

Which shop statuses do what
---------------------------
    pending                    nothing yet (customer has not paid)
    on-hold                    taken in, deposit 0 (e.g. awaiting bank transfer)
    processing / completed     taken in, marked paid
    completed (again later)    pieces still "processing" move to "dispatched"
    cancelled / refunded /     each piece is reversed as a refund return,
    failed                     which puts the stock back

Stock ownership
---------------
The CRM owns stock quantities: the workshop also sells at markets, which the
shop never sees. So product updates from the shop refresh name, price,
category and photo, but only set quantity when an item is first created.
"""

import base64
import hashlib
import hmac
import html
import logging
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional

import httpx
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from crud import crud_order
from database.database import engine
from models.customer import Customer
from models.enums import Delivery_Status, Order_Kind, Priority_Level, Return_Type, Source
from models.integration_state import IntegrationState
from models.inventory import InventoryItem
from models.lead import Lead
from models.orders import Order
from models.tasks import Task
from schemas.order import OrderCreate, OrderUpdate, ReturnCreate
from settings import settings

log = logging.getLogger("woocommerce")

WEB_PREFIX = "WEB-"
TAKE_IN = {"on-hold", "processing", "completed"}
PAID = {"processing", "completed"}
REVERSE = {"cancelled", "refunded", "failed"}
CENT = Decimal("0.01")
# How far back each catch-up run re-checks. Re-reading is harmless because
# every write is idempotent, and a wide window means one failed webhook or a
# night of downtime is repaired automatically on the next run.
CATCH_UP_WINDOW = timedelta(days=3)


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------


def verify_signature(raw_body: bytes, signature: Optional[str], secret: str) -> bool:
    """WooCommerce signs the raw body: base64(HMAC-SHA256(secret, body))."""
    if not signature or not secret:
        return False
    expected = base64.b64encode(
        hmac.new(secret.encode(), raw_body, hashlib.sha256).digest()
    ).decode()
    return hmac.compare_digest(expected, signature.strip())


def _clean(value) -> str:
    """WooCommerce sends names HTML-escaped ("Kitchen &amp; Table")."""
    return html.unescape(str(value or "")).strip()


def _money(value) -> Decimal:
    try:
        return Decimal(str(value or "0")).quantize(CENT, rounding=ROUND_HALF_UP)
    except Exception:
        return Decimal("0.00")


def _ref(order_number: str, n: int) -> str:
    return f"{WEB_PREFIX}{order_number}-{n}"


def _order_number(payload: dict) -> str:
    return str(payload.get("number") or payload.get("id"))


def _lock_key(name: str) -> int:
    """Stable 64-bit key for a Postgres advisory lock."""
    return int.from_bytes(hashlib.sha1(name.encode()).digest()[:8], "big", signed=True)


def _set_state(db: Session, key: str, value: str) -> None:
    row = db.get(IntegrationState, key)
    if row is None:
        db.add(IntegrationState(key=key, value=value))
    else:
        row.value = value
        row.updated_at = datetime.now()
    db.commit()


def get_state(db: Session, key: str) -> Optional[str]:
    row = db.get(IntegrationState, key)
    return row.value if row else None


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------


def upsert_customer(
    db: Session, email: Optional[str], first: str = "", last: str = "", phone: Optional[str] = None
) -> Optional[Customer]:
    """Match on email (case-insensitive); create if new. Never overwrites a name staff edited."""
    email = (email or "").strip().lower() or None
    name = " ".join(p for p in (_clean(first), _clean(last)) if p) or email
    if not name:
        return None
    phone = (phone or "").strip() or None

    customer = None
    if email:
        customer = db.query(Customer).filter(func.lower(Customer.email) == email).first()
    if customer is None:
        customer = Customer(name=name, email=email, phone=phone, source=Source.website)
        db.add(customer)
        db.flush()
        return customer

    if not customer.phone and phone:
        customer.phone = phone
    if customer.source is None:
        customer.source = Source.website
    db.flush()
    return customer


def customer_from_order(db: Session, payload: dict) -> Optional[Customer]:
    billing = payload.get("billing") or {}
    return upsert_customer(
        db,
        billing.get("email"),
        billing.get("first_name", ""),
        billing.get("last_name", ""),
        billing.get("phone"),
    )


def customer_from_webhook(db: Session, payload: dict) -> Optional[Customer]:
    billing = payload.get("billing") or {}
    customer = upsert_customer(
        db,
        payload.get("email") or billing.get("email"),
        payload.get("first_name") or billing.get("first_name", ""),
        payload.get("last_name") or billing.get("last_name", ""),
        billing.get("phone"),
    )
    db.commit()
    return customer


# ---------------------------------------------------------------------------
# Inventory (shop products)
# ---------------------------------------------------------------------------


def _sku_for(product_id, sku: Optional[str]) -> str:
    sku = (sku or "").strip()
    return sku or f"WOO-{product_id}"


def find_item(db: Session, sku: Optional[str], product_id=None, name: Optional[str] = None) -> Optional[InventoryItem]:
    if sku:
        item = db.query(InventoryItem).filter(InventoryItem.sku == sku.strip()).first()
        if item:
            return item
    if product_id:
        item = db.query(InventoryItem).filter(InventoryItem.sku == f"WOO-{product_id}").first()
        if item:
            return item
    if name:
        return (
            db.query(InventoryItem)
            .filter(func.lower(InventoryItem.name) == _clean(name).lower())
            .first()
        )
    return None


def upsert_product(db: Session, product: dict, commit: bool = True) -> InventoryItem:
    sku = _sku_for(product.get("id"), product.get("sku"))
    name = _clean(product.get("name")) or sku
    categories = product.get("categories") or []
    category = _clean(categories[0].get("name"))[:64] if categories else None
    images = product.get("images") or []
    image = images[0].get("src") if images else None
    price = _money(product.get("price") or product.get("regular_price"))

    item = find_item(db, sku, product.get("id"), name)
    if item is None:
        quantity = product.get("stock_quantity") if product.get("manage_stock") else 0
        item = InventoryItem(
            sku=sku,
            name=name,
            category=category,
            unit_price=price,
            image=image,
            quantity=max(int(quantity or 0), 0),
            reorder_level=0,
        )
        db.add(item)
    else:
        # Refresh what the shop owns. Quantity is deliberately left alone.
        item.sku = sku
        item.name = name
        item.category = category or item.category
        item.unit_price = price
        item.image = image or item.image
    if commit:
        db.commit()
        db.refresh(item)
    else:
        db.flush()
    return item


def item_for_line(db: Session, line: dict) -> InventoryItem:
    """The inventory row for an order line, created on the spot if the shop sold
    something the CRM has never heard of (it is created with quantity 0, so the
    stock rule then raises a making task, which is the honest outcome)."""
    item = find_item(db, line.get("sku"), line.get("product_id"), line.get("name"))
    if item is not None:
        return item
    image = (line.get("image") or {}).get("src")
    return upsert_product(
        db,
        {
            "id": line.get("product_id"),
            "sku": line.get("sku"),
            "name": line.get("name"),
            "price": line.get("price"),
            "images": [{"src": image}] if image else [],
            "manage_stock": False,
        },
    )


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------


def _unit_prices(line: dict, quantity: int) -> list:
    """Split the line's total (after discounts, including tax) across its units,
    putting any rounding penny on the last one so the CRM total matches the shop."""
    total = _money(line.get("total")) + _money(line.get("total_tax"))
    if quantity <= 0:
        return []
    each = (total / quantity).quantize(CENT, rounding=ROUND_HALF_UP)
    prices = [each] * quantity
    prices[-1] = total - each * (quantity - 1)
    return prices


def _existing_rows(db: Session, number: str) -> list:
    return (
        db.query(Order)
        .filter(Order.order_ref.like(f"{WEB_PREFIX}{number}-%"))
        .filter(Order.kind == Order_Kind.delivery)
        .order_by(Order.id)
        .all()
    )


def sync_order(db: Session, payload: dict) -> dict:
    """Apply one shop order to the CRM. Safe to call any number of times."""
    number = _order_number(payload)
    status = (payload.get("status") or "").lower()

    # One shop order at a time: the "created" and "updated" webhooks for the
    # same order often arrive within the same second, and without this both
    # would see "not taken in yet" and insert twice. The lock lives on its own
    # connection so it survives the commits place_order makes per piece.
    with engine.connect() as lock_conn:
        key = _lock_key(f"woo-order-{number}")
        lock_conn.execute(text("SELECT pg_advisory_lock(:k)"), {"k": key})
        try:
            return _apply_order(db, payload, number, status)
        finally:
            lock_conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": key})
            lock_conn.commit()


def _apply_order(db: Session, payload: dict, number: str, status: str) -> dict:
    rows = _existing_rows(db, number)
    result = {"order": number, "status": status, "created": 0, "updated": 0, "reversed": 0, "shortfalls": 0}

    if not rows:
        if status not in TAKE_IN:
            result["skipped"] = "not paid or not taken in yet"
            return result
        customer = customer_from_order(db, payload)
        paid = status in PAID or bool(payload.get("date_paid") or payload.get("date_paid_gmt"))
        note = _clean(payload.get("customer_note")) or None
        n = 0
        for line in payload.get("line_items") or []:
            quantity = int(line.get("quantity") or 0)
            item = item_for_line(db, line)
            image = (line.get("image") or {}).get("src") or item.image
            for price in _unit_prices(line, quantity):
                n += 1
                placed = crud_order.place_order(
                    db,
                    OrderCreate(
                        order_ref=_ref(number, n),
                        name=_clean(line.get("name")) or item.name,
                        price=price,
                        deposit_paid=price if paid else Decimal("0"),
                        image=image,
                        source=Source.website,
                        delivery_status=Delivery_Status.processing,
                        inventory_id=item.id,
                        customer_id=customer.id if customer else None,
                    ),
                )
                result["created"] += 1
                if placed["shortfall"]:
                    result["shortfalls"] += 1
                if note and n == 1:
                    placed["order"].remarks = f"Customer note: {note}"[:500]
                    db.commit()
        return result

    # Already taken in: apply status changes.
    if status in PAID:
        for row in rows:
            if row.deposit_paid < row.price:
                row.deposit_paid = row.price
                result["updated"] += 1
        db.commit()

    if status == "completed":
        for row in rows:
            if row.delivery_status == Delivery_Status.processing:
                crud_order.update_order(db, row.id, OrderUpdate(delivery_status=Delivery_Status.dispatched))
                result["updated"] += 1

    if status in REVERSE:
        for row in rows:
            already = db.query(Order.id).filter(Order.returns_order_id == row.id).first()
            if already:
                continue
            crud_order.record_return(
                db,
                ReturnCreate(
                    returns_order_id=row.id,
                    return_type=Return_Type.refund,
                    remarks=f"{status.capitalize()} in the online shop (order {number}).",
                ),
            )
            result["reversed"] += 1
    return result


# ---------------------------------------------------------------------------
# Website enquiries (Contact and Commissions forms)
# ---------------------------------------------------------------------------


def record_enquiry(db: Session, name: str, email: str, phone: Optional[str], kind: str, message: str) -> dict:
    kind = "commission" if (kind or "").lower().startswith("commission") else "contact"
    lead = Lead(
        name=_clean(name)[:200] or email,
        email=(email or "").strip().lower() or None,
        phone=(phone or "").strip() or None,
        status="New commission enquiry" if kind == "commission" else "New website enquiry",
        source=Source.website,
        priority_lvl=Priority_Level.high_priority if kind == "commission" else Priority_Level.medium_priority,
    )
    db.add(lead)
    db.flush()
    task = Task(
        title=f"Reply to {kind} enquiry from {lead.name}",
        notes=(message or "").strip()[:5000] or "No message.",
        due_date=datetime.now() + timedelta(days=2),
        priority_lvl=Priority_Level.high_priority if kind == "commission" else Priority_Level.medium_priority,
        lead_id=lead.id,
    )
    db.add(task)
    db.commit()
    return {"lead_id": lead.id, "task_id": task.id}


# ---------------------------------------------------------------------------
# Catch-up sync (the safety net behind the webhooks)
# ---------------------------------------------------------------------------


def _api_get(client: httpx.Client, path: str, params: dict) -> list:
    url = settings.wc_url.rstrip("/") + "/wp-json/wc/v3/" + path
    response = client.get(url, params=params)
    if response.status_code == 401:
        # Some shared hosts strip the Authorization header before it reaches
        # WordPress. WooCommerce accepts the keys as query parameters over HTTPS.
        response = client.get(
            url,
            params={**params, "consumer_key": settings.wc_consumer_key, "consumer_secret": settings.wc_consumer_secret},
            auth=None,
        )
    response.raise_for_status()
    return response.json()


def catch_up(db: Session) -> dict:
    """Re-read recent shop orders and all products, and apply anything missing."""
    if not settings.woocommerce_api_ready:
        return {"ok": False, "reason": "WooCommerce API keys are not configured."}

    since = (datetime.now(timezone.utc) - CATCH_UP_WINDOW).strftime("%Y-%m-%dT%H:%M:%S")
    summary = {"ok": True, "products": 0, "orders_checked": 0, "pieces_created": 0, "reversed": 0, "errors": []}

    with httpx.Client(auth=(settings.wc_consumer_key, settings.wc_consumer_secret), timeout=30) as client:
        page = 1
        while True:
            products = _api_get(client, "products", {"per_page": 100, "page": page, "status": "publish"})
            for product in products:
                upsert_product(db, product)
                summary["products"] += 1
            if len(products) < 100:
                break
            page += 1

        page = 1
        while True:
            orders = _api_get(
                client,
                "orders",
                {"per_page": 50, "page": page, "modified_after": since, "dates_are_gmt": "true", "orderby": "date", "order": "asc"},
            )
            for order in orders:
                summary["orders_checked"] += 1
                try:
                    applied = sync_order(db, order)
                    summary["pieces_created"] += applied["created"]
                    summary["reversed"] += applied["reversed"]
                except Exception as exc:  # one bad order must not stop the rest
                    db.rollback()
                    log.exception("catch-up failed for order %s", order.get("id"))
                    summary["errors"].append(f"order {_order_number(order)}: {exc}")
            if len(orders) < 50:
                break
            page += 1

    _set_state(db, "woocommerce.last_catch_up", datetime.now(timezone.utc).isoformat(timespec="seconds"))
    if summary["errors"]:
        _set_state(db, "woocommerce.last_error", "; ".join(summary["errors"])[:2000])
    return summary
