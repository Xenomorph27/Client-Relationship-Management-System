from sqlalchemy.orm import Session
from models.lead import Lead
from schemas.lead import LeadCreate

def create_lead(db: Session, name: str, email: str = None, phone: str = None, status: str = None, organisation_id: int = None, priority_lvl: str = None, source: str = None):
    db_lead = Lead(name=name, email=email, phone=phone, status=status, organisation_id=organisation_id, source=source)
    if priority_lvl:
        db_lead.priority_lvl = priority_lvl
    db.add(db_lead)
    db.commit()
    db.refresh(db_lead)
    return db_lead

def get_lead(db: Session, lead_id: int):
    return db.query(Lead).filter(Lead.id == lead_id).first()

def get_all_leads(db: Session, skip: int = 0, limit: int = 10):
    return db.query(Lead).offset(skip).limit(limit).all()


def update_lead(db: Session, lead_id: int, payload: "LeadUpdate"):
    """exclude_unset is what makes this a real PATCH: a field the client did
    not send stays untouched, instead of being overwritten with None."""
    row = get_lead(db, lead_id)
    if row is None:
        return None
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


def delete_lead(db: Session, lead_id: int) -> bool:
    row = get_lead(db, lead_id)
    if row is None:
        return False
    db.delete(row)
    db.commit()
    return True
