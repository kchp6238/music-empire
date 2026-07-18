from datetime import datetime

from pydantic import BaseModel


class CharacterCreate(BaseModel):
    artist_name: str
    background_id: str


class CharacterOut(BaseModel):
    id: str
    user_id: str
    artist_name: str
    background_id: str
    background_name: str
    stats: dict
    talent: dict
    fame: float
    money: float
    fans_count: int
    total_streams: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OfflineSummary(BaseModel):
    elapsed_days: float
    fans_delta: int
    streaming_income: float
    new_streams: int


class CharacterMeResponse(BaseModel):
    character: CharacterOut
    offline_summary: OfflineSummary | None = None
