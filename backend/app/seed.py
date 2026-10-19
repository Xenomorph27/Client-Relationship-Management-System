"""Fill the database with realistic sample data for exploring the API.

Run from this directory (backend/app), because the project uses flat imports:

    ../../.venv/Scripts/python.exe seed.py            # add sample data
    ../../.venv/Scripts/python.exe seed.py --reset    # wipe everything first, then add

The --reset flag TRUNCATEs every table and restarts the id counters at 1, so you
always get the same predictable ids. It only touches rows, never the schema, so
Alembic migrations are unaffected.

NOTE: the passwords below are obvious placeholders stored in plain text, because
password hashing is not implemented yet. Never put a real password here.
"""
import sys
from datetime import datetime, timedelta

from sqlalchemy import text

from crud import (
    crud_campaign,
    crud_customer,
    crud_email,
    crud_lead,
    crud_organisation,
    crud_user,
)
from seeds_woodcraft import (
    backfill_source,
    seed_carts,
    seed_inventory,
    seed_orders,
    seed_tasks,
)
from database.database import SessionLocal

# Truncated in one statement so foreign keys never block the wipe.
TABLES = (
    "users, organisations, leads, customers, emails, campaigns, "
    "inventory, orders, carts, tasks"
)

NOW = datetime.now()

SENDER = "sarah.chen@ourcrm.example"


def reset(db):
    db.execute(text(f"TRUNCATE {TABLES} RESTART IDENTITY CASCADE"))
    db.commit()
    print(f"wiped: {TABLES}")


def seed_users(db):
    rows = [
        ("sarah.chen", "sarah.chen@ourcrm.example", "Sarah Chen", "high_priority"),
        ("marcus.webb", "marcus.webb@ourcrm.example", "Marcus Webb", "medium_priority"),
        ("aisha.patel", "aisha.patel@ourcrm.example", "Aisha Patel", "medium_priority"),
    ]
    for username, email, full_name, priority in rows:
        crud_user.create_user(
            db,
            username=username,
            email=email,
            full_name=full_name,
            password="placeholder-not-hashed",
            priority_lvl=priority,
        )
    print(f"created {len(rows)} users")


def seed_organisations(db):
    rows = [
        ("Northwind Logistics", "northwind.example", "Logistics", "high_priority"),
        ("Vertex Financial", "vertexfin.example", "Financial Services", "overrider"),
        ("Brightline Health", "brightline.example", "Healthcare", "high_priority"),
        ("Kestrel Manufacturing", "kestrel.example", "Manufacturing", "medium_priority"),
        ("Orion Media", "orionmedia.example", "Media", "low_priority"),
    ]
    for name, domain, industry, priority in rows:
        crud_organisation.create_organisation(
            db,
            name=name,
            website=f"https://{domain}",
            industry=industry,
            official_email=f"contact@{domain}",
            support_contact=f"support@{domain}",
            priority_lvl=priority,
        )
    print(f"created {len(rows)} organisations")


def seed_leads(db):
    # name, email, phone, status, organisation_id, priority
    rows = [
        ("Daniel Okafor", "d.okafor@northwind.example", "555-0110", "qualified", 1, "high_priority"),
        ("Priya Raman", "p.raman@northwind.example", "555-0111", "contacted", 1, "medium_priority"),
        ("Tom Bergstrom", "t.bergstrom@northwind.example", "555-0112", "new", 1, "low_priority"),
        ("Elena Vasquez", "e.vasquez@vertexfin.example", "555-0120", "qualified", 2, "overrider"),
        ("James Whitfield", "j.whitfield@vertexfin.example", "555-0121", "proposal_sent", 2, "high_priority"),
        ("Nadia Haddad", "n.haddad@vertexfin.example", "555-0122", "contacted", 2, "medium_priority"),
        ("Alan Reyes", "a.reyes@brightline.example", "555-0130", "qualified", 3, "high_priority"),
        ("Miriam Osei", "m.osei@brightline.example", "555-0131", "new", 3, "medium_priority"),
        ("Victor Lindqvist", "v.lindqvist@kestrel.example", "555-0140", "contacted", 4, "medium_priority"),
        ("Hana Suzuki", "h.suzuki@kestrel.example", "555-0141", "unqualified", 4, "expendable"),
        ("Grace Mbeki", "g.mbeki@kestrel.example", "555-0142", "new", 4, "low_priority"),
        ("Leo Fontaine", "l.fontaine@orionmedia.example", "555-0150", "contacted", 5, "low_priority"),
        ("Zara Ahmed", "z.ahmed@orionmedia.example", "555-0151", "unqualified", 5, "expendable"),
        ("Ryan Cole", "r.cole@freelance.example", "555-0160", "new", None, "low_priority"),
        ("Sofia Marchetti", "s.marchetti@freelance.example", "555-0161", "contacted", None, "medium_priority"),
    ]
    for name, email, phone, status, org_id, priority in rows:
        crud_lead.create_lead(
            db,
            name=name,
            email=email,
            phone=phone,
            status=status,
            organisation_id=org_id,
            priority_lvl=priority,
        )
    print(f"created {len(rows)} leads")


def seed_customers(db):
    rows = [
        ("Northwind Logistics", "billing@northwind.example", "555-0210", "high_priority"),
        ("Vertex Financial", "ap@vertexfin.example", "555-0220", "overrider"),
        ("Brightline Health", "accounts@brightline.example", "555-0230", "high_priority"),
        ("Copperfield Retail", "finance@copperfield.example", "555-0240", "medium_priority"),
        ("Saltmarsh Consulting", "admin@saltmarsh.example", "555-0250", "medium_priority"),
        ("Heron Bay Hotels", "pay@heronbay.example", "555-0260", "low_priority"),
        ("Tessellate Design", "hello@tessellate.example", "555-0270", "low_priority"),
        ("Pinehurst Academy", "bursar@pinehurst.example", "555-0280", "medium_priority"),
    ]
    for name, email, phone, priority in rows:
        crud_customer.add_customer(
            db, name=name, email=email, phone=phone, priority_lvl=priority
        )
    print(f"created {len(rows)} customers")


def seed_emails(db):
    # subject, body, recipient, lead_id, customer_id, priority
    rows = [
        ("Intro call follow-up", "Great speaking today. Sending the deck as promised.",
         "d.okafor@northwind.example", 1, None, "high_priority"),
        ("Contract sent for signature", "The agreement is in your inbox for review.",
         "d.okafor@northwind.example", 1, None, "high_priority"),
        ("Checking in", "Wanted to see if you had questions about pricing.",
         "p.raman@northwind.example", 2, None, "medium_priority"),
        ("Welcome to the platform", "Your account is live. Your getting-started guide is attached.",
         "billing@northwind.example", None, 1, "medium_priority"),
        ("Proposal: enterprise licence", "Attached is the proposal we discussed.",
         "e.vasquez@vertexfin.example", 4, None, "overrider"),
        ("Re: security questionnaire", "Completed questionnaire attached for your team.",
         "j.whitfield@vertexfin.example", 5, None, "high_priority"),
        ("Compliance module demo", "Confirming Thursday at 14:00 for the walkthrough.",
         "n.haddad@vertexfin.example", 6, None, "medium_priority"),
        ("Clinic pilot scope", "Summary of the pilot scope and success criteria.",
         "a.reyes@brightline.example", 7, None, "high_priority"),
        ("Quarterly review invite", "Would you like to book the Q4 review?",
         "accounts@brightline.example", None, 3, "medium_priority"),
        ("Integration requirements", "Here is the technical checklist for your plant systems.",
         "v.lindqvist@kestrel.example", 9, None, "medium_priority"),
        ("Training options", "Three training tiers are outlined below.",
         "g.mbeki@kestrel.example", 11, None, "low_priority"),
        ("Thanks for your time", "Understood on timing. Happy to revisit next year.",
         "l.fontaine@orionmedia.example", 12, None, "low_priority"),
        ("Renewal confirmed", "Your renewal is processed. Invoice attached.",
         "finance@copperfield.example", None, 4, "medium_priority"),
        ("Onboarding schedule", "Proposed onboarding timeline for your team.",
         "admin@saltmarsh.example", None, 5, "medium_priority"),
        ("Pilot results", "Summary of pilot metrics after week two.",
         "pay@heronbay.example", None, 6, "low_priority"),
        ("Invoice reminder", "A gentle reminder that invoice 1042 is due Friday.",
         "bursar@pinehurst.example", None, 8, "medium_priority"),
    ]
    for subject, body, recipient, lead_id, customer_id, priority in rows:
        crud_email.create_email(
            db,
            subject=subject,
            body=body,
            sender=SENDER,
            recipient=recipient,
            lead_id=lead_id,
            customer_id=customer_id,
            priority_lvl=priority,
        )
    print(f"created {len(rows)} emails")


def seed_campaigns(db):
    # name, description, start_offset_days, duration_days, priority
    rows = [
        ("Q4 Enterprise Push", "Outbound sequence targeting enterprise logistics accounts.",
         -20, 70, "high_priority"),
        ("Healthcare Webinar Series", "Three-part webinar for clinical operations leads.",
         -5, 45, "high_priority"),
        ("Manufacturing Newsletter", "Monthly newsletter for the manufacturing segment.",
         -60, 120, "medium_priority"),
        ("Spring Product Launch", "Launch announcement for the new reporting module.",
         30, 60, "medium_priority"),
        ("Dormant Account Winback", "Re-engagement emails for accounts inactive six months or more.",
         -90, 30, "low_priority"),
    ]
    for name, description, start_offset, duration, priority in rows:
        start = NOW + timedelta(days=start_offset)
        crud_campaign.add_campaign(
            db,
            name=name,
            html_content=f"<h1>{name}</h1><p>{description}</p>",
            start_date=start,
            end_date=start + timedelta(days=duration),
            description=description,
            priority_lvl=priority,
        )
    print(f"created {len(rows)} campaigns")


def main():
    db = SessionLocal()
    try:
        if "--reset" in sys.argv:
            reset(db)
        # Order matters: parents before the rows that point at them.
        seed_users(db)
        seed_organisations(db)
        seed_leads(db)
        seed_customers(db)
        seed_inventory(db)
        seed_orders(db)
        seed_carts(db)
        seed_emails(db)
        seed_campaigns(db)
        seed_tasks(db)
        backfill_source(db)
        print("\nsample data ready - start the server and browse http://127.0.0.1:8000/docs")
    finally:
        db.close()


if __name__ == "__main__":
    main()
