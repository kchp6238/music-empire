from pydantic import BaseModel


class FeedSongItem(BaseModel):
    id: str
    title: str
    artist_name: str
    tier: str | None
    overall_score: float | None
    source: str  # "user" | "npc"


class ChartEntry(BaseModel):
    id: str
    title: str
    artist_name: str
    tier: str | None
    overall_score: float | None
    source: str


class FollowCreate(BaseModel):
    followed_type: str  # "character" | "npc"
    followed_id: str
