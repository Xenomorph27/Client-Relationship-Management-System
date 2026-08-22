from sqlalchemy import Columns, DateTime, Integer, func
from sqlalchemy.orm import relationship
from db.database import Base
from app.enums import Priority_Level

class Customer(Base):
	__tablename__="customers"
	id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    email = Column(String, index=True)
    phone = Column(String,index =True)
    priority_lvl=Column(Enum(Priority_Level, name="Priority_lvl"), default=Priority_Level.low_priority, nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now())


    deal = relationship("Deal", back_populates="customer")
