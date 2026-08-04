from datetime import date
from pydantic import BaseModel


class AlbumCreate(BaseModel):
    title: str
    song_ids: list[str]
    title_song_id: str | None = None
    concept: str | None = None


class AlbumTrack(BaseModel):
    id: str
    title: str
    tier: str | None = None
    overall_score: float | None = None
    views: int = 0
    is_title: bool = False


class AlbumOut(BaseModel):
    id: str
    title: str
    kind: str
    concept: str | None = None
    title_song_id: str | None = None
    track_count: int
    avg_score: float | None = None
    tier: str | None = None
    total_streams: int
    fame_delta: float | None = None
    money_delta: float | None = None
    fans_delta: int | None = None
    released_on: date | None = None
    tracks: list[AlbumTrack] = []
