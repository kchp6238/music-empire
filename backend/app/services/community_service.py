from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.song import Song
from app.models.npc import NpcArtist, NpcSong
from app.models.community import Follow
from app.models.fan import FanPersona, SongReaction
from app.services.patterns import build_combined_pattern
from app.services import covers_service, reactions as reactions_service, recordings_service
from app.services.game_data import NPC_ARTISTS

_NPC_BY_NAME = {a["name"]: a for a in NPC_ARTISTS}

# How many fan comments a feed card quotes. The card has room for a couple of
# lines; the rest of a song's reactions live on its results screen.
FEED_COMMENTS = 2

# The chart/feed shows only the most recent rival releases, not the whole
# multi-year catalogue — enough to rank a lively chart and drive the phone's
# 신곡/급상승/장르 filters without shipping hundreds of stale rows.
NPC_FEED_LIMIT = 150


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


def get_feed(db: Session, viewer: Character) -> list[dict]:
    """The scene as this save sees it — only songs from the viewer's own world.

    Solo saves see themselves and the NPC rivals; a multi room shows everyone
    who joined it. Nothing crosses between worlds.
    """
    # Catch the rivals up to this save's date first, so the chart reflects
    # everything that "should" have come out by now. Cheap once caught up.
    from app.services import npc_service
    npc_service.ensure_catalogue(db, viewer.world_id, viewer.game_date)

    items = []
    rows = (
        db.query(Song, Character)
        .join(Character, Song.character_id == Character.id)
        .filter(Song.released_at.isnot(None), Character.world_id == viewer.world_id)
        .all()
    )
    song_ids = [s.id for s, _ in rows]
    # One id-only query rather than joining the cover table — the point of
    # keeping art in its own table is that listing never touches the bytes.
    with_cover = covers_service.song_ids_with_cover(db, song_ids)
    comments = _reactions_by_song(db, song_ids)
    vocals_by_song = recordings_service.vocals_for_songs(db, song_ids)
    for song, character in rows:
        rec_rows = vocals_by_song.get(song.id, [])
        offsets = recordings_service.section_offsets(song)
        vocals = [
            {"recording_id": rid, "section": section, "offset_sec": offsets.get(section, 0.0)}
            for rid, section, _ in rec_rows
        ]
        items.append({
            "id": song.id, "title": song.title, "artist_name": character.artist_name,
            "artist_id": character.id, "artist_type": "character", "tier": song.tier,
            "overall_score": song.overall_score, "source": "user", "bpm": song.bpm,
            "views": song.views,
            "genres": song.genre_tags or [],
            "released_on": song.released_on.isoformat() if song.released_on else None,
            "has_cover": song.id in with_cover,
            "vocal_recording_id": rec_rows[-1][0] if rec_rows else None,
            "vocals": vocals,
            "reactions": comments.get(song.id, []),
            "pattern": build_combined_pattern(song.pattern, song.structure),
        })

    # Rivals from this world only, and only what has come out by the viewer's
    # own date — players in a shared room can be at different points in time.
    # Cap to the most recent releases: a chart shows the current scene, not the
    # entire multi-year back-catalogue (which grew into the hundreds and made
    # the feed unusable). Older rival songs simply age off the chart.
    npc_rows = (
        db.query(NpcSong, NpcArtist)
        .join(NpcArtist, NpcSong.npc_artist_id == NpcArtist.id)
        .filter(NpcSong.world_id == viewer.world_id, NpcSong.released_on <= viewer.game_date)
        .order_by(NpcSong.released_on.desc())
        .limit(NPC_FEED_LIMIT)
        .all()
    )
    # NPC songs have no stored reactions — theirs are generated on the fly from
    # the same writer, seeded on the song id so they stay put between loads.
    personas = db.query(FanPersona).all() if npc_rows else []
    for npc_song, artist in npc_rows:
        items.append({
            "id": npc_song.id, "title": npc_song.title, "artist_name": artist.name,
            "artist_id": artist.id, "artist_type": "npc", "tier": npc_song.tier,
            "overall_score": float(npc_song.score), "source": "npc", "bpm": npc_song.bpm,
            # NPC 조회수 is deterministic from quality — rivals have their own audience.
            "views": int(float(npc_song.score) ** 2 * 2),
            "genres": [artist.genre] if artist.genre else [],
            "released_on": npc_song.released_on.isoformat() if npc_song.released_on else None,
            "has_cover": False, "vocal_recording_id": None, "vocals": [],
            "reactions": reactions_service.build_npc_comments(npc_song, personas, FEED_COMMENTS),
            "pattern": npc_service.enrich_npc_pattern(npc_song, artist.genre),
        })
    return items


def artist_profile(db: Session, viewer: Character, artist_type: str, artist_id: str) -> dict:
    """A rival's or another player's page — their stats and what they've put out,
    scoped to the viewer's world. Answers 'who is this artist and what have they
    done', for NPCs (generated) and characters alike."""
    if artist_type == "npc":
        artist = db.get(NpcArtist, artist_id)
        if artist is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="아티스트를 찾을 수 없습니다")
        meta = _NPC_BY_NAME.get(artist.name, {})
        songs = (
            db.query(NpcSong)
            .filter(NpcSong.npc_artist_id == artist_id, NpcSong.world_id == viewer.world_id,
                    NpcSong.released_on <= viewer.game_date)
            .order_by(NpcSong.released_on.desc())
            .all()
        )
        song_list = [
            {"id": s.id, "title": s.title, "tier": s.tier, "overall_score": float(s.score),
             "views": int(float(s.score) ** 2 * 2), "released_on": s.released_on.isoformat() if s.released_on else None}
            for s in songs
        ]
        scores = [float(s.score) for s in songs]
        return {
            "type": "npc", "id": artist.id, "name": artist.name, "color": artist.color,
            "genre": artist.genre or meta.get("genre"), "bio": artist.bio or meta.get("bio"),
            "skill": meta.get("skill"), "consistency": meta.get("consistency"), "moods": meta.get("moods", []),
            "releases": len(songs), "avg_score": round(sum(scores) / len(scores), 1) if scores else None,
            "songs": song_list,
        }

    char = db.get(Character, artist_id)
    if char is None or char.world_id != viewer.world_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="아티스트를 찾을 수 없습니다")
    songs = (
        db.query(Song)
        .filter(Song.character_id == char.id, Song.released_at.isnot(None))
        .order_by(Song.released_at.desc())
        .all()
    )
    song_list = [
        {"id": s.id, "title": s.title, "tier": s.tier, "overall_score": float(s.overall_score or 0),
         "views": s.views, "released_on": s.released_on.isoformat() if s.released_on else None}
        for s in songs
    ]
    scores = [float(s.overall_score) for s in songs if s.overall_score is not None]
    return {
        "type": "character", "id": char.id, "name": char.artist_name, "color": None,
        "background_name": char.background_name, "age": char.age,
        "fame": round(float(char.fame)), "fans_count": char.fans_count,
        "stats": char.stats, "talent": char.talent, "is_me": char.id == viewer.id,
        "releases": len(songs), "avg_score": round(sum(scores) / len(scores), 1) if scores else None,
        "songs": song_list,
    }


def search(db: Session, viewer: Character, q: str) -> dict:
    """Find artists and songs by name within the viewer's world."""
    q = (q or "").strip()
    if not q:
        return {"artists": [], "songs": []}
    like = f"%{q}%"

    chars = (
        db.query(Character)
        .filter(Character.world_id == viewer.world_id, Character.artist_name.ilike(like))
        .limit(8).all()
    )
    npcs = (
        db.query(NpcArtist)
        .join(NpcSong, NpcSong.npc_artist_id == NpcArtist.id)
        .filter(NpcSong.world_id == viewer.world_id, NpcArtist.name.ilike(like))
        .distinct().limit(8).all()
    )
    artists = (
        [{"type": "character", "id": c.id, "name": c.artist_name, "color": None} for c in chars]
        + [{"type": "npc", "id": n.id, "name": n.name, "color": n.color} for n in npcs]
    )

    user_songs = (
        db.query(Song, Character)
        .join(Character, Song.character_id == Character.id)
        .filter(Character.world_id == viewer.world_id, Song.released_at.isnot(None), Song.title.ilike(like))
        .limit(8).all()
    )
    npc_songs = (
        db.query(NpcSong, NpcArtist)
        .join(NpcArtist, NpcSong.npc_artist_id == NpcArtist.id)
        .filter(NpcSong.world_id == viewer.world_id, NpcSong.released_on <= viewer.game_date, NpcSong.title.ilike(like))
        .limit(8).all()
    )
    songs = (
        [{"id": s.id, "title": s.title, "artist_name": c.artist_name, "artist_type": "character",
          "artist_id": c.id, "tier": s.tier, "score": float(s.overall_score or 0)} for s, c in user_songs]
        + [{"id": ns.id, "title": ns.title, "artist_name": a.name, "artist_type": "npc",
            "artist_id": a.id, "tier": ns.tier, "score": float(ns.score)} for ns, a in npc_songs]
    )
    return {"artists": artists, "songs": songs}


def list_follows(db: Session, follower_character_id: str) -> list[dict]:
    rows = db.query(Follow).filter(Follow.follower_character_id == follower_character_id).all()
    return [{"followed_type": r.followed_type, "followed_id": r.followed_id} for r in rows]


def get_chart(db: Session, viewer: Character) -> list[dict]:
    items = get_feed(db, viewer)
    return sorted(items, key=lambda x: (x["overall_score"] or 0), reverse=True)


def follow(db: Session, follower: Character, followed_type: str, followed_id: str) -> Follow:
    # Follow.followed_id is polymorphic with no FK, so the same-world rule can
    # only be enforced here — the DB can't do it.
    if followed_type == "character":
        target = db.get(Character, followed_id)
        if target is None or target.world_id != follower.world_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="그 아티스트를 찾을 수 없습니다")

    follower_character_id = follower.id
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
