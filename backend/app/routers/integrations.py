"""
Endpoints the outside world calls: the online shop and the website forms.

These are NOT behind the staff login, because WooCommerce and WordPress are
servers, not people. Each one proves itself with a shared secret instead:

  /integrations/woocommerce/webhook   signed by WooCommerce (HMAC of the body)
  /integrations/website/enquiry       signed by the website plugin (same scheme)

/integrations/woocommerce/resync and /status ARE behind the staff login: they
are buttons for people.
"""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from auth import require_staff
from database.database import get_db
from services import woocommerce as woo
from settings import settings

log = logging.getLogger("integrations")

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.post("/woocommerce/webhook")
async def woocommerce_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Receives every WooCommerce webhook (orders, customers, products).

    Answers 200 even when applying the payload fails, on purpose: WooCommerce
    switches a webhook OFF after five failures in a row, and a disabled webhook
    is a silent outage. Failures are logged, kept in integration_state, and
    repaired by the catch-up sync, which re-reads the last few days anyway.
    A bad SIGNATURE is still a 401 - that is not our failure to absorb.
    """
    raw = await request.body()
    topic = (request.headers.get("x-wc-webhook-topic") or "").lower()

    # When a webhook is first saved, WooCommerce sends an unsigned "ping"
    # (body "webhook_id=N", no topic). Acknowledge it and do nothing.
    if not topic:
        return {"ok": True, "ping": True}

    if not settings.wc_webhook_secret:
        raise HTTPException(status_code=503, detail="WC_WEBHOOK_SECRET is not configured.")
    if not woo.verify_signature(raw, request.headers.get("x-wc-webhook-signature"), settings.wc_webhook_secret):
        raise HTTPException(status_code=401, detail="Invalid webhook signature.")

    try:
        payload = json.loads(raw or b"{}")
        resource, _, event = topic.partition(".")
        if resource == "order":
            return {"ok": True, **woo.sync_order(db, payload)}
        if resource == "product" and event in ("created", "updated", "restored"):
            item = woo.upsert_product(db, payload)
            return {"ok": True, "inventory_id": item.id, "sku": item.sku}
        if resource == "customer" and event in ("created", "updated"):
            customer = woo.customer_from_webhook(db, payload)
            return {"ok": True, "customer_id": customer.id if customer else None}
        return {"ok": True, "ignored": topic}
    except Exception as exc:
        db.rollback()
        log.exception("webhook %s failed", topic)
        woo._set_state(db, "woocommerce.last_error", f"webhook {topic}: {exc}"[:2000])
        return {"ok": False, "error": "Logged; the catch-up sync will retry."}


class Enquiry(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=40)
    kind: str = "contact"
    message: str = Field(default="", max_length=5000)


@router.post("/website/enquiry", status_code=201)
async def website_enquiry(request: Request, db: Session = Depends(get_db)):
    """Contact and Commissions form submissions from the website -> a Lead plus a reply task."""
    raw = await request.body()
    if not settings.website_enquiry_secret:
        raise HTTPException(status_code=503, detail="WEBSITE_ENQUIRY_SECRET is not configured.")
    if not woo.verify_signature(raw, request.headers.get("x-sw-signature"), settings.website_enquiry_secret):
        raise HTTPException(status_code=401, detail="Invalid signature.")
    try:
        enquiry = Enquiry.model_validate_json(raw)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return woo.record_enquiry(db, enquiry.name, enquiry.email, enquiry.phone, enquiry.kind, enquiry.message)


@router.post("/woocommerce/resync", dependencies=[Depends(require_staff)])
def woocommerce_resync(db: Session = Depends(get_db)):
    """Run the catch-up sync now: products, plus every order changed in the last three days."""
    return woo.catch_up(db)


@router.get("/woocommerce/status", dependencies=[Depends(require_staff)])
def woocommerce_status(db: Session = Depends(get_db)):
    return {
        "webhook_secret_configured": bool(settings.wc_webhook_secret),
        "api_keys_configured": settings.woocommerce_api_ready,
        "sync_interval_minutes": settings.wc_sync_interval_minutes,
        "last_catch_up": woo.get_state(db, "woocommerce.last_catch_up"),
        "last_error": woo.get_state(db, "woocommerce.last_error"),
    }
