from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from crud import crud_organisation
from database.database import get_db
from schemas.organisation import Organisation, OrganisationCreate

router = APIRouter(prefix="/organisations", tags=["organisations"])

@router.post("/", response_model=Organisation)
def create_organisation(payload: OrganisationCreate, db: Session = Depends(get_db)):
    return crud_organisation.create_organisation(db, **payload.model_dump())

@router.get("/", response_model=List[Organisation])
def list_organisations(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    return crud_organisation.get_all_organisations(db, skip=skip, limit=limit)

@router.get("/{organisation_id}", response_model=Organisation)
def read_organisation(organisation_id: int, db: Session = Depends(get_db)):
    db_organisation = crud_organisation.get_organisation(db, organisation_id)
    if db_organisation is None:
        raise HTTPException(status_code=404, detail="Organisation not found")
    return db_organisation
