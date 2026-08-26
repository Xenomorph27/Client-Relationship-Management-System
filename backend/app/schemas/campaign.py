from typing import Optional
from datetime import datetime
from pydantic import BaseModel,Field
from models.enums import Priority_Level

class CampaignBase(BaseModel):
	name:str
	html_content:Optional[str]=None
	start_date:Optional[datetime]=None
	end_date:Optional[datetime]=None
	description:Optional[str]=None
	priority_lvl:Optional[Priority_Level]=None

class CampaignCreate(CampaignBase):
    pass

class Campaign(CampaignBase):
    id: int
    priority_lvl: Priority_Level
    class Config:
        from_attributes = True