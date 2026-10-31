from sqlalchemy import Column, DateTime, String, func
from database.database import Base


class IntegrationState(Base):
    """
    Small key/value notes the integrations keep for themselves, e.g. how far
    the WooCommerce catch-up sync has got.

    Kept in the database rather than in memory because the server restarts
    (every deploy, every free-tier sleep), and a sync that forgets where it was
    either re-reads everything or, worse, skips the gap.
    """

    __tablename__ = "integration_state"

    key = Column(String(64), primary_key=True)
    value = Column(String, nullable=True)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
