"""
Woodcraft sample data: inventory, orders, returns, carts and tasks.

Split out of seed.py because this is 200 lines of tables rather than logic,
and seed.py stays readable as the sequence of what gets loaded.

The rows here are the SAME rows the frontend ships as its sample data in
frontend/src/mocks/db.js. That is deliberate: when the API is switched on, the
screens show what they showed before, so anything that changes is a wiring
bug rather than different data.

Orders are inserted DIRECTLY, not through crud_order.place_order. The
quantities below are already the post-order figures, and the stock_status
flags are already set; running the stock rule over them would decrement a
second time and leave inventory wrong by the number of seeded orders.
"""
from datetime import datetime, timedelta

from models.carts import Cart
from models.inventory import InventoryItem
from models.orders import Order
from models.tasks import Task

NOW = datetime.now()


def at(days):
    """Dates relative to now, so the data never looks stale."""
    return NOW + timedelta(days=days)


# sku, name, class, category, wood, unit, qty, reorder, price, image
INVENTORY = [
    ("WC-OAK-DT6", "Oak dining table, 6 seat", "product", "furniture", "Oak", "piece", 3, 2, "1850.00", "oak-dining-table.jpg"),
    ("WC-WAL-DESK", "Walnut writing desk", "product", "furniture", "Walnut", "piece", 2, 2, "1240.00", "walnut-writing-desk.jpg"),
    ("WC-ASH-CH4", "Ash dining chair, set of 4", "product", "furniture", "Ash", "piece", 6, 3, "960.00", "ash-dining-chairs.jpg"),
    # Zero stock on purpose: this is the row that demonstrates the stock rule.
    ("WC-OAK-BKC", "Oak bookcase, tall", "product", "furniture", "Oak", "piece", 0, 2, "1420.00", "oak-bookcase.jpg"),
    ("WC-CHE-SBD", "Cherry sideboard", "product", "furniture", "Cherry", "piece", 1, 2, "2100.00", "cherry-sideboard.jpg"),
    ("WC-MAP-BWL", "Maple serving bowl", "product", "decor", "Maple", "piece", 14, 6, "85.00", "maple-bowl.jpg"),
    ("WC-WAL-BRD", "Walnut chopping board", "product", "decor", "Walnut", "piece", 22, 10, "64.00", "walnut-board.jpg"),
    ("WC-OAK-MIR", "Oak framed mirror", "product", "decor", "Oak", "piece", 5, 4, "210.00", "oak-mirror.jpg"),
    ("WC-CUS-SHF", "Bespoke shelving, per metre", "product", "custom", "Oak", "piece", 0, 1, "340.00", "bespoke-shelving.jpg"),
    ("WC-CUS-KIT", "Bespoke kitchen island", "product", "custom", "Walnut", "piece", 1, 1, "3600.00", "kitchen-island.jpg"),
    ("RM-TIM-OAK", "European oak, kiln dried", "material", "timber", "Oak", "board_ft", 420, 150, "14.50", None),
    # Below its reorder level, so the low-stock path is visible without
    # having to engineer it.
    ("RM-TIM-WAL", "American black walnut", "material", "timber", "Walnut", "board_ft", 95, 120, "28.00", None),
    ("RM-TIM-ASH", "English ash", "material", "timber", "Ash", "board_ft", 260, 100, "11.20", None),
    ("RM-TIM-MAP", "Hard maple", "material", "timber", "Maple", "board_ft", 180, 80, "16.75", None),
    ("RM-HDW-HNG", "Brass butt hinges", "material", "hardware", None, "pack", 34, 20, "18.00", None),
    ("RM-HDW-SCR", "Wood screws, assorted", "material", "hardware", None, "pack", 12, 15, "9.50", None),
    ("RM-HDW-RUN", "Soft-close drawer runners", "material", "hardware", None, "pack", 8, 10, "42.00", None),
    ("RM-FIN-OIL", "Danish oil", "material", "finish", None, "litre", 26, 12, "22.00", None),
    ("RM-FIN-WAX", "Beeswax polish", "material", "finish", None, "litre", 7, 8, "17.50", None),
    ("RM-FIN-LAC", "Water-based lacquer", "material", "finish", None, "litre", 31, 15, "34.00", None),
]

# ref, name, inventory_id, price, deposit, status, source, ordered, due,
# customer, owner, priority, stock
DELIVERIES = [
    ("WC-1021", "Oak dining table, 6 seat", 1, "1850.00", "600.00", "delivered", "website", -84, -24, 1, 1, "high_priority", "fulfilled"),
    ("WC-1024", "Walnut writing desk", 2, "1240.00", "400.00", "delivered", "instagram", -72, -18, 2, 2, "medium_priority", "fulfilled"),
    ("WC-1028", "Cherry sideboard", 5, "2100.00", "1050.00", "delivered", "direct", -66, -12, 3, 1, "overrider", "fulfilled"),
    ("WC-1033", "Maple serving bowl", 6, "85.00", "85.00", "delivered", "facebook", -40, -31, 4, 3, "low_priority", "fulfilled"),
    ("WC-1035", "Ash dining chair, set of 4", 3, "960.00", "300.00", "in_transit", "website", -22, 4, 5, 2, "medium_priority", "fulfilled"),
    ("WC-1038", "Oak framed mirror", 8, "210.00", "210.00", "in_transit", "instagram", -16, 2, 6, 3, "low_priority", "fulfilled"),
    ("WC-1041", "Walnut chopping board", 7, "64.00", "64.00", "dispatched", "facebook", -11, 3, 7, 3, "low_priority", "fulfilled"),
    ("WC-1042", "Oak bookcase, tall", 4, "1420.00", "500.00", "dispatched", "website", -9, 7, 8, 1, "high_priority", "shortfall"),
    ("WC-1045", "Bespoke kitchen island", 10, "3600.00", "1800.00", "processing", "direct", -6, 38, 2, 1, "overrider", "fulfilled"),
    ("WC-1047", "Bespoke shelving, per metre", 9, "340.00", "0.00", "processing", "website", -4, 21, 4, 2, "medium_priority", "shortfall"),
    ("WC-1049", "Maple serving bowl", 6, "85.00", "0.00", "processing", "instagram", -2, 12, 5, 3, "low_priority", "fulfilled"),
    ("WC-1050", "Oak framed mirror", 8, "210.00", "105.00", "processing", "facebook", -1, 16, 1, 2, "medium_priority", "fulfilled"),
]

# ref, name, inventory_id, price, status, source, ordered, due, customer,
# owner, type, remarks, original_ref
RETURNS = [
    ("WC-R108", "Walnut chopping board", 7, "64.00", "delivered", "facebook", -28, -21, 7, 3, "refund", "Arrived with a hairline crack along the grain.", "WC-1041"),
    ("WC-R112", "Maple serving bowl", 6, "85.00", "in_transit", "instagram", -9, 3, 4, 3, "exchange", "Wrong size sent, customer ordered the large.", "WC-1033"),
    ("WC-R114", "Oak framed mirror", 8, "210.00", "processing", "website", -3, 11, 6, 2, "exchange_modified", "Customer would like the frame stained darker.", "WC-1038"),
]

# customer_id, item_count, value, source, days_since_update
CARTS = [
    (1, 3, "2195.00", "website", -0.2),
    (4, 2, "295.00", "instagram", -0.5),
    (6, 4, "1684.00", "website", -1),
    (8, 2, "1504.00", "facebook", -2),
    (3, 1, "85.00", "direct", -3),
    (5, 5, "2810.00", "instagram", -4),
    (7, 1, "64.00", "website", -6),
]

# title, due_days, is_done, priority, assignee_id, attach_kind, attach_id
TASKS = [
    ("Call about fleet rollout renewal", -3, False, "high_priority", 1, "lead", 1),
    ("Chase signed contract", -1, False, "overrider", 1, "order", 1),
    ("Send revised pricing to Priya", 0, False, "medium_priority", 1, "lead", 2),
    ("Book technical walkthrough", 0, False, "high_priority", 2, "order", 4),
    ("Prepare Vertex compliance demo", 1, False, "overrider", 2, "order", 4),
    ("Follow up on security questionnaire", 2, False, "high_priority", 2, "lead", 5),
    ("Draft clinic pilot success criteria", 3, False, "high_priority", 1, "order", 5),
    ("Confirm Brightline deployment scope", 5, False, "high_priority", 1, "customer", 3),
    ("Collect plant system requirements", 6, False, "medium_priority", 3, "order", 7),
    ("Send training tier comparison", 8, False, "low_priority", 3, "lead", 11),
    ("Quarterly review with Copperfield", 11, False, "medium_priority", 2, "customer", 4),
    ("Onboarding kickoff call", 13, False, "medium_priority", 3, "customer", 5),
    ("Check Heron Bay pilot metrics", 16, False, "low_priority", 3, "order", 12),
    ("Renew Pinehurst site licence", 21, False, "medium_priority", 2, "customer", 8),
    ("Review Kestrel account health", 27, False, "low_priority", 3, "organisation", 4),
    ("Plan Q1 logistics campaign", 34, False, "medium_priority", 1, "campaign", 1),
    ("Re-engage Orion Media", 40, False, "expendable", 3, "organisation", 5),
    ("Intro call with Tom Bergstrom", None, False, "low_priority", 1, "lead", 3),
    ("Update Northwind contact details", None, False, "expendable", 2, "organisation", 1),
    ("Send Vertex enterprise proposal", -12, True, "overrider", 2, "order", 3),
    ("Log Brightline discovery notes", -7, True, "medium_priority", 1, "lead", 7),
    ("Close out Orion opportunity", -5, True, "low_priority", 3, "order", 9),
]

ATTACH_COLUMN = {
    "lead": "lead_id",
    "order": "order_id",
    "customer": "customer_id",
    "organisation": "organisation_id",
    "campaign": "campaign_id",
}


def seed_inventory(db):
    for row in INVENTORY:
        (sku, name, item_class, category, wood_type, unit, quantity,
         reorder_level, unit_price, image) = row
        db.add(InventoryItem(
            sku=sku,
            name=name,
            item_class=item_class,
            category=category,
            wood_type=wood_type,
            unit=unit,
            quantity=quantity,
            reorder_level=reorder_level,
            unit_price=unit_price,
            image=image,
            created_at=at(-120),
            updated_at=at(-120),
        ))
    db.commit()
    print(f"created {len(INVENTORY)} inventory items")


def seed_orders(db):
    """
    Deliveries first, then returns, because each return points back at the
    delivery it reverses and needs that row's id to exist.
    """
    images = {item.id: item.image for item in db.query(InventoryItem).all()}

    for row in DELIVERIES:
        (order_ref, name, inventory_id, price, deposit_paid, delivery_status,
         source, ordered, due, customer_id, owner_id, priority_lvl,
         stock_status) = row
        db.add(Order(
            order_ref=order_ref,
            name=name,
            inventory_id=inventory_id,
            price=price,
            deposit_paid=deposit_paid,
            image=images.get(inventory_id),
            kind="delivery",
            delivery_status=delivery_status,
            source=source,
            stock_status=stock_status,
            priority_lvl=priority_lvl,
            ordered_at=at(ordered),
            delivery_due=at(due),
            # Only a delivered order has a delivery date. Stamping every row
            # would make lead time averages meaningless.
            delivered_at=at(due) if delivery_status == "delivered" else None,
            customer_id=customer_id,
            owner_id=owner_id,
            created_at=at(ordered),
            updated_at=at(ordered),
        ))
    db.commit()
    print(f"created {len(DELIVERIES)} delivery orders")

    originals = {o.order_ref: o.id for o in db.query(Order).all()}

    for row in RETURNS:
        (order_ref, name, inventory_id, price, delivery_status, source,
         ordered, due, customer_id, owner_id, return_type, remarks,
         original_ref) = row
        db.add(Order(
            order_ref=order_ref,
            name=name,
            inventory_id=inventory_id,
            price=price,
            deposit_paid="0.00",
            image=images.get(inventory_id),
            kind="return",
            delivery_status=delivery_status,
            source=source,
            stock_status="fulfilled",
            priority_lvl="medium_priority",
            ordered_at=at(ordered),
            delivery_due=at(due),
            delivered_at=at(due) if delivery_status == "delivered" else None,
            customer_id=customer_id,
            owner_id=owner_id,
            return_type=return_type,
            remarks=remarks,
            returns_order_id=originals.get(original_ref),
            created_at=at(ordered),
            updated_at=at(ordered),
        ))
    db.commit()
    print(f"created {len(RETURNS)} returns")


def seed_carts(db):
    for customer_id, item_count, value, source, days in CARTS:
        db.add(Cart(
            customer_id=customer_id,
            item_count=item_count,
            value=value,
            source=source,
            updated_at=at(days),
        ))
    db.commit()
    print(f"created {len(CARTS)} carts")


def seed_tasks(db):
    """
    Seeded last: a task can point at a lead, order, customer, organisation or
    campaign, so every one of those has to exist first or the foreign key
    fails.
    """
    for title, due, is_done, priority_lvl, assignee_id, kind, ref in TASKS:
        task = Task(
            title=title,
            due_date=None if due is None else at(due),
            is_done=is_done,
            completed_at=at(due + 1) if is_done else None,
            priority_lvl=priority_lvl,
            assignee_id=assignee_id,
            created_at=at(-20 if due is None else min(due - 5, -1)),
            updated_at=at(-20 if due is None else min(due - 5, -1)),
        )
        setattr(task, ATTACH_COLUMN[kind], ref)
        db.add(task)
    db.commit()
    print(f"created {len(TASKS)} tasks")


def backfill_source(db):
    """
    Give leads, customers and campaigns a source.

    Assigned from each row's id rather than at random, so the figures on
    Statistics are the same after every reseed. A number that moves on reload
    cannot be checked against anything.
    """
    from models.campaign import Campaign
    from models.customer import Customer
    from models.lead import Lead

    cycle = ["website", "instagram", "facebook", "direct"]
    for model, offset in [(Lead, 0), (Customer, 1), (Campaign, 2)]:
        for row in db.query(model).all():
            row.source = cycle[(row.id + offset) % len(cycle)]
    db.commit()
    print("backfilled source on leads, customers and campaigns")
