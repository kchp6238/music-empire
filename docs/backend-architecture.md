# 백엔드 구조

## 1. 스택

FastAPI + SQLAlchemy 2.x + Alembic + PostgreSQL + Pydantic v2 + python-jose(JWT) + passlib(bcrypt).

## 2. 디렉터리 구조

```
backend/app/
  main.py              # FastAPI 앱 생성, 라우터 등록, CORS 설정
  config.py            # 환경변수(.env) 로드
  db/
    session.py         # engine/SessionLocal, get_db 디펜던시
    base.py             # declarative Base
  models/              # SQLAlchemy ORM 모델 (db-schema.md 1:1 대응)
    user.py, character.py, song.py, fan_persona.py,
    character_fan_loyalty.py, follow.py, npc_artist.py, npc_song.py,
    song_reaction.py, song_like.py, song_comment.py
  schemas/              # Pydantic 요청/응답 모델 (ORM 모델과 분리 — 응답에 점수 입력 필드 없음)
  services/
    scoring.py           # computeRelease() 포팅 — 유일한 점수 산출 로직, 라우터는 이 함수만 호출
    fan_simulation.py     # 팬 이탈/유입 배치 계산 (core-loop.md §5)
    chart.py                # 주간 차트 집계/캐시
    auth_service.py          # 비밀번호 해시, JWT 발급/검증
  routers/
    auth.py              # /auth/register, /auth/login
    characters.py          # /characters (CRUD, 1유저 1캐릭터 MVP)
    songs.py                 # /songs (draft CRUD, /songs/{id}/release)
    community.py               # /community/feed, /community/chart, /community/follow
    fans.py                      # /fans/{character_id}/loyalty (조회용, 쓰기는 서비스 내부 전용)
  deps.py               # get_current_user 등 공용 디펜던시
  seed.py                # fan_personas / npc_artists / npc_songs 시드 스크립트
alembic/
  versions/
requirements.txt
.env.example
docker-compose.yml
```

## 3. 라우터 ↔ 서비스 원칙

라우터는 **얇게 유지**한다 — 인증/입력검증/디펜던시 주입만 하고, 실제 로직(점수 계산, 팬 시뮬레이션, 차트 집계)은 전부 `services/`에 둔다. 이유: 핸드오프 §3.6 요구사항이자, 향후 협업 시스템/회사 시스템이 추가될 때 라우터를 건드리지 않고 서비스 레이어만 확장 가능해야 하기 때문(GDD §10, §12).

```python
# routers/songs.py (개념 예시 — 실제 구현 시 그대로 사용)
@router.post("/{song_id}/release")
def release_song(song_id: UUID, db: Session = Depends(get_db), user=Depends(get_current_user)):
    song = songs_service.get_owned_draft(db, song_id, user)
    result = scoring.compute_release(song.character, song, db)  # 서버 사이드 재계산, 클라이언트 점수 미신뢰
    return songs_service.finalize_release(db, song, result)
```

## 4. `scoring.py` 이식 규칙

`frontend/src/lib/scoring/computeRelease.js`와 **동일한 상수·가중치·랜덤 분포 형태**를 사용한다:
- `rand(min, max)` → Python `random.uniform(min, max)`
- `clamp` → 동일 헬퍼
- `FAN_PERSONAS`, `CHORD_PRESETS` 등 상수는 `models/fan_persona.py` 시드 데이터(DB)에서 조회하거나 `services/game_data.py`에 JS와 동일한 리터럴로 이중 관리 — **db-schema.md의 시드 데이터가 유일한 소스**이며 JS 상수 파일과 값이 어긋나지 않도록 Stage 4 검증에서 diff 확인

## 5. 인증 디펜던시

```python
# deps.py 개념
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    payload = auth_service.decode_token(token)  # 만료/서명 검증
    return users_service.get(db, payload["sub"])
```
모든 캐릭터/곡 라우터는 `get_current_user`를 거치며, 캐릭터/곡 소유권 검증(`character.user_id == user.id`)을 서비스 레이어에서 재확인한다 (다른 유저의 곡을 발매/수정하는 요청 차단).

## 6. 마이그레이션

Alembic으로 db-schema.md §2의 테이블을 초기 리비전 하나로 생성. §3의 회사 시스템 테이블은 로드맵 단계에서 별도 리비전으로 추가(초기 리비전에 포함하지 않음).
