from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from crud import crud_customer
from database.database import get_db
from schemas.customer import Customer, CustomerCreate

router = APIRouter(prefix="/customers", tags=["customers"])

@router.post("/", response_model=Customer)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    return crud_customer.add_customer(db, **payload.model_dump())

@router.get("/", response_model=List[Customer])
def list_customers(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    return crud_customer.get_all_customers(db, skip=skip, limit=limit)

@router.get("/{customer_id}", response_model=Customer)
def read_customer(customer_id: int, db: Session = Depends(get_db)):
    db_customer = crud_customer.get_customer(db, customer_id)
    if db_customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return db_customer
