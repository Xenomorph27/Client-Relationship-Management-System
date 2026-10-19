from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from crud import crud_organisation
from database.database import get_db
from schemas.organisation import Organisation, OrganisationCreate, OrganisationUpdate

router = APIRouter(prefix="/organisations", tags=["organisations"])

@router.post("/", response_model=Organisation)
def create_organisation(payload: OrganisationCreate, db: Session = Depends(get_db)):
    return crud_organisation.create_organisation(db, **payload.model_dump())

@router.get("/", response_model=List[Organisation])
def list_organisations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud_organisation.get_all_organisations(db, skip=skip, limit=limit)

@router.get("/{organisation_id}", response_model=Organisation)
def read_organisation(organisation_id: int, db: Session = Depends(get_db)):
    db_organisation = crud_organisation.get_organisation(db, organisation_id)
    if db_organisation is None:
        raise HTTPException(status_code=404, detail="Organisation not found")
    return db_organisation

@router.patch("/{organisation_id}", response_model=Organisation)
def patch_organisation(organisation_id: int, payload: OrganisationUpdate, db: Session = Depends(get_db)):
    updated = crud_organisation.update_organisation(db, organisation_id, payload)
    if updated is None:
        raise HTTPException(status_code=404, detail="Organisation not found")
    return updated

@router.delete("/{organisation_id}", status_code=204)
def remove_organisation(organisation_id: int, db: Session = Depends(get_db)):
    if not crud_organisation.delete_organisation(db, organisation_id):
        raise HTTPException(status_code=404, detail="Organisation not found")
    return None
