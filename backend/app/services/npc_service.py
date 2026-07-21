"""Living rival artists.

The old NPCs were five hardcoded songs that never changed, so a solo save's
chart was frozen the moment you saw it. Here each world grows its own rival
discography over its own timeline: artists keep releasing as the calendar
advances, and the chart actually turns over.

Everything is generated **deterministically** from the world id and a release
index, so a save always replays the same rival history — no cron, no stored
schedule, just "what would this artist have released by date D?" computed on
demand and cached as rows.
"""

import random
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models.character import GAME_EPOCH
from app.models.npc import NpcArtist, NpcSong
from app.models.world import World
from app.services.game_data import NPC_ARTISTS, NPC_TITLE_A, NPC_TITLE_B

# Rivals have a back-catalogue when a world begins, so the chart isn't empty on
# day one. This many releases per artist predate the epoch.
BACKCATALOGUE = 4

TIERS = [(80, "대박"), (65, "성공"), (45, "무난"), (25, "부진"), (0, "참패")]


def _tier(score: float) -> str:
    for threshold, name in TIERS:
        if score >= threshold:
            return name
    return "참패"


def _roster(db: Session) -> dict:
    """Map artist name -> NpcArtist row. The roster is global and seeded once
    (app/seed.py); this just resolves the game_data entries to their rows."""
    return {a.name: a for a in db.query(NpcArtist).all()}


def _pattern(rng: random.Random, spec: dict) -> dict:
    """A believable drum/bass pattern in the artist's lane. Only needs to look
    right when a listener plays a rival's song from the feed — it isn't scored."""
    def steps(idxs):
        arr = [False] * 16
        for i in idxs:
            arr[i] = True
        return arr

    genre = spec["genre"]
    if genre in ("EDM", "팝"):
        kick = steps([0, 4, 8, 12])
        hats = steps([i for i in range(16) if i % 2 == 1])
    elif genre in ("힙합", "R&B"):
        kick = steps(sorted(rng.sample(range(16), 5)))
        hats = steps([i for i in range(16) if i % 2 == 0])
    elif genre == "록":
        kick = steps([0, 8])
        hats = steps(list(range(16)))
    elif genre == "트로트":
        kick = steps([0, 2, 4, 6, 8, 10, 12, 14])
        hats = [True] * 16
    else:  # 발라드/인디/재즈
        kick = steps([0, 8])
        hats = steps([1, 5, 9, 13])

    root = rng.choice(["C2", "A2", "E2", "G2", "D2"])
    bass = [None] * 16
    for i in (0, 4, 8, 12):
        bass[i] = root

    return {
        "drums": {
            "kick": kick, "snare": steps([4, 12]), "hihatClosed": hats,
            "hihatOpen": [False] * 16, "clap": steps([12]) if genre in ("EDM", "팝") else [False] * 16,
            "tom": [False] * 16, "crash": steps([0]) if rng.random() < 0.3 else [False] * 16,
        },
        "bass": bass, "piano": [None] * 16, "guitar": [None] * 16,
    }


def _release(world_id: str, spec: dict, artist_row: NpcArtist, index: int, released_on: date) -> NpcSong:
    """One deterministic release. `index` counts from the artist's first ever
    drop (negative for the pre-epoch back-catalogue)."""
    rng = random.Random(f"{world_id}:{artist_row.id}:{index}")

    # Score clusters around the artist's skill; a consistent star barely wobbles,
    # a gamble swings wide. Clamped so nobody is perfect or unlistenable.
    spread = (1.0 - spec["consistency"]) * 45
    score = max(15, min(97, round(rng.gauss(spec["skill"], spread))))

    title = rng.choice(NPC_TITLE_A) + rng.choice(NPC_TITLE_B)
    lo, hi = spec["bpm"]
    return NpcSong(
        world_id=world_id, npc_artist_id=artist_row.id, title=title,
        tier=_tier(score), score=score, bpm=rng.randint(lo, hi),
        released_on=released_on, pattern=_pattern(rng, spec),
    )


def seed_world(db: Session, world: World) -> None:
    """Give a brand-new world its opening chart: a few back-catalogue releases
    per rival, dated before the epoch so they're already out when play starts."""
    roster = _roster(db)
    for spec in NPC_ARTISTS:
        artist = roster.get(spec["name"])
        if artist is None:
            continue
        for n in range(BACKCATALOGUE):
            # Space the back-catalogue backwards from the epoch on the artist's
            # own cycle, so older releases sit further in the past.
            days_before = (BACKCATALOGUE - n) * spec["cycle_days"]
            released_on = GAME_EPOCH - timedelta(days=days_before)
            db.add(_release(world.id, spec, artist, n - BACKCATALOGUE, released_on))
    db.commit()


def ensure_catalogue(db: Session, world_id: str, up_to: date) -> None:
    """Fill in every rival release that should exist by `up_to`, then stop.

    Idempotent and cheap on the common path: it counts what's already there per
    artist and only generates the gap, so calling it on every feed load costs
    one COUNT per artist once the catalogue has caught up.
    """
    roster = _roster(db)
    made = False
    for spec in NPC_ARTISTS:
        artist = roster.get(spec["name"])
        if artist is None:
            continue
        cycle = spec["cycle_days"]
        # How many post-epoch releases the timeline calls for by now.
        due = max(0, (up_to - GAME_EPOCH).days // cycle + 1)
        have = (
            db.query(NpcSong)
            .filter(NpcSong.world_id == world_id, NpcSong.npc_artist_id == artist.id,
                    NpcSong.released_on >= GAME_EPOCH)
            .count()
        )
        for index in range(have, due):
            released_on = GAME_EPOCH + timedelta(days=index * cycle)
            db.add(_release(world_id, spec, artist, index, released_on))
            made = True
    if made:
        db.commit()
