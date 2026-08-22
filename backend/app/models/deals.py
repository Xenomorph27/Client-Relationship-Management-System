from sqlalchemy import Column, DECIMAL, Integer, String , ForeignKey
from sqlalchemy.orm import relationships
from db.database import Base
from app.enums import Priority_Level

class Deal(Base):
	__tablename__="deals"
	id=Column(Integer, primary_key=True, index=True)
	name=Column(String, index=True, nullable=False)
	amount=Column(DECIMAL(10,2))
	stage=Column(String)
	initiated_at=Column(DateTIme, default=func.now(), nullable=False)
	expiry_date=Column(DateTIme, nullable=True)
	priority_lvl=Column(Enum(Priority_Level, name="Priority_lvl"), default=Priority_Level.low_priority, nullable=False)
	lead_id=Column(Integer, ForeignKey("leads.id"))
	customer_id=Column(Integer, ForeignKey("customers.id")


	lead = relationship("Lead", back_populates="deal")
    customer = relationship("Customer", back_populates="deal")

