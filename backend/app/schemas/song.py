from datetime import datetime, date

from pydantic import BaseModel


class VocalRef(BaseModel):
    """One attached vocal take and when it enters the song. offset_sec is the
    start of its section (0 for a whole-song take); same-section takes stack as
    harmony because they share an offset."""
    recording_id: str
    section: str | None = None
    offset_sec: float = 0.0


class SongDraftCreate(BaseModel):
    title: str = ""
    bpm: int = 100
    genre_tags: list[str] = []
    mood_tags: list[str] = []
    chord_preset_id: str = "p1"
    production_mode: str = "beginner"
    vocal_source: str = "self"
    structure: list[str] = []
    pattern: dict
    lyrics: dict | None = None


class SongDraftUpdate(BaseModel):
    title: str | None = None
    bpm: int | None = None
    genre_tags: list[str] | None = None
    mood_tags: list[str] | None = None
    chord_preset_id: str | None = None
    production_mode: str | None = None
    vocal_source: str | None = None
    structure: list[str] | None = None
    pattern: dict | None = None
    lyrics: dict | None = None


class SongOut(BaseModel):
    id: str
    character_id: str
    title: str
    bpm: int
    genre_tags: list[str]
    mood_tags: list[str]
    chord_preset_id: str
    production_mode: str
    vocal_source: str
    structure: list[str]
    pattern: dict
    lyrics: dict | None
    craft: float | None
    originality: float | None
    accessibility: float | None
    experimental: float | None
    overall_score: float | None
    tier: str | None
    genius_event: bool
    sleeper_hit: bool
    fans_delta: int | None
    money_delta: float | None
    fame_delta: float | None
    revenue_breakdown: dict | None = None
    released_at: datetime | None
    released_on: date | None = None
    created_at: datetime
    # The vocal take to play over this song's beat, if one is attached. Set as
    # a transient attribute in songs_service, not a real column — the link
    # lives on VocalRecording.song_id.
    vocal_recording_id: str | None = None
    # Every attached take with its section offset — layered playback plays them
    # all, stacking same-section takes into harmony. Transient, like above.
    vocals: list[VocalRef] = []

    model_config = {"from_attributes": True}


class SongReactionOut(BaseModel):
    persona_id: int
    reached: bool
    affinity: float
    reaction_score: float
    comment_line: str | None

    model_config = {"from_attributes": True}


class ReleaseBreakdown(BaseModel):
    reach_ratio: float
    completion_rate: float
    repeat_play_rate: float
    save_rate: float
    share_rate: float
    fan_affinity_match: float


class UnlockedAchievement(BaseModel):
    id: str
    name: str
    desc: str


class ReleaseResult(BaseModel):
    song: SongOut
    reactions: list[SongReactionOut]
    breakdown: ReleaseBreakdown
    revenue_breakdown: dict
    newly_unlocked: list[UnlockedAchievement] = []
    # A release consumes a week of game time; this is what happened during it.
    time: dict
    character_fame: float
    character_money: float
    character_fans_count: int
    character_age: int
    character_game_date: date
