from sqlalchemy import (
    Column,
    DECIMAL,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import relationship
from database.database import Base
from models.enums import (
    Delivery_Status,
    Order_Kind,
    Priority_Level,
    Return_Type,
    Source,
    Stock_Status,
    pg_enum,
)


class Order(Base):
    """
    The money object. Replaces Deal.

    Deliveries and returns share this table, told apart by `kind`. A return is
    the same document inverted: same customer, same piece, same price, flowing
    the other way. Keeping them together is what lets the Logistics board be a
    VIEW over the Orders ledger rather than a second list that can disagree
    with it.

    No `balance` column: it is price - deposit_paid, so storing it would create
    a second version of the truth that can fall out of step with the first.
    Same reason there is no `sl_no` - that is the row's position in whatever
    the current view is, and a stored one breaks on the first delete or re-sort.
    """

    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    # Human-facing reference, e.g. "WC-1042". Unique so it can be quoted to a
    # customer and searched on.
    order_ref = Column(String(32), unique=True, index=True, nullable=False)
    name = Column(String, index=True, nullable=False)
    price = Column(DECIMAL(10, 2), nullable=False, server_default="0")
    deposit_paid = Column(DECIMAL(10, 2), nullable=False, server_default="0")
    # Denormalised from the inventory item at order time ON PURPOSE: the photo
    # of what was actually sold should not change later because the catalogue
    # picture was replaced.
    image = Column(String, nullable=True)

    kind = Column(
        pg_enum(Order_Kind, "order_kind"),
        default=Order_Kind.delivery,
        nullable=False,
        index=True,
    )
    delivery_status = Column(
        pg_enum(Delivery_Status, "delivery_status"),
        default=Delivery_Status.processing,
        nullable=False,
        index=True,
    )
    source = Column(
        pg_enum(Source, "source"), default=Source.direct, nullable=False, index=True
    )
    stock_status = Column(
        pg_enum(Stock_Status, "stock_status"),
        default=Stock_Status.fulfilled,
        nullable=False,
        index=True,
    )
    priority_lvl = Column(
        Enum(Priority_Level, name="Priority_lvl"),
        default=Priority_Level.low_priority,
        nullable=False,
    )

    ordered_at = Column(DateTime, default=func.now(), nullable=False)
    delivery_due = Column(DateTime, nullable=True)
    # Set only when delivery_status reaches "delivered". This is the column
    # deals never had: real cycle time, and therefore lead time by category,
    # is derivable from it. Deals only knew when a deal LAPSED.
    delivered_at = Column(DateTime, nullable=True)

    inventory_id = Column(
        Integer, ForeignKey("inventory.id", ondelete="SET NULL"), nullable=True
    )
    customer_id = Column(
        Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True
    )
    owner_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # The shop order this piece came from (address, payment, receipt number).
    # NULL for orders entered in the CRM directly.
    web_order_id = Column(
        Integer, ForeignKey("web_orders.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Returns only; NULL on a delivery.
    return_type = Column(pg_enum(Return_Type, "return_type"), nullable=True)
    # Why it came back, or what modification is wanted. Legitimately empty.
    remarks = Column(String, nullable=True)
    # The original delivery this return reverses. Self-referential, so a
    # return can be traced to what was sold.
    returns_order_id = Column(
        Integer, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True
    )

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    inventory_item = relationship("InventoryItem", back_populates="orders")
    customer = relationship("Customer", back_populates="orders")
    owner = relationship("User", back_populates="orders")
    tasks = relationship("Task", back_populates="order")
    web_order = relationship("WebOrder", back_populates="pieces")
    # remote_side pins which end of the self-join is the parent, otherwise
    # SQLAlchemy cannot tell the direction and refuses to map it.
    original_order = relationship(
        "Order", remote_side=[id], backref="return_orders"
    )
