from datetime import datetime
from sqlalchemy.orm import Session
from models.campaign import Campaign
from schemas.campaign import CampaignCreate

def add_campaign(db: Session, name: str, html_content: str = None, start_date: datetime = None, end_date: datetime = None, description: str = None, priority_lvl: str = None, source: str = None):
    db_campaign = Campaign(name=name, html_content=html_content, start_date=start_date, end_date=end_date, description=description, source=source)
    if priority_lvl:
        db_campaign.priority_lvl = priority_lvl
    db.add(db_campaign)
    db.commit()
    db.refresh(db_campaign)
    return db_campaign

def get_campaign(db: Session, campaign_id: int):
    return db.query(Campaign).filter(Campaign.id == campaign_id).first()

def get_all_campaigns(db: Session, skip: int = 0, limit: int = 10):
    return db.query(Campaign).offset(skip).limit(limit).all()


def update_campaign(db: Session, campaign_id: int, payload: "CampaignUpdate"):
    """exclude_unset is what makes this a real PATCH: a field the client did
    not send stays untouched, instead of being overwritten with None."""
    row = get_campaign(db, campaign_id)
    if row is None:
        return None
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


def delete_campaign(db: Session, campaign_id: int) -> bool:
    row = get_campaign(db, campaign_id)
    if row is None:
        return False
    db.delete(row)
    db.commit()
    return True
