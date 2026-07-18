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
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
