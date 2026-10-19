from sqlalchemy import Column, DECIMAL, DateTime, Integer, String, func, Enum
from sqlalchemy.orm import relationship
from database.database import Base
from models.enums import Item_Class, Unit, pg_enum


class InventoryItem(Base):
    """
    Finished pieces and raw materials in one table, separated by item_class.

    quantity is what the stock rule decrements when an order is placed, so it
    is NOT NULL with a server default of 0 - a NULL here would make
    "quantity > 0" neither true nor false and the guard would silently pass.
    """

    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(32), unique=True, index=True, nullable=False)
    name = Column(String, index=True, nullable=False)
    item_class = Column(
        pg_enum(Item_Class, "item_class"),
        default=Item_Class.product,
        nullable=False,
        index=True,
    )
    category = Column(String(64), index=True)
    # Only meaningful for timber and finished pieces. Fittings and finishes
    # legitimately have no wood type, so this stays nullable.
    wood_type = Column(String(64), nullable=True)
    unit = Column(pg_enum(Unit, "unit"), default=Unit.piece, nullable=False)
    quantity = Column(Integer, nullable=False, server_default="0")
    reorder_level = Column(Integer, nullable=False, server_default="0")
    unit_price = Column(DECIMAL(10, 2))
    # Filename only, e.g. "oak-dining-table.jpg". The frontend resolves it
    # against /orders/, so moving where images are hosted does not touch rows.
    image = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    orders = relationship("Order", back_populates="inventory_item")
