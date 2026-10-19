from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from crud import crud_deal
from database.database import get_db
from schemas.deal import Deal, DealCreate

router = APIRouter(prefix="/deals", tags=["deals"])

@router.post("/", response_model=Deal)
def create_deal(payload: DealCreate, db: Session = Depends(get_db)):
    return crud_deal.create_deal(db, **payload.model_dump())

@router.get("/", response_model=List[Deal])
def list_deals(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    return crud_deal.get_all_deals(db, skip=skip, limit=limit)

@router.get("/{deal_id}", response_model=Deal)
def read_deal(deal_id: int, db: Session = Depends(get_db)):
    db_deal = crud_deal.get_deal(db, deal_id)
    if db_deal is None:
        raise HTTPException(status_code=404, detail="Deal not found")
    return db_deal
