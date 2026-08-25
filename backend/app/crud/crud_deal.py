from datetime import datetime
from sqlalchemy.orm import Session
from models.deals import Deal
from schemas.deal import DealCreate
def create_deal(db: Session, name: str, amount: float, stage: str, lead_id: int = None, customer_id: int = None, expiry_date: datetime = None, priority_lvl: str = None):
    db_deal = Deal(name=name, amount=amount, stage=stage, lead_id=lead_id, customer_id=customer_id, expiry_date=expiry_date)
    if priority_lvl:
        db_deal.priority_lvl = priority_lvl
    db.add(db_deal)
    db.commit()
    db.refresh(db_deal)
    return db_deal
def get_deal(db: Session, deal_id: int):
    return db.query(Deal).filter(Deal.id == deal_id).first()
def get_all_deals(db: Session, skip: int = 0, limit: int = 10):
    return db.query(Deal).offset(skip).limit(limit).all()