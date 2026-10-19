from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from crud import crud_campaign
from database.database import get_db
from schemas.campaign import Campaign, CampaignCreate, CampaignUpdate

router = APIRouter(prefix="/campaigns", tags=["campaigns"])

@router.post("/", response_model=Campaign)
def create_campaign(payload: CampaignCreate, db: Session = Depends(get_db)):
    return crud_campaign.add_campaign(db, **payload.model_dump())

@router.get("/", response_model=List[Campaign])
def list_campaigns(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud_campaign.get_all_campaigns(db, skip=skip, limit=limit)

@router.get("/{campaign_id}", response_model=Campaign)
def read_campaign(campaign_id: int, db: Session = Depends(get_db)):
    db_campaign = crud_campaign.get_campaign(db, campaign_id)
    if db_campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return db_campaign

@router.patch("/{campaign_id}", response_model=Campaign)
def patch_campaign(campaign_id: int, payload: CampaignUpdate, db: Session = Depends(get_db)):
    updated = crud_campaign.update_campaign(db, campaign_id, payload)
    if updated is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return updated

@router.delete("/{campaign_id}", status_code=204)
def remove_campaign(campaign_id: int, db: Session = Depends(get_db)):
    if not crud_campaign.delete_campaign(db, campaign_id):
        raise HTTPException(status_code=404, detail="Campaign not found")
    return None
