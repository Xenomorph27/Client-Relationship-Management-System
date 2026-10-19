from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import relationship
from database.database import Base
from models.enums import Priority_Level


class Task(Base):
    """
    A piece of work, optionally attached to one record and always owned by
    somebody.

    The five nullable foreign keys follow the pattern Email already uses
    (lead_id plus customer_id) rather than a generic (entity_type, entity_id)
    pair. A generic pair cannot be a foreign key, so nothing stops it pointing
    at a row that no longer exists; these get real referential integrity and
    the ON DELETE behaviour is the database's problem, not the API's.

    The stock rule writes here: an order that cannot be filled from stock
    raises "Make <item> - not in stock" against the order, which is how a
    shortfall becomes someone's job instead of a badge nobody reads.
    """

    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    notes = Column(String, nullable=True)
    due_date = Column(DateTime, nullable=True)
    is_done = Column(Boolean, nullable=False, server_default="false", index=True)
    # Written when is_done flips to true, cleared when it flips back. Kept
    # beside is_done rather than inferred, because "when was this finished"
    # cannot be recovered from a boolean afterwards.
    completed_at = Column(DateTime, nullable=True)
    priority_lvl = Column(
        Enum(Priority_Level, name="Priority_lvl"),
        default=Priority_Level.medium_priority,
        nullable=False,
    )

    assignee_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # At most one of these is set. Deleting the thing a task is about should
    # not delete the task, so these are SET NULL and the task survives as
    # orphaned work rather than disappearing silently.
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="SET NULL"), nullable=True)
    order_id = Column(
        Integer, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True
    )
    customer_id = Column(
        Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True
    )
    organisation_id = Column(
        Integer, ForeignKey("organisations.id", ondelete="SET NULL"), nullable=True
    )
    campaign_id = Column(
        Integer, ForeignKey("campaigns.id", ondelete="SET NULL"), nullable=True
    )

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    assignee = relationship("User", back_populates="tasks")
    order = relationship("Order", back_populates="tasks")
