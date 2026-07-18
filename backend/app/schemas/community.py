from pydantic import BaseModel


class FeedSongItem(BaseModel):
    id: str
    title: str
    artist_name: str
    tier: str | None
    overall_score: float | None
    source: str  # "user" | "npc"
    bpm: int
    pattern: dict  # combined (flattened) pattern, ready for the audio engine


class ChartEntry(BaseModel):
    id: str
    title: str
    artist_name: str
    tier: str | None
    overall_score: float | None
    source: str
    bpm: int
    pattern: dict


class FollowCreate(BaseModel):
    followed_type: str  # "character" | "npc"
    followed_id: str
