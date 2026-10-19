from sqlalchemy import Column, DateTime, Integer, String, func, Enum, ForeignKey
from sqlalchemy.orm import relationship
from database.database import Base
from models.enums import Priority_Level, Source, pg_enum

class Lead(Base):
    __tablename__ = "leads"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    email = Column(String, index=True)
    phone = Column(String)
    status = Column(String)
    # Where this record came from. Nullable because rows created before
    # channel tracking existed genuinely do not know.
    source = Column(pg_enum(Source, "source"), nullable=True, index=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now())
    priority_lvl = Column(Enum(Priority_Level, name="Priority_lvl"), default=Priority_Level.low_priority, nullable=False)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=True)

    message = relationship("Email", back_populates="lead")
    organisation = relationship("Organisation", back_populates="leads")