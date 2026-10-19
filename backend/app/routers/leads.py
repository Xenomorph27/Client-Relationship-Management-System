from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from crud import crud_lead
from database.database import get_db
from schemas.lead import Lead, LeadCreate

router = APIRouter(prefix="/leads", tags=["leads"])

@router.post("/", response_model=Lead)
def create_lead(payload: LeadCreate, db: Session = Depends(get_db)):
    return crud_lead.create_lead(db, **payload.model_dump())

@router.get("/", response_model=List[Lead])
def list_leads(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    return crud_lead.get_all_leads(db, skip=skip, limit=limit)

@router.get("/{lead_id}", response_model=Lead)
def read_lead(lead_id: int, db: Session = Depends(get_db)):
    db_lead = crud_lead.get_lead(db, lead_id)
    if db_lead is None:
        raise HTTPException(status_code=404, detail="Lead not found")
    return db_lead
