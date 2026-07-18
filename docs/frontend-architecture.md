# 프론트엔드 구조

> 현재 단일 파일 프로토타입(`docs/reference_prototype.jsx`)을 아래 기준으로 분해한다. **로직은 재설계하지 않고 그대로 이식**하는 것이 원칙(핸드오프 §7.3).

## 1. 스택

Vite + React + TailwindCSS + react-router + Zustand + Tone.js(그대로 유지).

- **상태관리는 Zustand**로 확정 (Redux Toolkit 대비 선택 이유: 프로토타입의 상태 모양이 이미 단순한 `useState` 여러 개라 보일러플레이트가 큰 Redux보다 Zustand의 훅 기반 스토어가 이식 비용이 낮고, 개인 세계 중심 구조상 복잡한 미들웨어 체인이 필요 없음)
- **라우팅은 react-router** 도입 — 현재 `screen` state로만 화면을 전환하던 것을 실제 URL 기반 라우팅으로 전환해 새로고침/딥링크에 대응

## 2. 디렉터리 구조

```
frontend/src/
  lib/
    gameData/          # BACKGROUNDS, FAN_PERSONAS, CHORD_PRESETS, NPC_ARTISTS,
                        # GENRES, MOODS, SECTION_TYPES, DRUM_INSTRUMENTS, DEFAULT_MIXER 등 상수
    patterns/           # buildCombinedPattern, analyzeCombinedPattern, lyricsWordCount,
                        # emptySection(s), basicPatternForLength, sectionHasContent
    scoring/            # computeRelease.js — 클라이언트 프리뷰용 (서버 결과와 로직 동기화 주의)
    audio/              # Tone.js 신스 생성/재생/정지, 믹서·FX 배선 (React와 분리)
    api/                # fetch 래퍼, 엔드포인트별 함수 (auth/characters/songs/community)
  state/
    characterStore.js   # 캐릭터 상태 (로그인 후 서버에서 로드)
    draftStore.js        # 작업 중인 곡(섹션/트랙/가사/메타데이터) — 로컬 우선, 주기적 서버 자동저장
    audioStore.js         # 재생 상태(isPlaying/currentStep/playingId)
    communityStore.js     # 피드/차트/팔로우 캐시
  components/
    shared/              # Fader, MiniBar, DrumRow, PianoRoll, PianoKeyRoll, MixerRow, TopBar
    character/            # CharacterCreation.jsx
    studio/                # StudioScreen.jsx
    beatmaker/              # BeatmakerScreen.jsx, DrumGrid.jsx, PianoRollPanel.jsx, Mixer.jsx
    community/               # CommunityScreen.jsx, Feed.jsx, Chart.jsx
  routes/
    index.jsx  (라우터 정의: /, /create, /studio, /beatmaker, /community)
  App.jsx
  main.jsx
```

## 3. 상태 소유권 원칙

| 상태 | 소유자 | 서버 동기화 시점 |
|---|---|---|
| 로그인 세션(JWT) | `authStore` (localStorage 영속) | 로그인/로그아웃 시 |
| 캐릭터(명성/자금/팬/스탯) | `characterStore` | 캐릭터 생성 시 POST, 이후 발매 응답으로 갱신(서버가 유일한 진실 소스) |
| 곡 초안(섹션/트랙/가사) | `draftStore` | 로컬 우선 편집, 디바운스 후 `PATCH /songs/{id}` 자동저장, 발매 시 `POST /songs/{id}/release` |
| 오디오 재생 상태 | `audioStore` | 서버 동기화 없음 (순수 클라이언트) |
| 피드/차트 | `communityStore` | 탭 진입 시 GET, 좋아요/팔로우는 optimistic update 후 서버 확정 |

## 4. 오디오 엔진 분리

`lib/audio/`는 `synthsRef`/`fxNodesRef`/`sequenceRef`에 해당하는 로직을 순수 모듈 함수로 이식한다 (`createSynthEngine(mixer, fx)`, `playPattern(engine, pattern, bpm, onStep)`, `stopPattern(engine)`). React 컴포넌트는 이 모듈을 `useEffect`로 호출만 하고, Tone.js 객체 생성/해제 로직 자체는 컴포넌트 트리와 결합하지 않는다 — 테스트 용이성과 재사용성(비트메이커 미리듣기 + 커뮤니티 피드 재생이 동일 엔진 공유) 확보.

## 5. 컴포넌트 분해 매핑 (ui-ux.md §5와 동일 표, 세부 하위 분해 추가)

- `BeatmakerScreen` → 섹션 타임라인 + 편집 대상 섹션 선택 상태를 소유, 하위로 `DrumGrid`(7종 드럼 스텝시퀀서), `PianoRollPanel`(베이스/피아노/기타 노트 레인 — `PianoRoll`/`PianoKeyRoll` 재사용), `Mixer`(트랙별 볼륨/뮤트 + 리버브/딜레이 send)를 배치
- `CommunityScreen` → `communityTab` 상태 소유, `Feed`/`Chart` 하위 컴포넌트로 분리, 카드 컴포넌트는 `shared`로 승격 검토(내 곡/NPC 곡/실유저 곡이 동일 카드 형태 사용)

## 6. 검증 순서

Stage 2 완료 기준: **백엔드 연동 없이** 로컬 상태만으로 프로토타입과 동일하게 동작(캐릭터 생성 → 곡 작업 → 재생 → 발매 → 결과 확인 → 커뮤니티 피드/차트)하는 것을 먼저 확인한다. 이후 Stage 4에서 `lib/api/`를 붙여 서버 연동으로 전환한다.
