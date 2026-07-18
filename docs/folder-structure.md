# 폴더 구조

> 3.9(핸드오프 문서)에서 제안한 구조를 기준으로 실제 생성된 모노레포 트리. 문서를 먼저 쓰고 나중에 맞추는 대신, 실제 스캐폴딩 이후 이 문서를 채웠다.

```
music-empire/
  frontend/                      # Vite + React + TailwindCSS + Zustand + react-router
    src/
      lib/
        gameData/
          constants.js           # BACKGROUNDS, FAN_PERSONAS, CHORD_PRESETS, GENRES, MOODS, ...
          npcArtists.js          # NPC_ARTISTS (5명, 고정 패턴 포함)
        patterns/
          index.js               # buildCombinedPattern, analyzeCombinedPattern, emptySection(s), ...
        scoring/
          computeRelease.js      # 클라이언트 프리뷰 — 서버가 유일한 진실 소스 (server-architecture.md §3)
        audio/
          engine.js              # Tone.js 신스/이펙트/시퀀서 — 모듈 레벨 싱글턴, React와 분리
        utils.js                 # clamp, rand, won
      state/
        useGameStore.js          # 단일 Zustand 스토어 — frontend-architecture.md는 4개 분리 스토어를
                                  # 제안했지만, 실제로는 상태 간 상호 참조가 많아(draft가 character를
                                  # 참조하는 release 로직 등) 단일 스토어가 더 단순해 이렇게 구현함
      components/
        shared/                  # Fader, MiniBar, DrumRow, PianoRoll, PianoKeyRoll, MixerRow, TopBar
        intro/IntroScreen.jsx
        character/CharacterCreation.jsx
        studio/StudioScreen.jsx
        beatmaker/                # BeatmakerScreen.jsx, DrumGrid.jsx, PianoRollPanel.jsx, Mixer.jsx
        community/                 # CommunityScreen.jsx, Feed.jsx, Chart.jsx
        results/ResultsScreen.jsx  # 발매 결과 화면 (ui-ux.md §3에서 신설 제안한 화면)
      App.jsx                    # react-router 라우트 정의 (/, /create, /studio, /beatmaker, /community, /results)
      main.jsx
      index.css                  # Tailwind import + 프로토타입의 me-* 커스텀 클래스 그대로 이식
    scripts/
      parityCheck.mjs            # JS 쪽 스코어링 파리티 체크 러너 (scripts/run-parity-check.sh 참고)
    vite.config.js
    package.json

  backend/                       # FastAPI + SQLAlchemy + Alembic
    app/
      main.py                    # FastAPI 앱, CORS, 라우터 등록
      config.py                  # pydantic-settings (.env)
      db/
        base.py                  # DeclarativeBase
        session.py               # engine/SessionLocal/get_db — SQLite(dev) or Postgres(DATABASE_URL)
      models/                    # db-schema.md 1:1 대응 (JSON/String 타입으로 SQLite·Postgres 겸용)
        user.py, character.py, song.py, fan.py (FanPersona/CharacterFanLoyalty/SongReaction),
        npc.py (NpcArtist/NpcSong), community.py (Follow/SongLike/SongComment)
      schemas/                   # Pydantic 요청/응답 — 응답에 점수 입력 필드 없음 (서버 재계산 원칙)
        auth.py, character.py, song.py, community.py
      services/
        auth_service.py          # bcrypt 해시, JWT 발급/검증
        game_data.py             # BACKGROUNDS/CHORD_PRESETS/FAN_PERSONAS_SEED — constants.js와 수동 동기화
        patterns.py               # buildCombinedPattern/analyzeCombinedPattern의 Python 포팅
        scoring.py                 # computeRelease()의 Python 포팅 — 유일한 실제 점수 산출 로직
        js_math.py                  # js_round() — JS Math.round와 Python round()의 .5 반올림 차이 보정
        characters_service.py        # 배경 프리셋/랜덤 캐릭터 생성
        songs_service.py              # draft CRUD, 발매(서버 재계산), 1일 1발매 제한
        community_service.py           # 피드/차트/팔로우
      routers/
        auth.py, characters.py, songs.py, community.py, fans.py
      deps.py                    # get_current_user (JWT 디펜던시)
      seed.py                    # fan_personas(9) / npc_artists(5) / npc_songs(5) 시드 — 프로토타입 상수 그대로 이식
    scripts/
      parity_check.py            # Python 쪽 스코어링 파리티 체크 러너
    alembic/
      env.py                     # Base.metadata를 settings.database_url에 연결
      versions/                  # 초기 스키마 리비전 1개 (회사 시스템 테이블은 아직 미포함)
    requirements.txt
    .env.example
    docker-compose.yml           # 로컬 Postgres (선택 — 기본은 SQLite)

  scripts/
    parity-fixture.json          # JS/Python 스코어링 비교용 고정 입력값
    run-parity-check.sh          # 두 언어 결과를 비교해 필드별 diff 출력

  docs/
    Music_Empire_GDD.md
    reference_prototype.jsx      # 원본 프로토타입 (이식 완료 후에도 참고용으로 보존)
    core-loop.md
    ui-ux.md
    db-schema.md
    server-architecture.md
    frontend-architecture.md
    backend-architecture.md
    mvp-plan.md
    implementation-order.md
    folder-structure.md          # (이 문서)
    roadmap.md
```

## 실제 구현이 설계 문서와 달라진 지점

- **상태관리**: `frontend-architecture.md`는 `characterStore`/`draftStore`/`audioStore`/`communityStore` 4개 분리를 제안했지만, 실제로는 `useGameStore.js` 단일 스토어로 구현했다. 발매(`handleRelease`) 로직이 draft·character·lastResult를 한 번에 갱신해야 해서 스토어를 가로지르는 트랜잭션이 잦았기 때문 — 서버 연동(Stage 4) 단계에서 서버가 진실 소스가 되면 이 스토어는 얇은 캐시로 성격이 바뀌므로, 그 시점에 재분리 여부를 다시 판단할 것.
- **DB 컬럼 타입**: `db-schema.md`는 Postgres 기준 `JSONB`/`TEXT[]`/`TIMESTAMPTZ`를 명시하지만, 실제 SQLAlchemy 모델은 SQLite(로컬 무설정 개발)와 Postgres(배포) 양쪽에서 동일 코드로 동작하도록 제네릭 `JSON`/`String`/`DateTime`을 사용한다. Postgres 배포 시 네이티브 타입으로 마이그레이션하는 것은 로드맵 항목으로 남겨둔다.
