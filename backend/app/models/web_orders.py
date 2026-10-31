from sqlalchemy import Column, DECIMAL, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship
from database.database import Base


class WebOrder(Base):
    """
    One order as the online shop sees it: the basket, the address, the payment.

    The CRM's Order is ONE PIECE (one row per item, so the stock rule can run per
    piece). Everything that belongs to the whole purchase rather than to a piece
    lives here instead of being copied onto every piece row, where three copies
    of an address could drift apart:

        web_orders 1057  ── delivery address, method, payment, total, note
            ├── orders WEB-1057-1   Honey dipper
            ├── orders WEB-1057-2   Honey dipper
            └── orders WEB-1057-3   Walnut salad bowl

    Kept current from every webhook and catch-up run, so `status` always
    mirrors the shop. Only orders the CRM has taken in (or reversed) are stored:
    an abandoned unpaid checkout is someone else's personal data we have no
    reason to keep.
    """

    __tablename__ = "web_orders"

    id = Column(Integer, primary_key=True, index=True)
    # The shop's own ids. woo_id is what the shop's admin links use; number is
    # what the customer sees on their receipt (usually the same, not always).
    woo_id = Column(Integer, unique=True, index=True, nullable=False)
    number = Column(String(32), index=True, nullable=False)
    status = Column(String(32), index=True, nullable=False)

    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    billing_name = Column(String, nullable=True)

    # Where it goes. Falls back to the billing address when the customer did
    # not give a separate delivery address, so this is always the one to use.
    ship_name = Column(String, nullable=True)
    ship_company = Column(String, nullable=True)
    ship_address_1 = Column(String, nullable=True)
    ship_address_2 = Column(String, nullable=True)
    ship_city = Column(String, nullable=True)
    ship_county = Column(String, nullable=True)
    ship_postcode = Column(String(16), nullable=True, index=True)
    ship_country = Column(String(2), nullable=True)
    shipping_method = Column(String, nullable=True)  # e.g. "UK Standard Delivery", "Collect from the workshop"
    shipping_total = Column(DECIMAL(10, 2), nullable=False, server_default="0")

    total = Column(DECIMAL(10, 2), nullable=False, server_default="0")
    currency = Column(String(3), nullable=False, server_default="GBP")
    payment_method = Column(String, nullable=True)
    customer_note = Column(String, nullable=True)

    placed_at = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    customer = relationship("Customer")
    pieces = relationship("Order", back_populates="web_order", order_by="Order.order_ref")
