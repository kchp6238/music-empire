import math
import random

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.music import MusicShowResult
from app.models.song import Song
from app.services import time_service

# Fandom size tiers by fan count: (threshold, name).
FANDOM_LEVELS = [
    (0, "루키 팬"),
    (500, "팬클럽"),
    (2_000, "팬덤"),
    (10_000, "대형 팬덤"),
    (50_000, "코어 팬덤"),
    (200_000, "전국구 팬덤"),
    (1_000_000, "월드클래스"),
]

# Fictional show names (no real-broadcast trademarks).
SHOW_NAMES = ["뮤직 스테이지", "더 스테이지", "케이 차트쇼", "인기가요쇼", "뮤직 온에어", "탑뮤직"]

# Fan events (팬미팅·팬사인회) — meet the fandom for ticket/goods income and
# tighter loyalty. per_fan = revenue per current fan; fan_mult = fan growth.
FAN_EVENTS = {
    "fanmeet": {"label": "팬미팅", "per_fan": 25, "fan_mult": 0.02, "fame": 0.5},
    "fansign": {"label": "팬사인회", "per_fan": 12, "fan_mult": 0.01, "fame": 0.3},
}


# Going global — a top-tier milestone activity. Gated on real standing; pays
# big and eats several days.
WORLD_TOUR_MIN_FAME = 70
WORLD_TOUR_MIN_FANS = 100_000


def world_tour(db: Session, character: Character) -> dict:
    fame = float(character.fame)
    fans = int(character.fans_count)
    if fame < WORLD_TOUR_MIN_FAME or fans < WORLD_TOUR_MIN_FANS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"해외 진출 조건 미달 — 명성 {WORLD_TOUR_MIN_FAME}+ (현재 {round(fame)}), 팬 {WORLD_TOUR_MIN_FANS:,}+ (현재 {fans:,})",
        )
    rng = random.Random()
    roll = 0.8 + rng.random() * 0.5
    earnings = round(fans * 120 * roll + 20_000_000)
    fame_gain = round(3 + rng.random() * 3, 1)
    fans_gain = int(fans * 0.15 + 50_000 * roll)

    character.money = float(character.money) + earnings
    character.fame = max(0, min(100, fame + fame_gain))
    character.fans_count = fans + fans_gain
    character.condition = max(0, int(character.condition) - 30)
    db.commit()
    time_service.advance_days(db, character, 5, reason="world_tour")
    return {
        "earnings": earnings, "fame_gain": fame_gain, "fans_gain": fans_gain,
        "character_fame": float(character.fame), "character_fans": int(character.fans_count),
        "character_money": float(character.money),
    }


def rest(db: Session, character: Character) -> dict:
    """Take time off to recover condition (advances 2 days)."""
    before = int(character.condition)
    character.condition = min(100, before + 35)
    db.commit()
    time_service.advance_days(db, character, 2, reason="rest")
    return {"condition": int(character.condition), "restored": int(character.condition) - before}


def fan_event(db: Session, character: Character, kind: str) -> dict:
    cfg = FAN_EVENTS.get(kind)
    if cfg is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="알 수 없는 팬 이벤트입니다")
    fans = int(character.fans_count)
    rng = random.Random()
    roll = 0.8 + rng.random() * 0.4
    earnings = round(fans * cfg["per_fan"] * roll + 100_000)
    fans_gain = int(fans * cfg["fan_mult"] + 100)

    character.money = float(character.money) + earnings
    character.fans_count = fans + fans_gain
    character.fame = max(0, min(100, float(character.fame) + cfg["fame"]))
    character.condition = max(0, int(character.condition) - 6)
    db.commit()
    time_service.advance_days(db, character, 1, reason="fan_event")
    return {
        "kind": kind, "label": cfg["label"], "earnings": earnings, "fans_gain": fans_gain, "fame_gain": cfg["fame"],
        "character_fans": int(character.fans_count), "character_money": float(character.money),
        "character_fame": float(character.fame),
    }


def fandom_status(character: Character) -> dict:
    fans = int(character.fans_count)
    level = 0
    for i, (threshold, _name) in enumerate(FANDOM_LEVELS):
        if fans >= threshold:
            level = i
    next_at = FANDOM_LEVELS[level + 1][0] if level + 1 < len(FANDOM_LEVELS) else None
    return {
        "fandom_name": character.fandom_name,
        "fans_count": fans,
        "level": level + 1,  # 1-based for display
        "level_name": FANDOM_LEVELS[level][1],
        "next_at": next_at,
    }


def set_fandom_name(db: Session, character: Character, name: str) -> dict:
    name = (name or "").strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="팬덤 이름을 입력하세요")
    if len(name) > 40:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="팬덤 이름은 40자 이하로 입력하세요")
    character.fandom_name = name
    db.commit()
    return fandom_status(character)


def _result_out(row: MusicShowResult) -> dict:
    return {
        "id": row.id, "song_id": row.song_id, "song_title": row.song_title, "show_name": row.show_name,
        "rank": row.rank, "is_win": row.is_win, "points": float(row.points),
        "week": row.week, "game_date": row.game_date,
    }


def _eligible_songs(db: Session, character: Character) -> list[dict]:
    songs = (
        db.query(Song)
        .filter(Song.character_id == character.id, Song.released_at.isnot(None))
        .order_by(Song.released_on.desc())
        .all()
    )
    out = []
    for s in songs:
        weeks = 0
        if s.released_on:
            weeks = max(0, (character.game_date - s.released_on).days // 7)
        out.append({"id": s.id, "title": s.title, "tier": s.tier, "weeks_since_release": weeks})
    return out


def get_status(db: Session, character: Character) -> dict:
    week = time_service.week_index(character)
    results = (
        db.query(MusicShowResult)
        .filter(MusicShowResult.character_id == character.id)
        .order_by(MusicShowResult.created_at.desc())
        .limit(12)
        .all()
    )
    trophies = (
        db.query(MusicShowResult)
        .filter(MusicShowResult.character_id == character.id, MusicShowResult.is_win.is_(True))
        .count()
    )
    return {
        "fandom": fandom_status(character),
        "week": week,
        "condition": int(character.condition),
        "can_promote": week > (character.last_music_show_week if character.last_music_show_week is not None else -1),
        "trophies": trophies,
        "results": [_result_out(r) for r in results],
        "eligible_songs": _eligible_songs(db, character),
    }


def promote(db: Session, character: Character, song_id: str) -> dict:
    week = time_service.week_index(character)
    if week <= (character.last_music_show_week if character.last_music_show_week is not None else -1):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="이번 주 음악방송 활동은 이미 했어요. 다음 주에 다시 도전하세요.")

    song = (
        db.query(Song)
        .filter(Song.id == song_id, Song.character_id == character.id, Song.released_at.isnot(None))
        .first()
    )
    if song is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="발매한 본인 곡을 선택하세요")

    rng = random.Random()
    score = float(song.overall_score or 0)
    fame = float(character.fame)
    fans = int(character.fans_count)
    weeks_since = max(0, (character.game_date - song.released_on).days // 7) if song.released_on else 0

    # points = song quality + fame + how fresh the release is + fanbase + luck,
    # then nudged by the artist's condition (a tired star underperforms).
    recency = max(0, 8 - weeks_since) * 2.0            # 0..16, decays over ~2 months
    fan_bonus = min(20.0, math.log10(max(1, fans)) * 4.0)
    condition = int(getattr(character, "condition", 100))
    points = round(score + fame * 0.4 + recency + fan_bonus + (condition - 60) * 0.12 + rng.uniform(-8, 12), 1)

    win_line = 100 + rng.uniform(-6, 10)               # weekly competition strength
    if points >= win_line:
        rank, is_win = 1, True
    elif points >= win_line - 12:
        rank, is_win = 2, False
    elif points >= win_line - 24:
        rank, is_win = 3, False
    elif points >= win_line - 42:
        rank, is_win = rng.randint(4, 8), False
    else:
        rank, is_win = None, False

    # rewards by placement
    if is_win:
        fame_delta, fan_mult, stream_mult = 3.0, 0.06, 1.4
    elif rank in (2, 3):
        fame_delta, fan_mult, stream_mult = 1.4, 0.03, 0.7
    elif rank:
        fame_delta, fan_mult, stream_mult = 0.6, 0.015, 0.4
    else:
        fame_delta, fan_mult, stream_mult = 0.2, 0.005, 0.15

    streams_delta = int(fans * stream_mult + score * 200 * stream_mult)
    fans_delta = int(fans * fan_mult + score * (6 if is_win else 3))
    money_delta = round(streams_delta * 4.5)

    character.fame = max(0, min(100, fame + fame_delta))
    character.fans_count = fans + fans_delta
    character.money = max(0, float(character.money) + money_delta)
    song.views = int(song.views or 0) + streams_delta
    character.last_music_show_week = week
    character.condition = max(0, condition - 10)

    row = MusicShowResult(
        character_id=character.id, song_id=song.id, song_title=song.title, show_name=rng.choice(SHOW_NAMES),
        rank=rank, is_win=is_win, points=points, week=week, game_date=character.game_date,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return {
        "result": _result_out(row),
        "fame_delta": fame_delta, "fans_delta": fans_delta, "money_delta": float(money_delta),
        "streams_delta": streams_delta,
        "character_fame": float(character.fame), "character_money": float(character.money),
        "character_fans": int(character.fans_count),
    }
