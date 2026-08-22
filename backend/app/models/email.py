from sqlalchemy import Boolean, Column, DateTime, Integer, String, ForeignKey, func
from sqlalchemy.orm import relationship
from db.database import Base
from app.enums import Priority_Level


class Email(Base):
    __tablename__ = "emails"
    id = Column(Integer, primary_key=True, index=True)
    subject = Column(String)
    body = Column(String)
    sender = Column(String, nullable=False)
    recipient = Column(String, nullable=False)
    sendgrid_email_id = Column(String)
    sent_at = Column(DateTime, default=func.now())
    is_opened = Column(Boolean, default=False)
    lead_id = Column(Integer, ForeignKey("leads.id"))
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    priority_lvl=Column(Enum(Priority_Level, name="Priority_lvl"), default=Priority_Level.low_priority, nullable=False)


    lead = relationship("Lead", back_populates="message")
    customer = relationship("Customer", back_populates="emails")