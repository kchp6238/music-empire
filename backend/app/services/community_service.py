from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.song import Song
from app.models.npc import NpcArtist, NpcSong
from app.models.community import Follow
from app.models.fan import FanPersona, SongReaction
from app.services.patterns import build_combined_pattern
from app.services import covers_service, reactions as reactions_service

# How many fan comments a feed card quotes. The card has room for a couple of
# lines; the rest of a song's reactions live on its results screen.
FEED_COMMENTS = 2


def _reactions_by_song(db: Session, song_ids: list[str]) -> dict[str, list[dict]]:
    """The loudest few reactions per song, in one query rather than per card.

    "Loudest" = furthest from indifference in either direction, so a card shows
    the fan who loved it and the fan who hated it instead of two shrugs.
    """
    if not song_ids:
        return {}
    rows = (
        db.query(SongReaction, FanPersona)
        .join(FanPersona, SongReaction.persona_id == FanPersona.id)
        .filter(SongReaction.song_id.in_(song_ids), SongReaction.reached.is_(True),
                SongReaction.comment_line.isnot(None))
        .all()
    )
    grouped: dict[str, list] = {}
    for reaction, persona in rows:
        grouped.setdefault(reaction.song_id, []).append((reaction, persona))

    out = {}
    for song_id, pairs in grouped.items():
        pairs.sort(key=lambda p: abs(float(p[0].reaction_score) - 50), reverse=True)
        out[song_id] = [
            {"persona_name": persona.name, "persona_color": persona.color,
             "comment_line": reaction.comment_line}
            for reaction, persona in pairs[:FEED_COMMENTS]
        ]
    return out


def get_feed(db: Session) -> list[dict]:
    items = []
    rows = db.query(Song, Character).join(Character, Song.character_id == Character.id).filter(Song.released_at.isnot(None)).all()
    song_ids = [s.id for s, _ in rows]
    # One id-only query rather than joining the cover table — the point of
    # keeping art in its own table is that listing never touches the bytes.
    with_cover = covers_service.song_ids_with_cover(db, song_ids)
    comments = _reactions_by_song(db, song_ids)
    for song, character in rows:
        items.append({
            "id": song.id, "title": song.title, "artist_name": character.artist_name,
            "artist_id": character.id, "artist_type": "character", "tier": song.tier,
            "overall_score": song.overall_score, "source": "user", "bpm": song.bpm,
            "has_cover": song.id in with_cover,
            "reactions": comments.get(song.id, []),
            "pattern": build_combined_pattern(song.pattern, song.structure),
        })

    npc_rows = db.query(NpcSong, NpcArtist).join(NpcArtist, NpcSong.npc_artist_id == NpcArtist.id).all()
    # NPC songs have no stored reactions — theirs are generated on the fly from
    # the same writer, seeded on the song id so they stay put between loads.
    personas = db.query(FanPersona).all() if npc_rows else []
    for npc_song, artist in npc_rows:
        items.append({
            "id": npc_song.id, "title": npc_song.title, "artist_name": artist.name,
            "artist_id": artist.id, "artist_type": "npc", "tier": npc_song.tier,
            "overall_score": float(npc_song.score), "source": "npc", "bpm": npc_song.bpm,
            "has_cover": False,
            "reactions": reactions_service.build_npc_comments(npc_song, personas, FEED_COMMENTS),
            "pattern": npc_song.pattern,
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
