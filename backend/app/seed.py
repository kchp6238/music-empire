"""Seed fan_personas (9) and npc_artists/npc_songs (5) — ported from
frontend/src/lib/gameData/{constants,npcArtists}.js. Idempotent: safe to
run multiple times, it only inserts what's missing.

Usage: python -m app.seed
"""

from app.db.session import SessionLocal
from app.db.base import Base
from app.db.session import engine
from app.models.fan import FanPersona
from app.models.npc import NpcArtist, NpcSong
from app.services.game_data import FAN_PERSONAS_SEED


def _steps_at(indices, length=16):
    arr = [False] * length
    for i in indices:
        arr[i] = True
    return arr


def _notes_at(pairs, length=16):
    arr = [None] * length
    for i, n in pairs:
        arr[i] = n
    return arr


NPC_ARTISTS_SEED = [
    {"name": "네온 하버", "color": "#4FD1C5", "genre": "EDM", "bio": "클럽 신에서 잔뼈가 굵은 듀오",
     "song": {"title": "Neon Tide", "tier": "성공", "score": 78, "bpm": 128, "pattern": {
         "drums": {
             "kick": _steps_at([0, 4, 8, 12]), "snare": [False] * 16,
             "hihatClosed": _steps_at([0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15]),
             "hihatOpen": _steps_at([2, 6, 10, 14]), "clap": _steps_at([4, 12]),
             "tom": [False] * 16, "crash": _steps_at([0]),
         },
         "bass": _notes_at([(0, "C2"), (2, "C2"), (6, "C2"), (8, "C2"), (14, "C2")]),
         "piano": [None] * 16,
         "guitar": _notes_at([(4, "E4"), (12, "G4")]),
     }}},
    {"name": "조용한 새벽", "color": "#E893A6", "genre": "발라드", "bio": "새벽 감성으로 유명한 싱어송라이터",
     "song": {"title": "새벽 세시", "tier": "성공", "score": 65, "bpm": 72, "pattern": {
         "drums": {
             "kick": _steps_at([0, 8]), "snare": _steps_at([4, 12]), "hihatClosed": [False] * 16,
             "hihatOpen": [False] * 16, "clap": [False] * 16, "tom": [False] * 16, "crash": [False] * 16,
         },
         "bass": _notes_at([(0, "C2"), (8, "A2")]),
         "piano": [None] * 16,
         "guitar": _notes_at([(2, "E4"), (10, "D4")]),
     }}},
    {"name": "골목길", "color": "#E8A33D", "genre": "힙합", "bio": "로컬 힙합 신의 라이징 스타",
     "song": {"title": "골목길 리듬", "tier": "대박", "score": 83, "bpm": 95, "pattern": {
         "drums": {
             "kick": _steps_at([0, 3, 6, 8, 13]), "snare": _steps_at([4, 12]),
             "hihatClosed": _steps_at([0, 2, 3, 5, 6, 8, 10, 11, 13, 14]),
             "hihatOpen": [False] * 16, "clap": _steps_at([15]), "tom": [False] * 16, "crash": [False] * 16,
         },
         "bass": _notes_at([(0, "C2"), (3, "C2"), (6, "D2"), (9, "C2"), (12, "A2")]),
         "piano": [None] * 16,
         "guitar": [None] * 16,
     }}},
    {"name": "유리병 편지", "color": "#8B7FD1", "genre": "인디", "bio": "몽환적인 사운드의 인디 밴드",
     "song": {"title": "유리병 편지", "tier": "무난", "score": 54, "bpm": 100, "pattern": {
         "drums": {
             "kick": _steps_at([0, 10]), "snare": _steps_at([4, 12]),
             "hihatClosed": _steps_at([1, 3, 5, 7, 9, 11, 13, 15]),
             "hihatOpen": [False] * 16, "clap": [False] * 16, "tom": [False] * 16, "crash": [False] * 16,
         },
         "bass": _notes_at([(0, "E2"), (6, "G2"), (12, "D2")]),
         "piano": [None] * 16,
         "guitar": _notes_at([(0, "E4"), (2, "G4"), (4, "A4"), (6, "G4"), (8, "E4"), (10, "G4"), (12, "A4"), (14, "G4")]),
     }}},
    {"name": "트로트 여왕", "color": "#D18B4C", "genre": "트로트", "bio": "전국 노래자랑 출신의 신흥 강자",
     "song": {"title": "인생은 트로트", "tier": "성공", "score": 71, "bpm": 110, "pattern": {
         "drums": {
             "kick": _steps_at([0, 2, 4, 6, 8, 10, 12, 14]), "snare": _steps_at([3, 7, 11, 15]),
             "hihatClosed": [True] * 16, "hihatOpen": [False] * 16, "clap": [False] * 16,
             "tom": [False] * 16, "crash": [False] * 16,
         },
         "bass": _notes_at([(0, "C2"), (2, "G2"), (4, "C2"), (6, "G2"), (8, "C2"), (10, "G2"), (12, "C2"), (14, "G2")]),
         "piano": [None] * 16,
         "guitar": [None] * 16,
     }}},
]


def run_seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(FanPersona).count() == 0:
            for p in FAN_PERSONAS_SEED:
                db.add(FanPersona(name=p["name"], color=p["color"], genre_pref=p["genre_pref"], mood_pref=p["mood_pref"], openness=p["openness"]))
        if db.query(NpcArtist).count() == 0:
            for a in NPC_ARTISTS_SEED:
                artist = NpcArtist(name=a["name"], color=a["color"], genre=a["genre"], bio=a["bio"])
                db.add(artist)
                db.flush()
                s = a["song"]
                db.add(NpcSong(npc_artist_id=artist.id, title=s["title"], tier=s["tier"], score=s["score"], bpm=s["bpm"], pattern=s["pattern"]))
        db.commit()
        print(f"Seeded: {db.query(FanPersona).count()} fan personas, {db.query(NpcArtist).count()} npc artists, {db.query(NpcSong).count()} npc songs")
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
