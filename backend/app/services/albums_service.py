from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.album import Album
from app.models.character import Character
from app.models.song import Song


def _tier(score: float) -> str:
    """Same thresholds as a single's tier (services/scoring.py), applied to the
    album's average score."""
    if score >= 80:
        return "대박"
    if score >= 65:
        return "성공"
    if score >= 45:
        return "무난"
    if score >= 25:
        return "부진"
    return "참패"


def _out(db: Session, album: Album) -> dict:
    ids = album.song_ids or []
    songs = {s.id: s for s in db.query(Song).filter(Song.id.in_(ids)).all()} if ids else {}
    tracks = []
    for sid in ids:
        s = songs.get(sid)
        if s is None:
            continue
        tracks.append({
            "id": s.id, "title": s.title, "tier": s.tier,
            "overall_score": float(s.overall_score) if s.overall_score is not None else None,
            "views": int(s.views or 0), "is_title": sid == album.title_song_id,
        })
    return {
        "id": album.id, "title": album.title, "kind": album.kind, "concept": album.concept,
        "title_song_id": album.title_song_id, "track_count": album.track_count,
        "avg_score": float(album.avg_score) if album.avg_score is not None else None,
        "tier": album.tier, "total_streams": int(album.total_streams or 0),
        "fame_delta": float(album.fame_delta) if album.fame_delta is not None else None,
        "money_delta": float(album.money_delta) if album.money_delta is not None else None,
        "fans_delta": album.fans_delta,
        "released_on": album.released_on, "tracks": tracks,
    }


def list_albums(db: Session, character: Character) -> list[dict]:
    rows = (
        db.query(Album)
        .filter(Album.character_id == character.id)
        .order_by(Album.released_at.desc())
        .all()
    )
    return [_out(db, a) for a in rows]


def create_album(db: Session, character: Character, data: dict) -> dict:
    title = (data.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="앨범 제목을 입력하세요")

    ids = list(dict.fromkeys(data.get("song_ids") or []))  # de-dupe, keep order
    found = {
        s.id: s for s in db.query(Song).filter(
            Song.character_id == character.id, Song.id.in_(ids), Song.released_at.isnot(None)
        ).all()
    }
    ordered = [found[i] for i in ids if i in found]
    if len(ordered) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="발매한 본인 곡을 2개 이상 선택하세요")

    title_song_id = data.get("title_song_id")
    if title_song_id not in found:
        title_song_id = ordered[0].id

    scores = [float(s.overall_score) for s in ordered if s.overall_score is not None]
    avg = round(sum(scores) / len(scores), 1) if scores else 0.0
    streams = sum(int(s.views or 0) for s in ordered)
    n = len(ordered)
    kind = "lp" if n >= 4 else "ep"

    # One-shot release bonus — more/better tracks pay off more, and reach scales
    # with the artist's current fame.
    q = max(0.0, avg) / 100
    fame_delta = round(n * q * 2.2, 1)
    fans_delta = int(n * avg * 18)
    money_delta = round(n * avg * 3500 * (1 + float(character.fame) / 100))

    character.fame = max(0, min(100, float(character.fame) + fame_delta))
    character.fans_count = int(character.fans_count) + fans_delta
    character.money = max(0, float(character.money) + money_delta)

    album = Album(
        character_id=character.id, title=title, kind=kind, concept=(data.get("concept") or None),
        title_song_id=title_song_id, song_ids=[s.id for s in ordered], track_count=n,
        avg_score=avg, tier=_tier(avg), total_streams=streams,
        fame_delta=fame_delta, money_delta=money_delta, fans_delta=fans_delta,
        released_on=character.game_date, released_at=datetime.now(timezone.utc),
    )
    db.add(album)
    db.commit()
    db.refresh(album)
    return _out(db, album)
