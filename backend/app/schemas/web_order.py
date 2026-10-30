from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, computed_field

from settings import settings


class WebOrderPiece(BaseModel):
    """A CRM order (one piece) that belongs to this shop order."""

    id: int
    order_ref: str
    name: str
    price: Decimal
    delivery_status: str
    stock_status: str

    class Config:
        from_attributes = True


class WebOrder(BaseModel):
    id: int
    woo_id: int
    number: str
    status: str
    customer_id: Optional[int] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    billing_name: Optional[str] = None
    ship_name: Optional[str] = None
    ship_company: Optional[str] = None
    ship_address_1: Optional[str] = None
    ship_address_2: Optional[str] = None
    ship_city: Optional[str] = None
    ship_county: Optional[str] = None
    ship_postcode: Optional[str] = None
    ship_country: Optional[str] = None
    shipping_method: Optional[str] = None
    shipping_total: Decimal = Decimal("0")
    total: Decimal = Decimal("0")
    currency: str = "GBP"
    payment_method: Optional[str] = None
    customer_note: Optional[str] = None
    placed_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    pieces: List[WebOrderPiece] = []

    @computed_field
    @property
    def address_lines(self) -> List[str]:
        """The delivery address as printable lines, empty parts dropped."""
        city = " ".join(p for p in (self.ship_city, self.ship_postcode) if p)
        parts = [self.ship_name, self.ship_company, self.ship_address_1, self.ship_address_2, city, self.ship_county]
        if self.ship_country and self.ship_country != "GB":
            parts.append(self.ship_country)
        return [p for p in parts if p]

    @computed_field
    @property
    def shop_admin_url(self) -> Optional[str]:
        """This order in the WooCommerce admin. post.php redirects to the newer
        order screen when the shop uses it, so one link works for both."""
        if not settings.wc_url:
            return None
        return f"{settings.wc_url.rstrip('/')}/wp-admin/post.php?post={self.woo_id}&action=edit"

    class Config:
        from_attributes = True
