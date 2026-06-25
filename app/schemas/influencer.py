from pydantic import BaseModel, Field
from typing import Optional

class InfluencerProfileBase(BaseModel):
    name: Optional[str] = None
    platform: Optional[str] = None
    notes: Optional[str] = None

class InfluencerProfileUpdate(InfluencerProfileBase):
    pass

class InfluencerResponse(InfluencerProfileBase):
    handle: str
    total_campaigns: int = 0
    success_rate: float = 0.0
    last_collaboration: Optional[str] = None
