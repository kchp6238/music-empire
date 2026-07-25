"""Year-end music awards (연말 시상식).

When the in-game calendar rolls into a new year, the year that just ended gets a
ceremony: the player and the NPC rivals compete for 신인상 / 올해의 곡 /
올해의 음반 / 대상 based on what they released that year. Winners are picked
deterministically from the world's data (so every member sees the same result),
announced as news, and if the player wins they get a milestone fame/fans/money
boost.
"""

from datetime import date

from sqlalchemy.orm import Session

from app.models.character import Character
from app.models.song import Song
from app.models.npc import NpcSong, NpcArtist
from app.models.news import NewsItem

# Player rewards for winning — a yearly award is a big deal.
AWARD_REWARDS = {
    "rookie": {"fame": 8, "fans": 2000, "money": 3000000},
    "song": {"fame": 10, "fans": 3000, "money": 5000000},
    "album": {"fame": 10, "fans": 3000, "money": 5000000},
    "daesang": {"fame": 15, "fans": 8000, "money": 12000000},
}
LABELS = {"rookie": "신인상", "song": "올해의 곡", "album": "올해의 음반", "daesang": "대상"}


def _entries_for_world(db: Session, world_id: str):
    """All released songs in a world with a normalized shape, plus each artist's
    debut year (for the rookie award)."""
    chars = db.query(Character).filter(Character.world_id == world_id).all()
    char_ids = [c.id for c in chars]
    name_by_char = {c.id: c.artist_name for c in chars}

    entries = []          # per-song
    debut_year = {}       # artist_key -> earliest release year (all time)

    if char_ids:
        for s in db.query(Song).filter(Song.character_id.in_(char_ids), Song.released_on.isnot(None)).all():
            key = ("character", s.character_id)
            entries.append({
                "key": key, "type": "character", "id": s.character_id, "name": name_by_char.get(s.character_id, "?"), "color": None,
                "title": s.title, "score": float(s.overall_score or 0), "views": int(s.views or 0),
                "year": s.released_on.year, "genre": (s.genre_tags or [None])[0],
            })
            debut_year[key] = min(debut_year.get(key, 9999), s.released_on.year)

    for ns, artist in db.query(NpcSong, NpcArtist).join(NpcArtist, NpcSong.npc_artist_id == NpcArtist.id).filter(NpcSong.world_id == world_id).all():
        key = ("npc", ns.npc_artist_id)
        entries.append({
            "key": key, "type": "npc", "id": ns.npc_artist_id, "name": artist.name, "color": artist.color,
            "title": ns.title, "score": float(ns.score), "views": int(float(ns.score) ** 2 * 2),
            "year": ns.released_on.year, "genre": artist.genre,
        })
        debut_year[key] = min(debut_year.get(key, 9999), ns.released_on.year)

    return entries, debut_year


def _compute_winners(db: Session, world_id: str, year: int) -> list[dict]:
    entries, debut_year = _entries_for_world(db, world_id)
    year_songs = [e for e in entries if e["year"] == year]
    if not year_songs:
        return []

    winners = []

    def _g(e):
        return f"{e['genre']} " if e.get("genre") else ""

    # 올해의 곡: single highest-scoring song (tiebreak views).
    song = max(year_songs, key=lambda e: (e["score"], e["views"]))
    winners.append({"category": "song", "winner": song, "detail": f"{_g(song)}'{song['title']}' ({round(song['score'])}점)"})

    # 대상: artist with the most total views this year.
    by_artist_views = {}
    by_artist_scores = {}
    by_artist_name = {}
    for e in year_songs:
        by_artist_views[e["key"]] = by_artist_views.get(e["key"], 0) + e["views"]
        by_artist_scores.setdefault(e["key"], []).append(e["score"])
        by_artist_name[e["key"]] = {"type": e["type"], "id": e["id"], "name": e["name"], "color": e.get("color")}
    top_key = max(by_artist_views, key=lambda k: by_artist_views[k])
    winners.append({"category": "daesang", "winner": by_artist_name[top_key],
                    "detail": f"올해 총 {by_artist_views[top_key]:,} 조회수"})

    # 올해의 음반: best average score among artists with >=2 releases this year.
    eligible = {k: sum(v) / len(v) for k, v in by_artist_scores.items() if len(v) >= 2}
    if eligible:
        best_key = max(eligible, key=lambda k: eligible[k])
        winners.append({"category": "album", "winner": by_artist_name[best_key],
                        "detail": f"평균 {round(eligible[best_key], 1)}점 · {len(by_artist_scores[best_key])}곡"})

    # 신인상: among artists who debuted this year, the best top-song.
    rookie_songs = [e for e in year_songs if debut_year.get(e["key"]) == year]
    if rookie_songs:
        r = max(rookie_songs, key=lambda e: (e["score"], e["views"]))
        winners.append({"category": "rookie", "winner": r, "detail": f"{_g(r)}'{r['title']}'로 데뷔"})

    return winners


def check_year_awards(db: Session, character: Character) -> list[dict]:
    """Grant any not-yet-awarded completed years. Called after time advances."""
    granted = []
    while character.last_awarded_year < character.game_date.year - 1:
        year = character.last_awarded_year + 1
        character.last_awarded_year = year
        for w in _compute_winners(db, character.world_id, year):
            cat = w["category"]
            win = w["winner"]
            i_won = win["type"] == "character" and win["id"] == character.id
            body = f"{year}년 {LABELS[cat]}은(는) '{win['name']}'! ({w['detail']})"
            if i_won:
                rw = AWARD_REWARDS[cat]
                character.fame = max(0.0, min(100.0, float(character.fame) + rw["fame"]))
                character.fans_count = max(0, character.fans_count + rw["fans"])
                character.money = max(0.0, float(character.money) + rw["money"])
                body += f" 🎉 축하합니다! 명성 +{rw['fame']}, 팬 +{rw['fans']:,}, 상금 {rw['money']:,}원."
            db.add(NewsItem(
                character_id=character.id, game_date=date(year, 12, 31), kind="award", icon="🏆",
                title=f"{year} 시상식 · {LABELS[cat]}", body=body,
                subject_type=win["type"], subject_id=win["id"], subject_name=win["name"],
                subject_color=win.get("color") or "#E8C34D",
            ))
            granted.append({"year": year, "category": cat, "winner": win["name"], "i_won": i_won})
    return granted
