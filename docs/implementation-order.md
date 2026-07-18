# 구현 순서 (커밋/PR 단위)

> `mvp-plan.md`의 주차별 마일스톤을 실제 작업 단위로 쪼갠 것. 이 저장소의 Stage 0~4(각 단계 커밋 이력 참고)와 대응한다.

## 1. DB 스키마 → 인증 → 캐릭터 API → 곡 저장 API → 평가 엔진 서버 이전 → 프론트 연동 → 커뮤니티 기능

1. **DB 스키마**
   - `backend/app/models/*` 작성 (db-schema.md 1:1)
   - Alembic 초기 리비전 생성 및 적용
   - `seed.py`로 `fan_personas`(9) / `npc_artists`(5) / `npc_songs`(5) 삽입
2. **인증**
   - `POST /auth/register`, `POST /auth/login`, JWT 발급
   - `deps.get_current_user` 디펜던시
3. **캐릭터 API**
   - `POST /characters`(생성, 1유저 1캐릭터 제약), `GET /characters/me`
   - `BACKGROUNDS` 프리셋 적용 로직(랜덤 배경의 지터 계산 포함) 서버 이식
4. **곡 저장 API**
   - `POST /songs`(draft 생성), `PATCH /songs/{id}`(자동저장), `GET /songs/{id}`
   - 발매 전까지는 순수 CRUD, 점수 필드 없음
5. **평가 엔진 서버 이전**
   - `services/scoring.py`에 `computeRelease()` 포팅
   - `POST /songs/{id}/release` 구현 — 서버 재계산 후 songs 행 확정, `song_reactions` 9건 저장, `character_fan_loyalty` 갱신, `characters` 명성/자금/팬 델타 반영
   - **검증**: 고정 입력(캐릭터 스탯/재능 + 패턴 1세트)을 JS `computeRelease.js`와 Python `scoring.py`에 동일하게 넣고 결과 필드별 diff 확인 (허용 오차: 랜덤 요소(`rand`) 관여 필드는 시드 고정 후 비교, 결정론적 필드는 완전 일치 요구)
6. **프론트 연동**
   - `lib/api/` 작성, `authStore`/`characterStore`/`draftStore`를 서버 응답 기준으로 전환
   - 발매 버튼 클릭 시 로컬 미리보기 → 서버 확정 응답으로 교체되는 흐름 구현
7. **커뮤니티 기능**
   - `/community/feed`(최신순, 실유저+NPC 통합), `/community/chart`(주간 집계), `/community/follow`
   - 프론트 `Feed`/`Chart` 컴포넌트를 로컬 상태에서 API 연동으로 전환

## 2. 병렬화 가능 지점

- DB 스키마 확정 이후에는 (인증/캐릭터/곡 API) 백엔드 작업과 (프론트 컴포넌트 분해, 백엔드 미연동) 프론트 작업을 병렬로 진행 가능 — Stage 2와 Stage 3가 이 저장소에서 병렬 가능한 이유
- 단, "평가 엔진 서버 이전" 검증(§1-5)은 프론트의 `computeRelease.js` 이식이 끝난 뒤에만 diff 비교가 가능하므로 Stage 2 완료를 선행 조건으로 둔다

## 3. 완료 판정

각 단계는 아래 결과물이 있어야 "완료"로 간주한다 (문서만 있고 코드가 없는 상태로 다음 단계로 넘어가지 않음):
- DB: `alembic upgrade head`가 로컬에서 성공하고 시드 스크립트 실행 후 9/5/5건 확인
- 인증: `/docs`(OpenAPI)에서 register→login→토큰으로 보호된 엔드포인트 호출 성공
- 곡 저장/발매: 동일 시나리오를 curl 또는 OpenAPI UI로 재현 가능
- 프론트 연동: 브라우저에서 새로고침 후 캐릭터/곡 데이터 유지 확인
