"""In-game SNS (뮤즈그램) — the phone's social app.

Posts are authored by the player (character) or, deterministically generated,
by rival NPCs. NPC posts are seeded on stable keys and stored with a
`dedupe_key` so re-fetching the feed is idempotent (mirrors news/npc catch-up).
Player posts persist forever; promoting a song from here gives it a modest,
one-time reach bump so the SNS actually feeds back into the game.
"""
import random
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models.character import Character, GAME_EPOCH
from app.models.npc import NpcArtist, NpcSong
from app.models.song import Song
from app.models.cover import SongCover
from app.models.community import Follow
from app.models.sns import SnsPost, SnsLike, SnsComment

MUSIC_GLYPHS = ["🎵", "🎶", "🎧", "🎤", "💿", "🎹", "🎸"]
LIFE_GLYPHS = ["🌆", "☕", "🌙", "✨", "🎬", "📸", "🍜", "🌊", "🔥", "💭"]

PROMO_TEMPLATES = [
    "새 싱글 '{title}' 드디어 공개했어요! 많이 들어주세요 🎧",
    "'{title}' 나왔습니다. 이번 곡은 진짜 자신 있어요 🔥",
    "밤샘 작업의 결실… '{title}' 스트리밍 링크는 프로필에!",
    "'{title}' 어떠셨나요? 댓글로 감상 남겨주세요 🎶",
]
FLAVOR_TEMPLATES = [
    "오늘 작업실 분위기 최고 🎹",
    "새 곡 준비 중… 조금만 기다려요 ✨",
    "요즘 이 노래만 무한재생 중",
    "공연 끝나고 야식 타임 🍜",
    "영감이 안 올 땐 그냥 걷기",
    "믹싱은 언제나 어렵다…",
    "팬분들 덕분에 오늘도 힘내요 💭",
    "스튜디오 노을이 예뻐서 📸",
]
NPC_COMMENTS = [
    "이번 곡 미쳤어요 👏", "무한재생 각", "역시 믿고 듣는다", "다음 무대 기대할게요!",
    "가사 너무 좋아요", "축하해요 🎉", "이 조합 신선하다", "플리에 바로 추가",
    "라이브로도 듣고 싶어요", "취향 저격 😍",
]


def _week_index(d: date) -> int:
    return max(0, (d - GAME_EPOCH).days // 7)


def _week_date(w: int) -> date:
    return GAME_EPOCH + timedelta(days=w * 7 + 3)


def _seed_likes(rng: random.Random, base: int, spread: int) -> int:
    return base + int(rng.random() ** 2 * spread)


def ensure_npc_posts(db: Session, character: Character) -> None:
    """Catch the SNS feed up to today with deterministic rival posts: one per
    NPC song release, plus a light weekly 'flavor' post for the last couple of
    weeks. Idempotent via dedupe_key so it's cheap to call on every feed load."""
    world_id = character.world_id
    today = character.game_date
    npcs = db.query(NpcArtist).all()
    if not npcs:
        return
    artist_by_id = {a.id: a for a in npcs}

    existing = {k for (k,) in db.query(SnsPost.dedupe_key).filter(SnsPost.world_id == world_id).all() if k}
    new_posts: list[SnsPost] = []

    # promo posts from rival releases
    releases = (
        db.query(NpcSong)
        .filter(NpcSong.world_id == world_id, NpcSong.released_on <= today)
        .order_by(NpcSong.released_on)
        .all()
    )
    for ns in releases:
        key = f"song:{ns.id}"
        if key in existing:
            continue
        artist = artist_by_id.get(ns.npc_artist_id)
        if artist is None:
            continue
        rng = random.Random(f"snspromo:{ns.id}")
        new_posts.append(SnsPost(
            world_id=world_id, author_type="npc", author_id=artist.id,
            author_name=artist.name, author_color=artist.color,
            caption=rng.choice(PROMO_TEMPLATES).format(title=ns.title),
            image_kind="glyph", image_ref=rng.choice(MUSIC_GLYPHS),
            likes_base=_seed_likes(rng, 60, 600), game_date=ns.released_on, dedupe_key=key,
        ))

    # weekly flavor for the last two weeks
    cur_week = _week_index(today)
    for artist in npcs:
        for w in range(max(0, cur_week - 1), cur_week + 1):
            key = f"flavor:{artist.id}:{w}"
            if key in existing:
                continue
            d = _week_date(w)
            if d > today:
                continue
            rng = random.Random(f"snsflavor:{artist.id}:{w}")
            new_posts.append(SnsPost(
                world_id=world_id, author_type="npc", author_id=artist.id,
                author_name=artist.name, author_color=artist.color,
                caption=rng.choice(FLAVOR_TEMPLATES),
                image_kind="glyph", image_ref=rng.choice(LIFE_GLYPHS),
                likes_base=_seed_likes(rng, 20, 300), game_date=d, dedupe_key=key,
            ))

    if new_posts:
        db.add_all(new_posts)
        db.commit()


def _serialize(db: Session, post: SnsPost, character: Character, liked_ids: set[str],
               comments_by_post: dict[str, list[SnsComment]], like_counts: dict[str, int]) -> dict:
    liked = post.id in liked_ids
    likes = post.likes_base + like_counts.get(post.id, 0)
    cmts = comments_by_post.get(post.id, [])
    return {
        "id": post.id,
        "author_type": post.author_type, "author_id": post.author_id,
        "author_name": post.author_name, "author_color": post.author_color,
        "is_me": post.author_type == "character" and post.author_id == character.id,
        "caption": post.caption,
        "image_kind": post.image_kind, "image_ref": post.image_ref,
        "song_id": post.song_id,
        "game_date": post.game_date.isoformat() if post.game_date else None,
        "likes": likes, "liked": liked,
        "comment_count": len(cmts),
        "comments": [
            {
                "id": c.id, "author_name": c.author_name, "author_color": c.author_color,
                "author_type": c.author_type, "body": c.body,
            }
            for c in cmts[:3]
        ],
    }


def get_feed(db: Session, character: Character, limit: int = 40) -> list[dict]:
    ensure_npc_posts(db, character)
    posts = (
        db.query(SnsPost)
        .filter(SnsPost.world_id == character.world_id)
        .order_by(SnsPost.game_date.desc(), SnsPost.created_at.desc())
        .limit(limit)
        .all()
    )
    ids = [p.id for p in posts]
    liked_ids = _liked_ids(db, character.id, ids)
    comments_by_post = _comments_for(db, ids)
    like_counts = _like_counts(db, ids)
    return [_serialize(db, p, character, liked_ids, comments_by_post, like_counts) for p in posts]


def _liked_ids(db: Session, character_id: str, post_ids: list[str]) -> set[str]:
    if not post_ids:
        return set()
    rows = db.query(SnsLike.post_id).filter(
        SnsLike.character_id == character_id, SnsLike.post_id.in_(post_ids)
    ).all()
    return {pid for (pid,) in rows}


def _like_counts(db: Session, post_ids: list[str]) -> dict[str, int]:
    if not post_ids:
        return {}
    counts: dict[str, int] = {}
    for (pid,) in db.query(SnsLike.post_id).filter(SnsLike.post_id.in_(post_ids)).all():
        counts[pid] = counts.get(pid, 0) + 1
    return counts


def _comments_for(db: Session, post_ids: list[str]) -> dict[str, list[SnsComment]]:
    if not post_ids:
        return {}
    rows = (
        db.query(SnsComment)
        .filter(SnsComment.post_id.in_(post_ids))
        .order_by(SnsComment.created_at.asc())
        .all()
    )
    out: dict[str, list[SnsComment]] = {}
    for c in rows:
        out.setdefault(c.post_id, []).append(c)
    return out


def create_post(db: Session, character: Character, caption: str, song_id: str | None) -> dict:
    caption = (caption or "").strip()[:300]
    image_kind, image_ref = "glyph", random.choice(LIFE_GLYPHS)
    song = None
    if song_id:
        song = db.query(Song).filter(Song.id == song_id, Song.character_id == character.id).first()
        if song is not None:
            has_cover = db.query(SongCover.song_id).filter(SongCover.song_id == song.id).first() is not None
            image_kind, image_ref = ("cover", song.id) if has_cover else ("glyph", "🎵")
            if not caption:
                caption = f"새 곡 '{song.title}' 들어주세요 🎧"

    # Seed engagement off the artist's standing so a bigger star gets more love.
    rng = random.Random()
    fame = float(character.fame or 0)
    fans = int(character.fans_count or 0)
    likes_base = int(fans * 0.03 + fame * 4) + rng.randint(0, 40)

    post = SnsPost(
        world_id=character.world_id, author_type="character", author_id=character.id,
        author_name=character.artist_name, author_color="#E8A33D",
        caption=caption or "…", image_kind=image_kind, image_ref=image_ref,
        song_id=song.id if song else None, likes_base=max(0, likes_base),
        game_date=character.game_date, dedupe_key=None,
    )
    db.add(post)
    db.flush()

    _spawn_npc_comments(db, character, post)

    # Promoting a song gives it a one-time reach bump (only the first promo of
    # that song counts, so re-posting the same track can't be farmed).
    boosted = False
    if song is not None:
        prior = (
            db.query(SnsPost)
            .filter(SnsPost.author_id == character.id, SnsPost.song_id == song.id, SnsPost.id != post.id)
            .first()
        )
        if prior is None:
            reach = int(fans * 0.5 + fame * 20) + rng.randint(150, 900)
            song.views = int(song.views or 0) + reach
            character.fans_count = fans + rng.randint(3, 18)
            boosted = True

    db.commit()
    db.refresh(post)
    result = _serialize(
        db, post, character,
        liked_ids=set(), comments_by_post=_comments_for(db, [post.id]), like_counts={},
    )
    result["boosted"] = boosted
    return result


def _spawn_npc_comments(db: Session, character: Character, post: SnsPost) -> None:
    """A few rival NPCs leave deterministic comments on the player's post, so a
    new post never sits there with zero engagement."""
    npcs = db.query(NpcArtist).all()
    if not npcs:
        return
    rng = random.Random(f"snscomments:{post.id}")
    n = min(len(npcs), rng.randint(1, 3))
    for artist in rng.sample(npcs, n):
        db.add(SnsComment(
            post_id=post.id, author_type="npc", author_id=artist.id,
            author_name=artist.name, author_color=artist.color,
            body=rng.choice(NPC_COMMENTS),
        ))


def toggle_like(db: Session, character: Character, post_id: str) -> dict:
    post = db.query(SnsPost).filter(SnsPost.id == post_id, SnsPost.world_id == character.world_id).first()
    if post is None:
        return {"liked": False, "likes": 0}
    row = db.query(SnsLike).filter(SnsLike.post_id == post_id, SnsLike.character_id == character.id).first()
    if row is None:
        db.add(SnsLike(post_id=post_id, character_id=character.id))
        liked = True
    else:
        db.delete(row)
        liked = False
    db.commit()
    likes = post.likes_base + _like_counts(db, [post_id]).get(post_id, 0)
    return {"liked": liked, "likes": likes}


def add_comment(db: Session, character: Character, post_id: str, body: str) -> dict:
    body = (body or "").strip()[:200]
    post = db.query(SnsPost).filter(SnsPost.id == post_id, SnsPost.world_id == character.world_id).first()
    if post is None or not body:
        return {}
    c = SnsComment(
        post_id=post_id, author_type="character", author_id=character.id,
        author_name=character.artist_name, author_color="#E8A33D", body=body,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return {
        "id": c.id, "author_name": c.author_name, "author_color": c.author_color,
        "author_type": c.author_type, "body": c.body,
    }


def profile(db: Session, character: Character) -> dict:
    posts = (
        db.query(SnsPost)
        .filter(SnsPost.author_type == "character", SnsPost.author_id == character.id)
        .order_by(SnsPost.game_date.desc(), SnsPost.created_at.desc())
        .all()
    )
    ids = [p.id for p in posts]
    liked_ids = _liked_ids(db, character.id, ids)
    comments_by_post = _comments_for(db, ids)
    like_counts = _like_counts(db, ids)
    followers = db.query(Follow).filter(Follow.followed_type == "character", Follow.followed_id == character.id).count()
    following = db.query(Follow).filter(Follow.follower_character_id == character.id).count()
    return {
        "artist_name": character.artist_name,
        "fans_count": int(character.fans_count or 0),
        "followers": followers, "following": following,
        "post_count": len(posts),
        "posts": [_serialize(db, p, character, liked_ids, comments_by_post, like_counts) for p in posts],
    }
