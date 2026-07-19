"""Python mirror of frontend/src/lib/gameData/constants.js and npcArtists.js.

Kept in sync by hand — see docs/backend-architecture.md §4. Any balance change
made in the JS constants must be mirrored here, and the parity check in
implementation-order.md §1-5 is the guard against drift.
"""

CHORD_PRESETS = [
    {"id": "p1", "name": "I - V - vi - IV", "accessibility": 85, "originality_mod": -15},
    {"id": "p2", "name": "vi - IV - I - V", "accessibility": 75, "originality_mod": -8},
    {"id": "p3", "name": "I - IV - V", "accessibility": 70, "originality_mod": -5},
    {"id": "p4", "name": "ii - V - I", "accessibility": 40, "originality_mod": 12},
    {"id": "p5", "name": "i - bVI - bIII - bVII", "accessibility": 35, "originality_mod": 15},
    {"id": "p6", "name": "불협화음 실험 진행", "accessibility": 20, "originality_mod": 25},
]
CHORD_PRESETS_BY_ID = {c["id"]: c for c in CHORD_PRESETS}

BACKGROUNDS = [
    {"id": "unknown", "name": "무명 음악가",
     "stats": {"composing": 45, "lyrics": 40, "arrangement": 35, "vocal": 40, "production": 35, "mixing": 30, "business": 20, "marketing": 15},
     "talent": {"genius": 50, "creativity": 55, "ear": 50, "charisma": 40, "effort": 60, "leadership": 30, "luck": 50},
     "fame": 5, "money": 800000, "start_age": 22},
    {"id": "star", "name": "유명 가수",
     "stats": {"composing": 35, "lyrics": 35, "arrangement": 30, "vocal": 70, "production": 30, "mixing": 25, "business": 40, "marketing": 55},
     "talent": {"genius": 45, "creativity": 45, "ear": 55, "charisma": 75, "effort": 50, "leadership": 45, "luck": 55},
     "fame": 55, "money": 3000000, "start_age": 26},
    {"id": "producer", "name": "신인 프로듀서",
     "stats": {"composing": 55, "lyrics": 35, "arrangement": 60, "vocal": 25, "production": 65, "mixing": 60, "business": 35, "marketing": 30},
     "talent": {"genius": 55, "creativity": 55, "ear": 65, "charisma": 40, "effort": 55, "leadership": 40, "luck": 50},
     "fame": 10, "money": 1200000, "start_age": 25},
    {"id": "genius", "name": "천재 작곡가",
     "stats": {"composing": 70, "lyrics": 55, "arrangement": 60, "vocal": 30, "production": 45, "mixing": 35, "business": 10, "marketing": 10},
     "talent": {"genius": 85, "creativity": 80, "ear": 75, "charisma": 30, "effort": 45, "leadership": 20, "luck": 45},
     "fame": 8, "money": 600000, "start_age": 21},
    {"id": "trainee", "name": "연습생",
     "stats": {"composing": 25, "lyrics": 25, "arrangement": 25, "vocal": 55, "production": 20, "mixing": 15, "business": 15, "marketing": 20},
     "talent": {"genius": 45, "creativity": 45, "ear": 50, "charisma": 55, "effort": 70, "leadership": 25, "luck": 50},
     "fame": 15, "money": 300000, "start_age": 18},
    {"id": "indie", "name": "인디 뮤지션",
     "stats": {"composing": 55, "lyrics": 60, "arrangement": 50, "vocal": 50, "production": 45, "mixing": 40, "business": 20, "marketing": 20},
     "talent": {"genius": 60, "creativity": 70, "ear": 60, "charisma": 45, "effort": 60, "leadership": 35, "luck": 50},
     "fame": 12, "money": 500000, "start_age": 24},
    {"id": "ceo_small", "name": "신생 기획사 대표",
     "stats": {"composing": 30, "lyrics": 25, "arrangement": 25, "vocal": 20, "production": 35, "mixing": 25, "business": 65, "marketing": 60},
     "talent": {"genius": 40, "creativity": 40, "ear": 45, "charisma": 60, "effort": 55, "leadership": 70, "luck": 45},
     "fame": 20, "money": 5000000, "start_age": 34},
    {"id": "ceo_big", "name": "대형 기획사 대표",
     "stats": {"composing": 25, "lyrics": 20, "arrangement": 20, "vocal": 15, "production": 40, "mixing": 30, "business": 80, "marketing": 80},
     "talent": {"genius": 40, "creativity": 35, "ear": 40, "charisma": 65, "effort": 50, "leadership": 80, "luck": 50},
     "fame": 45, "money": 30000000, "start_age": 45},
]
BACKGROUNDS_BY_ID = {b["id"]: b for b in BACKGROUNDS}

# Seed-only: inserted into fan_personas by app/seed.py, then read back from the
# DB at request time (see services/scoring.py) so character_fan_loyalty stays
# authoritative and in sync with persona ids.
FAN_PERSONAS_SEED = [
    {"name": "감성 발라드 러버", "color": "#E893A6", "genre_pref": {"발라드": 0.9, "R&B": 0.5, "EDM": -0.6, "힙합": -0.3}, "mood_pref": {"감성적": 0.8, "우울": 0.3, "신남": -0.4}, "openness": 0.2},
    {"name": "클럽 EDM 매니아", "color": "#4FD1C5", "genre_pref": {"EDM": 0.9, "팝": 0.4, "발라드": -0.5, "트로트": -0.7}, "mood_pref": {"신남": 0.8, "강렬": 0.6, "우울": -0.5}, "openness": 0.3},
    {"name": "힙합 헤드", "color": "#E8A33D", "genre_pref": {"힙합": 0.9, "R&B": 0.5, "록": 0.2, "발라드": -0.4}, "mood_pref": {"강렬": 0.7, "신남": 0.3, "로맨틱": -0.3}, "openness": 0.4},
    {"name": "인디 시네필", "color": "#8B7FD1", "genre_pref": {"인디": 0.9, "재즈": 0.4, "팝": -0.3, "트로트": -0.5}, "mood_pref": {"몽환적": 0.7, "편안함": 0.4, "신남": -0.3}, "openness": 0.8},
    {"name": "올드스쿨 트로트 팬", "color": "#D18B4C", "genre_pref": {"트로트": 0.9, "발라드": 0.4, "EDM": -0.8, "힙합": -0.7}, "mood_pref": {"편안함": 0.6, "감성적": 0.5, "강렬": -0.5}, "openness": 0.1},
    {"name": "실험음악 얼리어답터", "color": "#5FBF8F", "genre_pref": {"인디": 0.6, "재즈": 0.5, "EDM": 0.3}, "mood_pref": {"실험적": 0.9, "몽환적": 0.5, "편안함": -0.4}, "openness": 0.9},
    {"name": "대중 팝 리스너", "color": "#E8C34D", "genre_pref": {"팝": 0.8, "발라드": 0.3, "R&B": 0.3, "EDM": 0.2}, "mood_pref": {"신남": 0.5, "로맨틱": 0.4, "실험적": -0.4}, "openness": 0.3},
    {"name": "록 마니아", "color": "#C4576B", "genre_pref": {"록": 0.9, "인디": 0.4, "트로트": -0.6, "발라드": -0.2}, "mood_pref": {"강렬": 0.8, "신남": 0.4, "편안함": -0.4}, "openness": 0.3},
    {"name": "R&B 소울 리스너", "color": "#7FA8D1", "genre_pref": {"R&B": 0.9, "힙합": 0.4, "발라드": 0.3, "EDM": -0.4}, "mood_pref": {"로맨틱": 0.7, "감성적": 0.5, "강렬": -0.2}, "openness": 0.4},
]
