"""Seed the two global tables: fan_personas (9) and npc_artists (12).

NPC *songs* are no longer seeded here — they belong to a world now and are
generated per world by services/npc_service.py. This seeds only the shared
roster of rival artists; their discographies grow inside each save.

Idempotent: safe to run repeatedly, it only inserts what's missing.
Usage: python -m app.seed
"""

from app.db.session import SessionLocal
from app.db.base import Base
from app.db.session import engine
from app.models.fan import FanPersona
from app.models.npc import NpcArtist
from app.services.game_data import FAN_PERSONAS_SEED, NPC_ARTISTS




def run_seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(FanPersona).count() == 0:
            for p in FAN_PERSONAS_SEED:
                db.add(FanPersona(name=p["name"], color=p["color"], genre_pref=p["genre_pref"], mood_pref=p["mood_pref"], openness=p["openness"]))
        # Add any roster artist that isn't already present, by name — the roster
        # grew from 5 to 12, and a plain count==0 guard would leave a database
        # seeded under the old roster stuck with only the original five rivals.
        existing_names = {n for (n,) in db.query(NpcArtist.name).all()}
        for a in NPC_ARTISTS:
            if a["name"] not in existing_names:
                db.add(NpcArtist(name=a["name"], color=a["color"], genre=a["genre"], bio=a["bio"]))
        db.commit()
        print(f"Seeded: {db.query(FanPersona).count()} fan personas, {db.query(NpcArtist).count()} npc artists (songs generated per world)")
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
