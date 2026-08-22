from sqlalchemy import Column, DateTime, String, func
from sqlalchemy.orm import relationship
from db.database import Base
from app.enums import Priority_Level

class Campaign(Base):
	__tablename__ = "campaigns"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    html_content = Column(String)
    # sendgrid_campaign_id = Column(String) !Under Investigation!
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    description = Column(String)
    priority_lvl=Column(Enum(Priority_Level, name="Priority_lvl"), default=Priority_Level.low_priority, nullable=False)

