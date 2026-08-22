from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.orm import relationship
from app.database import Base
from app.enums import Priority_Level

class Organization(Base):
    __tablename__ = "organizations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), index=True, nullable=False)
    website = Column(String, nullable=True)
    industry = Column(String, nullable=True)
    official_email = Column(String, nullable=True, index=True)
    support_contact = Column(String, nullable=True)
    priority_lvl=Column(Enum(Priority_Level, name="Priority_lvl"), default=Priority_Level.low_priority, nullable=False)

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now())

    leads = relationship("Lead", back_populates="organization")