from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from crud import crud_campaign
from database.database import get_db
from schemas.campaign import Campaign, CampaignCreate

router = APIRouter(prefix="/campaigns", tags=["campaigns"])

@router.post("/", response_model=Campaign)
def create_campaign(payload: CampaignCreate, db: Session = Depends(get_db)):
    return crud_campaign.add_campaign(db, **payload.model_dump())

@router.get("/", response_model=List[Campaign])
def list_campaigns(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    return crud_campaign.get_all_campaigns(db, skip=skip, limit=limit)

@router.get("/{campaign_id}", response_model=Campaign)
def read_campaign(campaign_id: int, db: Session = Depends(get_db)):
    db_campaign = crud_campaign.get_campaign(db, campaign_id)
    if db_campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return db_campaign
