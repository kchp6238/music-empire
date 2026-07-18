from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.song import Song
from app.models.npc import NpcArtist, NpcSong
from app.models.community import Follow
from app.services.patterns import build_combined_pattern


def get_feed(db: Session) -> list[dict]:
    items = []
    for song, character in db.query(Song, Character).join(Character, Song.character_id == Character.id).filter(Song.released_at.isnot(None)).all():
        items.append({
            "id": song.id, "title": song.title, "artist_name": character.artist_name,
            "artist_id": character.id, "artist_type": "character", "tier": song.tier,
            "overall_score": song.overall_score, "source": "user", "bpm": song.bpm,
            "pattern": build_combined_pattern(song.pattern, song.structure),
        })
    for npc_song, artist in db.query(NpcSong, NpcArtist).join(NpcArtist, NpcSong.npc_artist_id == NpcArtist.id).all():
        items.append({
            "id": npc_song.id, "title": npc_song.title, "artist_name": artist.name,
            "artist_id": artist.id, "artist_type": "npc", "tier": npc_song.tier,
            "overall_score": float(npc_song.score), "source": "npc", "bpm": npc_song.bpm, "pattern": npc_song.pattern,
        })
    return items


def list_follows(db: Session, follower_character_id: str) -> list[dict]:
    rows = db.query(Follow).filter(Follow.follower_character_id == follower_character_id).all()
    return [{"followed_type": r.followed_type, "followed_id": r.followed_id} for r in rows]


def get_chart(db: Session) -> list[dict]:
    items = get_feed(db)
    return sorted(items, key=lambda x: (x["overall_score"] or 0), reverse=True)


def follow(db: Session, follower_character_id: str, followed_type: str, followed_id: str) -> Follow:
    existing = (
        db.query(Follow)
        .filter(Follow.follower_character_id == follower_character_id, Follow.followed_type == followed_type, Follow.followed_id == followed_id)
        .first()
    )
    if existing:
        return existing
    row = Follow(follower_character_id=follower_character_id, followed_type=followed_type, followed_id=followed_id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def unfollow(db: Session, follower_character_id: str, followed_type: str, followed_id: str) -> None:
    db.query(Follow).filter(
        Follow.follower_character_id == follower_character_id, Follow.followed_type == followed_type, Follow.followed_id == followed_id
    ).delete()
    db.commit()
