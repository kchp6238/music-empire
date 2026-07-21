from pydantic import BaseModel


class FeedReaction(BaseModel):
    """One fan's line about a song, quoted in the feed. Written at release time
    by services/reactions.py — the client no longer invents these."""
    persona_name: str
    persona_color: str | None = None
    comment_line: str


class FeedSongItem(BaseModel):
    id: str
    title: str
    artist_name: str
    artist_id: str
    artist_type: str  # "character" | "npc"
    tier: str | None
    overall_score: float | None
    source: str  # "user" | "npc"
    bpm: int
    # Undeclared fields are dropped by the response model, so anything the
    # service sets has to be listed here — has_cover silently vanished for a
    # while precisely because it wasn't.
    has_cover: bool = False
    vocal_recording_id: str | None = None
    reactions: list[FeedReaction] = []
    pattern: dict  # combined (flattened) pattern, ready for the audio engine


class ChartEntry(BaseModel):
    id: str
    title: str
    artist_name: str
    artist_id: str
    artist_type: str
    tier: str | None
    overall_score: float | None
    source: str
    bpm: int
    has_cover: bool = False
    vocal_recording_id: str | None = None
    reactions: list[FeedReaction] = []
    pattern: dict


class FollowCreate(BaseModel):
    followed_type: str  # "character" | "npc"
    followed_id: str
