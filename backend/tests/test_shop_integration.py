"""
Tests for staff login and the shop integration, run against a real Postgres.

    cd backend/app
    TEST_DATABASE_URL=postgresql://... python -m pytest ../tests -q

The database named by TEST_DATABASE_URL is WIPED between tests. Never point it
at the live database.
"""

import base64
import hashlib
import hmac
import json
import os
import sys
import threading
import time
from decimal import Decimal

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, "..", "app")
sys.path.insert(0, APP)

TEST_DB = os.environ.get("TEST_DATABASE_URL")
if not TEST_DB:
    pytest.skip("TEST_DATABASE_URL not set", allow_module_level=True)

os.environ.update(
    DATABASE_URL=TEST_DB,
    AUTH_REQUIRED="true",
    SUPABASE_URL="https://testproject.supabase.co",
    STAFF_EMAILS="owner@sapphirewoodcrafts.co.uk",
    WC_WEBHOOK_SECRET="test-webhook-secret",
    WEBSITE_ENQUIRY_SECRET="test-enquiry-secret",
    WC_SYNC_INTERVAL_MINUTES="0",
)

import jwt  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import ec  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

import auth  # noqa: E402
from database.database import SessionLocal, engine  # noqa: E402
from main import app  # noqa: E402
from models.inventory import InventoryItem  # noqa: E402
from models.orders import Order  # noqa: E402
from models.tasks import Task  # noqa: E402
from models.users import User  # noqa: E402
from services import woocommerce as woo  # noqa: E402

PRIVATE_KEY = ec.generate_private_key(ec.SECP256R1())
OTHER_KEY = ec.generate_private_key(ec.SECP256R1())
ISSUER = "https://testproject.supabase.co/auth/v1"


class _FakeJWKS:
    def get_signing_key_from_jwt(self, token):
        class K:
            key = PRIVATE_KEY.public_key()
        return K()


@pytest.fixture(autouse=True)
def clean_db(monkeypatch):
    monkeypatch.setattr(auth, "_jwks", lambda: _FakeJWKS())
    with engine.begin() as conn:
        tables = conn.execute(text(
            "select tablename from pg_tables where schemaname='public' and tablename <> 'alembic_version'"
        )).scalars().all()
        conn.execute(text("TRUNCATE " + ", ".join(f'"{t}"' for t in tables) + " RESTART IDENTITY CASCADE"))
    yield


@pytest.fixture
def client():
    return TestClient(app)


def token(email="owner@sapphirewoodcrafts.co.uk", key=PRIVATE_KEY, exp_in=3600, aud="authenticated"):
    now = int(time.time())
    return jwt.encode(
        {"sub": "user-1", "email": email, "aud": aud, "iss": ISSUER, "iat": now, "exp": now + exp_in},
        key,
        algorithm="ES256",
    )


def bearer(**kw):
    return {"Authorization": "Bearer " + token(**kw)}


def signed(body: dict, secret="test-webhook-secret", topic=None, header="x-wc-webhook-signature"):
    raw = json.dumps(body).encode()
    sig = base64.b64encode(hmac.new(secret.encode(), raw, hashlib.sha256).digest()).decode()
    headers = {header: sig, "content-type": "application/json"}
    if topic:
        headers["x-wc-webhook-topic"] = topic
    return raw, headers


def add_item(sku, name, qty, price="9.00"):
    db = SessionLocal()
    item = InventoryItem(sku=sku, name=name, quantity=qty, unit_price=Decimal(price))
    db.add(item)
    db.commit()
    item_id = item.id
    db.close()
    return item_id


def shop_order(number=1057, status="processing", paid=True):
    return {
        "id": number,
        "number": str(number),
        "status": status,
        "date_paid_gmt": "2026-10-30T12:00:00" if paid else None,
        "customer_note": "Gift wrap please",
        "billing": {"first_name": "Ada", "last_name": "Lovelace", "email": "Ada@Example.com", "phone": "07700 900123",
                    "address_1": "1 Billing Street", "city": "London", "postcode": "N1 1AA", "country": "GB"},
        "shipping": {"first_name": "Ada", "last_name": "Lovelace", "address_1": "12 Workshop Lane", "address_2": "Tilehurst",
                     "city": "Reading", "state": "Berkshire", "postcode": "RG31 5AA", "country": "GB"},
        "shipping_lines": [{"method_title": "UK Standard Delivery"}],
        "shipping_total": "4.95", "shipping_tax": "0.00", "total": "117.95", "currency": "GBP",
        "payment_method_title": "Card", "date_created_gmt": "2026-10-30T11:58:00",
        "line_items": [
            {"product_id": 60, "sku": "SW-DIPPER", "name": "Hand-Turned Honey Dipper", "quantity": 2,
             "total": "18.00", "total_tax": "0.00", "image": {"src": "https://shop/dipper.webp"}},
            {"product_id": 55, "sku": "SW-WALNUT-BOWL", "name": "Walnut Salad Bowl", "quantity": 1,
             "total": "95.00", "total_tax": "0.00"},
        ],
    }


def web_rows(number=1057):
    db = SessionLocal()
    rows = db.query(Order).filter(Order.order_ref.like(f"WEB-{number}-%")).order_by(Order.order_ref).all()
    db.close()
    return rows


# ---------------------------------------------------------------------------
# Staff login
# ---------------------------------------------------------------------------


def test_health_is_public(client):
    assert client.get("/health").status_code == 200


def test_crm_routes_need_login(client):
    assert client.get("/orders/").status_code == 401
    assert client.get("/customers/").status_code == 401
    assert client.get("/orders/", headers={"Authorization": "Bearer nonsense"}).status_code == 401


def test_staff_token_is_accepted(client):
    r = client.get("/orders/", headers=bearer())
    assert r.status_code == 200, r.text
    assert client.get("/me", headers=bearer()).json()["email"] == "owner@sapphirewoodcrafts.co.uk"


def test_people_table_grants_access(client):
    db = SessionLocal()
    db.add(User(username="sam", email="Sam@SapphireWoodcrafts.co.uk", password="-"))
    db.commit()
    db.close()
    assert client.get("/orders/", headers=bearer(email="sam@sapphirewoodcrafts.co.uk")).status_code == 200


def test_valid_login_but_not_staff_is_forbidden(client):
    assert client.get("/orders/", headers=bearer(email="stranger@gmail.com")).status_code == 403


def test_expired_forged_and_wrong_audience_tokens_are_rejected(client):
    assert client.get("/orders/", headers=bearer(exp_in=-10)).status_code == 401
    assert client.get("/orders/", headers=bearer(key=OTHER_KEY)).status_code == 401
    assert client.get("/orders/", headers=bearer(aud="anon")).status_code == 401


# ---------------------------------------------------------------------------
# WooCommerce webhook
# ---------------------------------------------------------------------------


def test_ping_and_bad_signature(client):
    assert client.post("/integrations/woocommerce/webhook", content=b"webhook_id=7",
                       headers={"content-type": "application/x-www-form-urlencoded"}).json()["ping"] is True
    raw, headers = signed(shop_order(), secret="wrong", topic="order.created")
    assert client.post("/integrations/woocommerce/webhook", content=raw, headers=headers).status_code == 401
    assert web_rows() == []


def test_paid_order_becomes_one_crm_order_per_piece(client):
    dipper = add_item("SW-DIPPER", "Hand-Turned Honey Dipper", qty=1)   # only one on the shelf
    bowl = add_item("SW-WALNUT-BOWL", "Walnut Salad Bowl", qty=2, price="95.00")

    raw, headers = signed(shop_order(), topic="order.created")
    r = client.post("/integrations/woocommerce/webhook", content=raw, headers=headers)
    assert r.status_code == 200 and r.json()["created"] == 3, r.text

    rows = web_rows()
    assert [o.order_ref for o in rows] == ["WEB-1057-1", "WEB-1057-2", "WEB-1057-3"]
    assert [o.price for o in rows] == [Decimal("9.00"), Decimal("9.00"), Decimal("95.00")]
    assert all(o.deposit_paid == o.price for o in rows)            # paid
    assert all(o.source.value == "website" for o in rows)
    assert rows[0].remarks == "Customer note: Gift wrap please"
    assert rows[0].image == "https://shop/dipper.webp"
    assert len({o.customer_id for o in rows}) == 1

    db = SessionLocal()
    assert db.get(InventoryItem, dipper).quantity == 0              # took the one in stock
    assert db.get(InventoryItem, bowl).quantity == 1
    statuses = [o.stock_status.value for o in rows]
    assert statuses == ["fulfilled", "shortfall", "fulfilled"]      # second dipper must be made
    tasks = db.query(Task).all()
    assert len(tasks) == 1 and tasks[0].title.startswith("Make Hand-Turned Honey Dipper")
    db.close()


def test_replayed_and_simultaneous_webhooks_do_not_duplicate(client):
    add_item("SW-DIPPER", "Hand-Turned Honey Dipper", qty=10)
    add_item("SW-WALNUT-BOWL", "Walnut Salad Bowl", qty=10)
    raw, headers = signed(shop_order(), topic="order.created")
    raw2, headers2 = signed(shop_order(), topic="order.updated")

    results = []
    def fire(r, h):
        results.append(TestClient(app).post("/integrations/woocommerce/webhook", content=r, headers=h).status_code)
    threads = [threading.Thread(target=fire, args=(raw, headers)), threading.Thread(target=fire, args=(raw2, headers2))]
    [t.start() for t in threads]
    [t.join() for t in threads]
    client.post("/integrations/woocommerce/webhook", content=raw, headers=headers)

    assert results == [200, 200]
    assert len(web_rows()) == 3
    db = SessionLocal()
    assert db.query(InventoryItem).filter_by(sku="SW-DIPPER").one().quantity == 8
    db.close()


def test_unpaid_order_is_not_taken_in(client):
    raw, headers = signed(shop_order(status="pending", paid=False), topic="order.created")
    assert client.post("/integrations/woocommerce/webhook", content=raw, headers=headers).json()["created"] == 0
    assert web_rows() == []


def test_on_hold_then_paid_then_completed(client):
    add_item("SW-DIPPER", "Hand-Turned Honey Dipper", qty=5)
    add_item("SW-WALNUT-BOWL", "Walnut Salad Bowl", qty=5)
    for status, paid in (("on-hold", False), ("processing", True), ("completed", True)):
        raw, headers = signed(shop_order(status=status, paid=paid), topic="order.updated")
        client.post("/integrations/woocommerce/webhook", content=raw, headers=headers)
        if status == "on-hold":
            assert all(o.deposit_paid == 0 for o in web_rows())
    rows = web_rows()
    assert len(rows) == 3
    assert all(o.deposit_paid == o.price for o in rows)
    assert all(o.delivery_status.value == "dispatched" for o in rows)


def test_refund_reverses_each_piece_once_and_restocks(client):
    add_item("SW-DIPPER", "Hand-Turned Honey Dipper", qty=5)
    add_item("SW-WALNUT-BOWL", "Walnut Salad Bowl", qty=5)
    raw, headers = signed(shop_order(), topic="order.created")
    client.post("/integrations/woocommerce/webhook", content=raw, headers=headers)
    for _ in range(2):
        raw, headers = signed(shop_order(status="refunded"), topic="order.updated")
        client.post("/integrations/woocommerce/webhook", content=raw, headers=headers)

    db = SessionLocal()
    returns = db.query(Order).filter(Order.kind == "return").all()
    assert len(returns) == 3
    assert all(r.return_type.value == "refund" for r in returns)
    assert len({r.web_order_id for r in returns}) == 1 and returns[0].web_order_id is not None
    assert db.query(InventoryItem).filter_by(sku="SW-DIPPER").one().quantity == 5
    db.close()


def test_unknown_product_is_created_and_flagged_for_making(client):
    raw, headers = signed(shop_order(), topic="order.created")
    client.post("/integrations/woocommerce/webhook", content=raw, headers=headers)
    db = SessionLocal()
    assert {i.sku for i in db.query(InventoryItem).all()} == {"SW-DIPPER", "SW-WALNUT-BOWL"}
    assert all(o.stock_status.value == "shortfall" for o in web_rows())
    assert db.query(Task).count() == 3
    db.close()


def test_product_webhook_updates_details_but_not_stock(client):
    add_item("SW-WALNUT-BOWL", "Walnut Bowl (old name)", qty=4, price="80.00")
    product = {"id": 55, "sku": "SW-WALNUT-BOWL", "name": "Walnut Salad Bowl", "price": "95.00",
               "manage_stock": True, "stock_quantity": 1,
               "categories": [{"name": "Bowls"}], "images": [{"src": "https://shop/walnut.webp"}]}
    raw, headers = signed(product, topic="product.updated")
    assert client.post("/integrations/woocommerce/webhook", content=raw, headers=headers).json()["ok"]
    db = SessionLocal()
    item = db.query(InventoryItem).filter_by(sku="SW-WALNUT-BOWL").one()
    assert (item.name, item.unit_price, item.category, item.quantity) == ("Walnut Salad Bowl", Decimal("95.00"), "Bowls", 4)
    db.close()


def test_processing_errors_answer_200_and_are_recorded(client, monkeypatch):
    monkeypatch.setattr(woo, "sync_order", lambda db, p: (_ for _ in ()).throw(RuntimeError("boom")))
    raw, headers = signed(shop_order(), topic="order.created")
    r = client.post("/integrations/woocommerce/webhook", content=raw, headers=headers)
    assert r.status_code == 200 and r.json()["ok"] is False
    db = SessionLocal()
    assert "boom" in woo.get_state(db, "woocommerce.last_error")
    db.close()


# ---------------------------------------------------------------------------
# Website enquiries
# ---------------------------------------------------------------------------


def test_commission_enquiry_creates_lead_and_reply_task(client):
    body = {"name": "Grace Hopper", "email": "grace@example.com", "kind": "commission",
            "message": "Could you turn a bowl from our old garden apple tree?"}
    raw, headers = signed(body, secret="test-enquiry-secret", header="x-sw-signature")
    r = client.post("/integrations/website/enquiry", content=raw, headers=headers)
    assert r.status_code == 201, r.text
    leads = client.get("/leads/", headers=bearer()).json()
    assert leads[0]["status"] == "New commission enquiry" and leads[0]["source"] == "website"
    db = SessionLocal()
    task = db.query(Task).one()
    assert task.lead_id == leads[0]["id"] and "apple tree" in task.notes
    db.close()


def test_enquiry_with_bad_signature_is_rejected(client):
    raw, headers = signed({"name": "x", "email": "x@example.com"}, secret="wrong", header="x-sw-signature")
    assert client.post("/integrations/website/enquiry", content=raw, headers=headers).status_code == 401


# ---------------------------------------------------------------------------
# Catch-up sync
# ---------------------------------------------------------------------------


def test_catch_up_applies_missed_orders_idempotently(monkeypatch):
    monkeypatch.setattr(woo.settings, "wc_url", "https://shop.example")
    monkeypatch.setattr(woo.settings, "wc_consumer_key", "ck")
    monkeypatch.setattr(woo.settings, "wc_consumer_secret", "cs")
    products = [{"id": 60, "sku": "SW-DIPPER", "name": "Hand-Turned Honey Dipper", "price": "9.00", "manage_stock": False},
                {"id": 55, "sku": "SW-WALNUT-BOWL", "name": "Walnut Salad Bowl", "price": "95.00", "manage_stock": True, "stock_quantity": 2}]
    orders = [shop_order(1057), shop_order(1058, status="pending", paid=False)]
    monkeypatch.setattr(woo, "_api_get", lambda client, path, params: products if path == "products" and params["page"] == 1
                        else orders if path == "orders" and params["page"] == 1 else [])
    db = SessionLocal()
    first = woo.catch_up(db)
    second = woo.catch_up(db)
    assert first["products"] == 2 and first["pieces_created"] == 3 and first["errors"] == []
    assert second["pieces_created"] == 0
    assert len(web_rows(1057)) == 3 and web_rows(1058) == []
    assert woo.get_state(db, "woocommerce.last_catch_up")
    db.close()


def test_resync_endpoint_is_staff_only(client):
    assert client.post("/integrations/woocommerce/resync").status_code == 401
    assert client.post("/integrations/woocommerce/resync", headers=bearer()).json()["ok"] is False  # keys not set


# ---------------------------------------------------------------------------
# Shop orders (web_orders) and security
# ---------------------------------------------------------------------------


def test_shop_order_row_holds_address_and_links_every_piece(client):
    add_item("SW-DIPPER", "Hand-Turned Honey Dipper", qty=5)
    add_item("SW-WALNUT-BOWL", "Walnut Salad Bowl", qty=5)
    raw, headers = signed(shop_order(), topic="order.created")
    client.post("/integrations/woocommerce/webhook", content=raw, headers=headers)

    rows = web_rows()
    assert len({o.web_order_id for o in rows}) == 1 and rows[0].web_order_id is not None

    web = client.get(f"/web-orders/{rows[0].web_order_id}", headers=bearer()).json()
    assert web["number"] == "1057" and web["status"] == "processing"
    assert web["address_lines"] == ["Ada Lovelace", "12 Workshop Lane", "Tilehurst", "Reading RG31 5AA", "Berkshire"]
    assert web["shipping_method"] == "UK Standard Delivery" and web["payment_method"] == "Card"
    assert web["total"] == "117.95" and web["customer_note"] == "Gift wrap please"
    assert [p["order_ref"] for p in web["pieces"]] == ["WEB-1057-1", "WEB-1057-2", "WEB-1057-3"]
    assert web["customer_id"] == rows[0].customer_id

    listed = client.get("/web-orders/?status=processing", headers=bearer()).json()
    assert [w["number"] for w in listed] == ["1057"]


def test_shop_order_row_follows_status_and_falls_back_to_billing_address(client):
    add_item("SW-DIPPER", "Hand-Turned Honey Dipper", qty=5)
    add_item("SW-WALNUT-BOWL", "Walnut Salad Bowl", qty=5)
    order = shop_order()
    order["shipping"] = {}
    raw, headers = signed(order, topic="order.created")
    client.post("/integrations/woocommerce/webhook", content=raw, headers=headers)
    order["status"] = "completed"
    order["date_completed_gmt"] = "2026-11-02T09:00:00"
    raw, headers = signed(order, topic="order.updated")
    client.post("/integrations/woocommerce/webhook", content=raw, headers=headers)

    web = client.get("/web-orders/", headers=bearer()).json()[0]
    assert web["status"] == "completed" and web["completed_at"].startswith("2026-11-02")
    assert web["address_lines"][1:] == ["1 Billing Street", "London N1 1AA"]


def test_pieces_from_before_web_orders_get_linked_on_next_sync(client):
    add_item("SW-DIPPER", "Hand-Turned Honey Dipper", qty=5)
    add_item("SW-WALNUT-BOWL", "Walnut Salad Bowl", qty=5)
    raw, headers = signed(shop_order(), topic="order.created")
    client.post("/integrations/woocommerce/webhook", content=raw, headers=headers)
    db = SessionLocal()
    db.query(Order).update({Order.web_order_id: None})
    db.commit()
    db.close()
    raw, headers = signed(shop_order(), topic="order.updated")
    client.post("/integrations/woocommerce/webhook", content=raw, headers=headers)
    assert all(o.web_order_id is not None for o in web_rows())


def test_web_orders_are_staff_only(client):
    assert client.get("/web-orders/").status_code == 401
    assert client.get("/web-orders/1", headers=bearer(email="stranger@gmail.com")).status_code == 403
    assert client.get("/web-orders/999", headers=bearer()).status_code == 404


def test_every_table_has_row_level_security():
    """Supabase publishes every public table through its REST API with the key
    that sits in the frontend. A table without RLS would be readable by anyone,
    so a migration that adds a table must also switch RLS on for it."""
    with engine.connect() as conn:
        exposed = conn.execute(text(
            "select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace "
            "where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity"
        )).scalars().all()
    assert exposed == []
