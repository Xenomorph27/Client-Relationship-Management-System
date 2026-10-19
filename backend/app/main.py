from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import (
    campaigns,
    carts,
    customers,
    emails,
    inventory,
    leads,
    orders,
    organisations,
    returns,
    tasks,
    users,
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

# Order here only affects the grouping in /docs, not routing.
app.include_router(users.router)
app.include_router(organisations.router)
app.include_router(leads.router)
app.include_router(customers.router)
app.include_router(inventory.router)
app.include_router(orders.router)
app.include_router(returns.router)
app.include_router(carts.router)
app.include_router(tasks.router)
app.include_router(emails.router)
app.include_router(campaigns.router)


@app.get("/health", tags=["health"])
def health():
    """
    Liveness probe. Also what the frontend pings to decide whether the API is
    reachable before falling back to sample data, so it must stay dependency
    free - no database call, or a database blip would look like the API being
    down and take the whole app offline instead of degrading.
    """
    return {"status": "ok", "version": app.version}
