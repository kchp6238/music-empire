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

## 7. DAW급 재제작 (핸드오프 v2 §1-A) — 실제 구현

> MVP 검증용 프로토타입에서 "실제 프로듀서용 미니 DAW"에 가깝게 프론트엔드/오디오 엔진을 전면 재설계했다. 백엔드는 변경하지 않았다 — `Song.pattern`이 백엔드에 불투명 JSON으로 저장되고 `build_combined_pattern`이 알려진 키(`drums`/`bass`/`piano`/`guitar`)만 읽고 나머지는 무시하는 구조 덕분에, 프론트가 섹션 객체에 새 필드(벨로시티 배열 등)를 추가해도 백엔드 변경 없이 그대로 저장·왕복된다.

### 7.1 디자인 시스템
`index.css`에 Tailwind v4 `@theme` 토큰(컬러/폰트)을 정의하고, `components/ui/`에 `Button`(variant: primary/ghost/danger, 실제 `<button>`)/`Panel`/`Pill`/`Input`/`TextArea`/`Select`/`PageTransition`(framer-motion 마운트 트랜지션)을 만들었다. 기존 `.me-*` 클래스는 동일한 토큰 값을 쓰며 전 화면에서 일관되게 이미 쓰이고 있어 "제거 대상 레거시"가 아니라 같은 디자인 시스템의 두 번째 표현 방식으로 유지한다(§1 "화면별로 스타일이 따로 노는" 문제 자체가 처음부터 없었음 — 모든 화면이 동일 토큰의 `.me-*` 클래스를 공유).

접근성: `Feed`/`Chart`/`StudioScreen`의 재생 버튼이 원래 `<span onClick>`이던 것을 실제 `<button aria-label>`로 교체, 아이콘 전용 버튼(로그아웃, 토스트 닫기)에 `aria-label` 추가, 전역 `:focus-visible` 링 적용.

마이크로 인터랙션: `lib/audio/uiSounds.js`(스텝 토글 블립음, 발매 성공 차임벨), 스텝 토글/발매 등 스토어 액션에 연결.

### 7.2 타임라인 기반 편집 (`components/beatmaker/Timeline.jsx`)
"곡 구조" 칩 목록을 실제 DAW 타임라인으로 교체 — 클립 룰러(드래그 재정렬, 오른쪽 끝 드래그로 1마디 단위 리사이즈, 클릭 선택, 삭제) + 4개 활동량 레인(드럼/베이스/피아노/기타, 읽기 전용) + 재생 헤드. 데이터 모델은 그대로(`arrangement` = 순서 있는 섹션 타입 목록, 같은 타입은 패턴 공유) — 시각화·상호작용 레이어만 재설계했다.

### 7.3 정밀 피아노 롤
`bass`/`piano`/`guitar` 배열과 나란히 `bassVelocity`/`pianoVelocity`/`guitarVelocity`(0-127) 배열을 섹션 데이터에 추가(`lib/patterns/index.js`). `PianoRoll`/`PianoKeyRoll`에 드래그 페인트 제스처(같은 행/열의 연속 셀을 드래그하면 한 번에 여러 스텝에 걸친 지속음 생성)를 추가했고, `VelocityLane.jsx`로 벨로시티를 드래그 편집한다(피아노는 좌우 대칭 구조라 오퍼시티+휠 조절로 대체). `engine.js`가 같은 음높이가 연속되는 구간을 하나의 지속음으로 합쳐 재생하고 벨로시티를 게인에 반영한다. 믹서에 휴머나이즈 토글(재생 시 타이밍/벨로시티에 미세한 흔들림, 저장 데이터는 불변)을 추가했다. **다음성(한 트랙에 동시에 여러 음)은 범위 밖** — 스텝당 값 하나 배열 구조로는 표현 불가하며, 백엔드 스키마 변경 없이는 해결할 수 없다.

### 7.4 오디오 엔진 (`lib/audio/engine.js`)
킥/스네어/클랩/크래시를 레이어드·필터링된 복합 보이스로, 하이햇을 필터링된 노이즈로, 베이스를 `MonoSynth`의 실제 `filterEnvelope`로, 피아노를 `PolySynth`+`Chorus`로, 기타를 Tone.js 내장 `PluckSynth`(카플러스-스트롱 현 물리 모델링)로 재구성했다. 마스터 버스에 `Compressor`+`Limiter`를 추가(전 채널 EQ/사이드체인은 범위 밖, 로드맵 참고).

### 7.5 로드맵으로 미룬 것 (§1-A 4~9번)
믹싱 콘솔(멀티밴드 EQ/컴프레서/사이드체인/컨볼루션 리버브), 오토메이션 레인, MIDI 임포트/익스포트, 오디오 렌더링/익스포트(WAV/MP3), 마이크 녹음, undo/redo. `docs/roadmap.md` 참고.
