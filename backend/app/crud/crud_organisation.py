from sqlalchemy.orm import Session
from models.organisations import Organisation
from schemas.organisation import OrganisationCreate
def create_organisation(db: Session, name: str, website: str = None, industry: str = None, official_email: str = None, support_contact: str = None, priority_lvl: str = None):
    db_organisation = Organisation(name=name, website=website, industry=industry, official_email=official_email, support_contact=support_contact)
    if priority_lvl:
        db_organisation.priority_lvl = priority_lvl
    db.add(db_organisation)
    db.commit()
    db.refresh(db_organisation)
    return db_organisation
def get_organisation(db: Session, organisation_id: int):
    return db.query(Organisation).filter(Organisation.id == organisation_id).first()
def get_all_organisations(db: Session, skip: int = 0, limit: int = 10):
    return db.query(Organisation).offset(skip).limit(limit).all()