from datetime import date
from pydantic import BaseModel


class FandomNameUpdate(BaseModel):
    name: str


class PromoteRequest(BaseModel):
    song_id: str


class MusicShowResultOut(BaseModel):
    id: str
    song_id: str
    song_title: str
    show_name: str
    rank: int | None = None
    is_win: bool
    points: float
    week: int
    game_date: date | None = None


class EligibleSong(BaseModel):
    id: str
    title: str
    tier: str | None = None
    weeks_since_release: int


class FandomStatus(BaseModel):
    fandom_name: str | None = None
    fans_count: int
    level: int
    level_name: str
    next_at: int | None = None


class MusicStatus(BaseModel):
    fandom: FandomStatus
    week: int
    can_promote: bool
    trophies: int
    results: list[MusicShowResultOut] = []
    eligible_songs: list[EligibleSong] = []


class PromoteResult(BaseModel):
    result: MusicShowResultOut
    fame_delta: float
    fans_delta: int
    money_delta: float
    streams_delta: int
    character_fame: float
    character_money: float
    character_fans: int
