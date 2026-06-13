from pydantic import BaseModel, Field
from pydantic import ConfigDict
from typing import Optional
from datetime import date, datetime
from enum import Enum


class CampaignStatus(str, Enum):
    draft = 'draft'
    active = 'active'
    completed = 'completed'
    cancelled = 'cancelled'


class CampaignBase(BaseModel):
    influencer_name: Optional[str] = Field(
        default=None,
        max_length=255,
        description="The full name or persona of the influencer.",
        json_schema_extra={"examples": ["Riya Sharma"]}
    )
    influencer_handle: Optional[str] = Field(
        default=None,
        max_length=255,
        description="The influencer's social media handle, typically starting with @.",
        json_schema_extra={"examples": ["@riya_creates"]}
    )
    platform: Optional[str] = Field(
        default=None,
        max_length=100,
        description="The primary social media platform for the campaign.",
        json_schema_extra={"examples": ["Instagram"]}
    )
    deliverables: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Detailed description of what the influencer is expected to produce.",
        json_schema_extra={"examples": ["1 Reel (30s) + 2 Story Frames with swipe-up link"]}
    )
    deadline: Optional[date] = Field(
        default=None,
        description="The date by which the deliverables must be posted.",
        json_schema_extra={"examples": ["2026-07-15"]}
    )
    payment_amount: float = Field(
        default=0.0,
        description="Total compensation in INR. Barter campaigns should be 0.0.",
        json_schema_extra={"examples": [15000.0]}
    )
    special_notes: Optional[str] = Field(
        default=None,
        max_length=5000,
        description="Any extra instructions, moodboard links, or AI extraction errors.",
        json_schema_extra={"examples": ["Make sure to tag the brand page in the first line of the caption."]}
    )
    status: CampaignStatus = Field(
        default=CampaignStatus.draft,
        description="Current stage of the campaign lifecycle."
    )


class CampaignCreate(CampaignBase):
    influencer_handle: str = Field(
        max_length=255,
        description="The influencer's handle is strictly required to create a new campaign record."
    )


class CampaignUpdate(CampaignBase):
    pass


class CampaignStatusUpdate(BaseModel):
    status: CampaignStatus = Field(
        description="The new status to apply to the campaign."
    )


class CampaignResponse(CampaignBase):
    """
    Response model for campaign data returned from the API.

    Uses model_config with json_encoders to globally handle serialization of
    Python date/datetime objects → ISO 8601 strings. This is the recommended
    Pydantic v2 approach: it runs at the model level before FastAPI's JSON
    encoder, so every route returning CampaignResponse is covered automatically
    without any per-route conversion logic.
    """

    model_config = ConfigDict(
        # Serialize date → "YYYY-MM-DD", datetime → full ISO string.
        # None values are passed through untouched (no KeyError risk).
        json_encoders={
            date: lambda v: v.isoformat() if v is not None else None,
            datetime: lambda v: v.isoformat() if v is not None else None,
        }
    )

    id: str = Field(description="The unique UUID of the campaign in the database.")
    user_id: str = Field(description="The UUID of the brand/user who owns this campaign.")
    created_at: str = Field(description="ISO-8601 timestamp of creation.")
    updated_at: str = Field(description="ISO-8601 timestamp of the last update.")


class ExtractionResult(CampaignBase):
    requires_human_review: bool = Field(
        default=False,
        description="Set to true if the AI failed to extract mandatory fields or if an error occurred."
    )
