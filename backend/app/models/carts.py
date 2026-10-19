from sqlalchemy import Column, DECIMAL, DateTime, Enum, ForeignKey, Integer, func
from sqlalchemy.orm import relationship
from database.database import Base
from models.enums import Source, pg_enum


class Cart(Base):
    """
    An open basket on the storefront. Feeds the Prospects column on Insights.

    Shaped like the payload a shop front would POST, so connecting the real
    website later is a data swap rather than a redesign. item_count and value
    are stored rather than derived because the storefront owns the line items
    and this table only mirrors the summary it sends.
    """

    __tablename__ = "carts"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(
        Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=True
    )
    item_count = Column(Integer, nullable=False, server_default="0")
    value = Column(DECIMAL(10, 2), nullable=False, server_default="0")
    source = Column(
        pg_enum(Source, "source"), default=Source.website, nullable=False, index=True
    )
    # No created_at: a cart is only interesting as of its last change. How long
    # it has been sitting there is what makes it a prospect or a dead basket.
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    customer = relationship("Customer", back_populates="carts")
