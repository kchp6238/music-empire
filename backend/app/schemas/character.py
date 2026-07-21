from datetime import datetime, date

from pydantic import BaseModel


class CharacterCreate(BaseModel):
    artist_name: str
    background_id: str
    world_id: str


class CharacterOut(BaseModel):
    id: str
    user_id: str
    world_id: str
    artist_name: str
    background_id: str
    background_name: str
    stats: dict
    talent: dict
    fame: float
    money: float
    fans_count: int
    total_streams: int
    game_date: date
    birth_date: date
    age: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CharacterMeResponse(BaseModel):
    character: CharacterOut


class TimeSummary(BaseModel):
    """What happened while the calendar moved — shown after any timed action."""
    days: int
    reason: str = ""
    from_date: date
    to_date: date
    age: int
    season: str
    fans_delta: int
    streaming_income: float
    new_streams: int
    weeks_settled: int
    seasons_settled: list[dict] = []


class TrainRequest(BaseModel):
    stat: str


class TimedActionResult(BaseModel):
    character: CharacterOut
    time: TimeSummary
    message: str = ""


class SeasonRecordOut(BaseModel):
    season_index: int
    label: str
    ended_on: date
    age: int
    fame: float
    money: float
    fans_count: int
    total_streams: int
    releases_this_season: int
    best_song: dict | None

    model_config = {"from_attributes": True}
