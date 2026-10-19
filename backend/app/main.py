from fastapi import FastAPI
from routers import (
    campaigns,
    customers,
    deals,
    emails,
    leads,
    organisations,
    users,
)

app = FastAPI(title="Client Relationship Management System")

app.include_router(users.router)
app.include_router(organisations.router)
app.include_router(leads.router)
app.include_router(customers.router)
app.include_router(deals.router)
app.include_router(emails.router)
app.include_router(campaigns.router)

@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
