from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from crud import crud_email
from database.database import get_db
from schemas.email import Email, EmailCreate

router = APIRouter(prefix="/emails", tags=["emails"])

@router.post("/", response_model=Email)
def create_email(payload: EmailCreate, db: Session = Depends(get_db)):
    return crud_email.create_email(db, **payload.model_dump())

@router.get("/", response_model=List[Email])
def list_emails(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    return crud_email.get_all_emails(db, skip=skip, limit=limit)

@router.get("/{email_id}", response_model=Email)
def read_email(email_id: int, db: Session = Depends(get_db)):
    db_email = crud_email.get_email(db, email_id)
    if db_email is None:
        raise HTTPException(status_code=404, detail="Email not found")
    return db_email
