"""Achievement/milestone definitions and unlock checks (GDD §14 레퍼런스 지표
확장). Definitions live here in code; only unlock rows are persisted in
character_achievements.
"""

from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.song import Song
from app.models.achievement import CharacterAchievement

# id -> {name, desc, predicate(ctx) -> bool}
# ctx = {character, released_count, best_score, last_tier, genius_ever, sleeper_ever}
ACHIEVEMENTS = [
    {"id": "first_release", "name": "데뷔", "desc": "첫 곡을 발매했다",
     "check": lambda c: c["released_count"] >= 1},
    {"id": "first_hit", "name": "첫 성공", "desc": "‘성공’ 이상 등급의 곡을 냈다",
     "check": lambda c: c["best_score"] >= 65},
    {"id": "first_daebak", "name": "대박", "desc": "‘대박’ 등급의 곡을 냈다",
     "check": lambda c: c["best_score"] >= 80},
    {"id": "prolific", "name": "다작", "desc": "곡 10개를 발매했다",
     "check": lambda c: c["released_count"] >= 10},
    {"id": "fans_1k", "name": "천 명의 팬", "desc": "팬 1,000명을 모았다",
     "check": lambda c: c["character"].fans_count >= 1000},
    {"id": "fans_10k", "name": "만 명의 팬", "desc": "팬 10,000명을 모았다",
     "check": lambda c: c["character"].fans_count >= 10000},
    {"id": "rich", "name": "억대 자산", "desc": "자금 100,000원을 넘겼다",
     "check": lambda c: float(c["character"].money) >= 100000},
    {"id": "famous", "name": "스타", "desc": "명성 80을 넘겼다",
     "check": lambda c: float(c["character"].fame) >= 80},
    {"id": "genius_moment", "name": "영감의 순간", "desc": "천재 이벤트가 발동한 곡을 냈다",
     "check": lambda c: c["genius_ever"]},
    {"id": "sleeper", "name": "역주행", "desc": "역주행(슬리퍼 히트)을 경험했다",
     "check": lambda c: c["sleeper_ever"]},
]
ACHIEVEMENTS_BY_ID = {a["id"]: a for a in ACHIEVEMENTS}


def _build_ctx(db: Session, character: Character) -> dict:
    songs = db.query(Song).filter(Song.character_id == character.id, Song.released_at.isnot(None)).all()
    return {
        "character": character,
        "released_count": len(songs),
        "best_score": max((float(s.overall_score or 0) for s in songs), default=0),
        "genius_ever": any(s.genius_event for s in songs),
        "sleeper_ever": any(s.sleeper_hit for s in songs),
    }


def check_and_unlock(db: Session, character: Character) -> list[dict]:
    """Evaluate all achievements for a character; persist and return any newly
    unlocked ones. Safe to call after every release and on character load."""
    already = {
        row.achievement_id
        for row in db.query(CharacterAchievement).filter(CharacterAchievement.character_id == character.id).all()
    }
    ctx = _build_ctx(db, character)
    newly = []
    for a in ACHIEVEMENTS:
        if a["id"] in already:
            continue
        if a["check"](ctx):
            db.add(CharacterAchievement(character_id=character.id, achievement_id=a["id"]))
            newly.append({"id": a["id"], "name": a["name"], "desc": a["desc"]})
    if newly:
        db.commit()
    return newly


def list_for_character(db: Session, character: Character) -> list[dict]:
    unlocked = {
        row.achievement_id: row.unlocked_at
        for row in db.query(CharacterAchievement).filter(CharacterAchievement.character_id == character.id).all()
    }
    return [
        {
            "id": a["id"], "name": a["name"], "desc": a["desc"],
            "unlocked": a["id"] in unlocked,
            "unlocked_at": unlocked.get(a["id"]),
        }
        for a in ACHIEVEMENTS
    ]
