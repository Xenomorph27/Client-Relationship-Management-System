import logging
import threading
import time

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import require_staff

from routers import (
    campaigns,
    carts,
    customers,
    emails,
    integrations,
    inventory,
    leads,
    orders,
    organisations,
    returns,
    tasks,
    users,
    web_orders,
)
from settings import settings

app = FastAPI(
    title="Client Relationship Management System",
    description=(
        "CRM for a woodcraft business. Orders are the money object; a return "
        "is the same row with kind='return', and the Logistics board is a "
        "view over that one table rather than a second copy of it."
    ),
    version="0.2.0",
)

# ---------------------------------------------------------------------------
# CORS.
#
# Without this the browser refuses every call from the frontend and the error
# it shows blames the network, not the missing header - which sends you
# debugging the wrong half of the app. The frontend runs on a different origin
# (localhost:5173) from the API (127.0.0.1:8000), and a different port is a
# different origin, so this is needed even in development.
#
# allow_origins is an explicit list, never ["*"]: a wildcard cannot be
# combined with credentials, and this API will need cookies or an
# Authorization header the moment login exists.
# ---------------------------------------------------------------------------
origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Staff login.
#
# Every CRM router is mounted behind require_staff, so a request without a
# valid Supabase login from someone on the staff list never reaches a handler.
# Applied HERE, at mount time, rather than inside each router, so a router
# added later cannot be left open by forgetting a decorator.
#
# Only two things stay public: /health (the uptime monitor and the frontend's
# reachability check) and /integrations, whose shop and website endpoints
# check their own signed secrets instead.
# ---------------------------------------------------------------------------
STAFF_ONLY = [Depends(require_staff)]

# Order here only affects the grouping in /docs, not routing.
app.include_router(users.router, dependencies=STAFF_ONLY)
app.include_router(organisations.router, dependencies=STAFF_ONLY)
app.include_router(leads.router, dependencies=STAFF_ONLY)
app.include_router(customers.router, dependencies=STAFF_ONLY)
app.include_router(inventory.router, dependencies=STAFF_ONLY)
app.include_router(orders.router, dependencies=STAFF_ONLY)
app.include_router(returns.router, dependencies=STAFF_ONLY)
app.include_router(carts.router, dependencies=STAFF_ONLY)
app.include_router(tasks.router, dependencies=STAFF_ONLY)
app.include_router(emails.router, dependencies=STAFF_ONLY)
app.include_router(campaigns.router, dependencies=STAFF_ONLY)
app.include_router(web_orders.router, dependencies=STAFF_ONLY)
app.include_router(integrations.router)


@app.get("/me", tags=["auth"])
def me(staff: dict = Depends(require_staff)):
    """Who the frontend is signed in as. Also how it checks a login is accepted."""
    return staff


@app.get("/health", tags=["health"])
def health():
    """
    Liveness probe. Also what the frontend pings to decide whether the API is
    reachable before falling back to sample data, so it must stay dependency
    free - no database call, or a database blip would look like the API being
    down and take the whole app offline instead of degrading.
    """
    return {"status": "ok", "version": app.version}


# ---------------------------------------------------------------------------
# Catch-up sync timer.
#
# Webhooks are the fast path; this is the safety net. Every
# WC_SYNC_INTERVAL_MINUTES it re-reads the shop's products and its last three
# days of orders and applies anything missing - which covers a webhook that
# arrived while the server was asleep or redeploying. Writes are idempotent,
# so re-reading is harmless. A daemon thread, so it never blocks shutdown.
# ---------------------------------------------------------------------------
log = logging.getLogger("catch-up")


def _catch_up_loop():
    from database.database import SessionLocal
    from services import woocommerce as woo

    time.sleep(20)  # let the server finish starting before the first run
    while True:
        db = SessionLocal()
        try:
            result = woo.catch_up(db)
            log.info("WooCommerce catch-up: %s", result)
        except Exception:
            db.rollback()
            log.exception("WooCommerce catch-up failed")
        finally:
            db.close()
        time.sleep(max(settings.wc_sync_interval_minutes, 1) * 60)


@app.on_event("startup")
def start_catch_up():
    if settings.woocommerce_api_ready and settings.wc_sync_interval_minutes > 0:
        threading.Thread(target=_catch_up_loop, name="woocommerce-catch-up", daemon=True).start()
