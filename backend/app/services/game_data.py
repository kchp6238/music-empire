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
# `voice` picks which speech register services/reactions.py writes a comment
# in. Without it every persona said the same 15 canned lines, so the fan panel
# read as decoration rather than as nine people with different ears.
#
# Deliberately NOT a fan_personas column: it's fixed per persona identity, so a
# column would mean a migration plus a backfill on every deployed DB (seeding is
# count-gated and never re-runs) to store something the code already knows.
# reactions.py looks it up by name off this list.
FAN_PERSONAS_SEED = [
    {"name": "감성 발라드 러버", "color": "#E893A6", "voice": "soft", "genre_pref": {"발라드": 0.9, "R&B": 0.5, "EDM": -0.6, "힙합": -0.3}, "mood_pref": {"감성적": 0.8, "우울": 0.3, "신남": -0.4}, "openness": 0.2},
    {"name": "클럽 EDM 매니아", "color": "#4FD1C5", "voice": "hype", "genre_pref": {"EDM": 0.9, "팝": 0.4, "발라드": -0.5, "트로트": -0.7}, "mood_pref": {"신남": 0.8, "강렬": 0.6, "우울": -0.5}, "openness": 0.3},
    {"name": "힙합 헤드", "color": "#E8A33D", "voice": "blunt", "genre_pref": {"힙합": 0.9, "R&B": 0.5, "록": 0.2, "발라드": -0.4}, "mood_pref": {"강렬": 0.7, "신남": 0.3, "로맨틱": -0.3}, "openness": 0.4},
    {"name": "인디 시네필", "color": "#8B7FD1", "voice": "critic", "genre_pref": {"인디": 0.9, "재즈": 0.4, "팝": -0.3, "트로트": -0.5}, "mood_pref": {"몽환적": 0.7, "편안함": 0.4, "신남": -0.3}, "openness": 0.8},
    {"name": "올드스쿨 트로트 팬", "color": "#D18B4C", "voice": "elder", "genre_pref": {"트로트": 0.9, "발라드": 0.4, "EDM": -0.8, "힙합": -0.7}, "mood_pref": {"편안함": 0.6, "감성적": 0.5, "강렬": -0.5}, "openness": 0.1},
    {"name": "실험음악 얼리어답터", "color": "#5FBF8F", "voice": "critic", "genre_pref": {"인디": 0.6, "재즈": 0.5, "EDM": 0.3}, "mood_pref": {"실험적": 0.9, "몽환적": 0.5, "편안함": -0.4}, "openness": 0.9},
    {"name": "대중 팝 리스너", "color": "#E8C34D", "voice": "casual", "genre_pref": {"팝": 0.8, "발라드": 0.3, "R&B": 0.3, "EDM": 0.2}, "mood_pref": {"신남": 0.5, "로맨틱": 0.4, "실험적": -0.4}, "openness": 0.3},
    {"name": "록 마니아", "color": "#C4576B", "voice": "blunt", "genre_pref": {"록": 0.9, "인디": 0.4, "트로트": -0.6, "발라드": -0.2}, "mood_pref": {"강렬": 0.8, "신남": 0.4, "편안함": -0.4}, "openness": 0.3},
    {"name": "R&B 소울 리스너", "color": "#7FA8D1", "voice": "soft", "genre_pref": {"R&B": 0.9, "힙합": 0.4, "발라드": 0.3, "EDM": -0.4}, "mood_pref": {"로맨틱": 0.7, "감성적": 0.5, "강렬": -0.2}, "openness": 0.4},
]

# Rival artists. Global roster (every world shares the same 12 names/genres),
# but each world grows its own discography — services/npc_service.py generates
# their releases per world so a solo save has a living chart to climb.
#
# `skill` is the centre of an artist's score band and `consistency` how tightly
# their releases cluster around it: a star lands high every time, a rookie is a
# gamble. `cycle_days` is roughly how often they put something out, so the chart
# turns over at different rates. `moods`/`bpm` shape the generated songs.
NPC_ARTISTS = [
    {"name": "네온 하버", "color": "#4FD1C5", "genre": "EDM", "bio": "클럽 신에서 잔뼈가 굵은 듀오",
     "skill": 80, "consistency": 0.8, "cycle_days": 34, "moods": ["신남", "강렬"], "bpm": (124, 132)},
    {"name": "조용한 새벽", "color": "#E893A6", "genre": "발라드", "bio": "새벽 감성으로 유명한 싱어송라이터",
     "skill": 74, "consistency": 0.75, "cycle_days": 45, "moods": ["감성적", "우울"], "bpm": (68, 82)},
    {"name": "골목길", "color": "#E8A33D", "genre": "힙합", "bio": "로컬 힙합 신의 라이징 스타",
     "skill": 82, "consistency": 0.7, "cycle_days": 28, "moods": ["강렬", "신남"], "bpm": (88, 100)},
    {"name": "유리병 편지", "color": "#8B7FD1", "genre": "인디", "bio": "몽환적인 사운드의 인디 밴드",
     "skill": 66, "consistency": 0.6, "cycle_days": 52, "moods": ["몽환적", "편안함"], "bpm": (92, 108)},
    {"name": "트로트 여왕", "color": "#D18B4C", "genre": "트로트", "bio": "전국 노래자랑 출신의 신흥 강자",
     "skill": 72, "consistency": 0.85, "cycle_days": 40, "moods": ["편안함", "신남"], "bpm": (104, 116)},
    {"name": "미드나잇 소울", "color": "#7FA8D1", "genre": "R&B", "bio": "심야 라디오를 장악한 보컬리스트",
     "skill": 78, "consistency": 0.8, "cycle_days": 38, "moods": ["로맨틱", "감성적"], "bpm": (72, 92)},
    {"name": "백드롭", "color": "#C4576B", "genre": "록", "bio": "홍대 라이브의 전설로 불리는 4인조",
     "skill": 76, "consistency": 0.65, "cycle_days": 46, "moods": ["강렬", "신남"], "bpm": (120, 150)},
    {"name": "코랄 리프", "color": "#E8C34D", "genre": "팝", "bio": "라디오 히트를 몰고 다니는 프로듀서",
     "skill": 84, "consistency": 0.85, "cycle_days": 30, "moods": ["신남", "로맨틱"], "bpm": (100, 118)},
    {"name": "안개주의보", "color": "#5FBF8F", "genre": "인디", "bio": "실험적 편곡으로 평단의 지지를 받는 밴드",
     "skill": 70, "consistency": 0.5, "cycle_days": 58, "moods": ["실험적", "몽환적"], "bpm": (86, 110)},
    {"name": "루프탑 파티", "color": "#4FD1C5", "genre": "EDM", "bio": "페스티벌 무대를 노리는 신예",
     "skill": 62, "consistency": 0.55, "cycle_days": 33, "moods": ["신남", "강렬"], "bpm": (126, 138)},
    {"name": "종이비행기", "color": "#E893A6", "genre": "발라드", "bio": "오디션 프로그램에서 발굴된 목소리",
     "skill": 60, "consistency": 0.6, "cycle_days": 50, "moods": ["감성적", "로맨틱"], "bpm": (66, 80)},
    {"name": "슬로우 모션", "color": "#B794F4", "genre": "R&B", "bio": "느린 그루브를 고집하는 언더그라운드 아티스트",
     "skill": 68, "consistency": 0.7, "cycle_days": 44, "moods": ["감성적", "몽환적"], "bpm": (70, 88)},
]

# Title fragments the generator combines — deliberately generic so any pairing
# reads as a plausible song name regardless of which artist drew it.
NPC_TITLE_A = ["새벽", "네온", "골목", "여름", "빗속", "야간", "은하", "잔상", "파도", "먼지", "바람", "심장",
               "우주", "폭우", "노을", "정오", "겨울밤", "불면", "화양", "리듬"]
NPC_TITLE_B = ["의 끝", "속으로", "이 지나면", "라이트", "무브먼트", "세레나데", "블루스", "그리고 너",
               "런웨이", "드라이브", "레터", "웨이브", "", "", ""]
