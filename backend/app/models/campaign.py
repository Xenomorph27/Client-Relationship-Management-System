from sqlalchemy import Column, Integer, Enum, DateTime, String, func
from sqlalchemy.orm import relationship
from database.database import Base
from models.enums import Priority_Level, Source, pg_enum

class Campaign(Base):
    __tablename__ = "campaigns"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    html_content = Column(String)
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    description = Column(String)
    # Where this record came from. Nullable because rows created before
    # channel tracking existed genuinely do not know.
    source = Column(pg_enum(Source, "source"), nullable=True, index=True)
    priority_lvl = Column(Enum(Priority_Level, name="Priority_lvl"), default=Priority_Level.low_priority, nullable=False)