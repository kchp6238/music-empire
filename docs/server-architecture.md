# 서버 아키텍처

## 1. 전체 구조

```
Frontend (Vite/React)  ──HTTPS/REST──▶  FastAPI (backend/)
                        ──WebSocket──▶  (콘서트 등 실시간 전용 채널, MVP 이후)
                                              │
                                              ▼
                                        PostgreSQL (docker-compose 로컬 / Railway·Render 운영)
```

REST가 기본이며, WebSocket은 **실시간이 필수인 기능에만** 국한한다 (콘서트 동시 접속, MVP 이후). 곡 CRUD/발매/피드/차트는 전부 REST — GDD §11 "개인 세계 + 온라인 연결" 구조상 실시간 동시성이 필요한 지점이 원래 적기 때문에 REST 우선이 서버 복잡도를 크게 낮춘다.

## 2. 인증

**JWT(Access Token) 기반**으로 확정한다 (세션 기반 대비 선택 이유: 프론트/백엔드가 별도 배포 대상(Vercel/Railway)이라 쿠키 세션의 CORS·도메인 이슈보다 Authorization 헤더 기반 JWT가 배포 조합에 더 잘 맞음).

- `POST /auth/register`, `POST /auth/login` → `{access_token, token_type: "bearer"}`
- 클라이언트는 `localStorage`에 토큰 저장, 요청마다 `Authorization: Bearer <token>` 헤더
- Access token 만료 15~30분 짧게 두고 refresh token(httpOnly 쿠키 or 별도 저장)으로 갱신 — MVP는 access token만으로 시작하고 refresh는 로드맵으로 미룰 수 있음(§8 MVP 계획에서 범위 확정)
- 비밀번호는 bcrypt 해시, 평문 저장/로그 금지

## 3. 서버 사이드 재계산 원칙 (필수)

> 핸드오프 문서 §3.4의 명시적 요구사항: **클라이언트에서 계산한 점수를 그대로 신뢰하지 않는다.**

- 클라이언트의 `computeRelease()`(JS)는 **미리보기 전용**이다. 발매 버튼을 눌러 `POST /songs/{id}/release`를 호출하면, 서버가 저장된 `pattern`/`stats`/`talent`/`chord_preset_id` 등 원본 입력으로부터 **`backend-architecture.md`의 `scoring.py`를 직접 재실행**해 craft/originality/accessibility/experimental/overall_score/tier를 다시 계산하고 그 결과만 DB에 저장한다.
- 클라이언트가 발매 요청에 점수 필드를 함께 보내더라도 서버는 이를 무시한다 (요청 스키마에 애초에 점수 필드를 받지 않도록 Pydantic 모델 설계).
- Python `scoring.py`는 JS `computeRelease()`와 **동일한 공식·가중치**를 가져야 한다 (implementation-order.md §5 검증 단계에서 수치 일치 확인).

## 4. 캐싱 / 랭킹 갱신

- 차트는 core-loop.md §3에 따라 **주 단위 배치**다. MVP 단계에서는 크론 없이 **조회 시점 lazy 계산 + 짧은 캐시(예: 5분 TTL, in-memory 또는 Redis 없이 FastAPI 프로세스 메모리 캐시로 시작)**로 충분하다. 트래픽이 늘면 Redis 캐시 또는 스케줄된 배치 잡(Railway Cron / APScheduler)으로 전환.
- 팬 이탈/유입 배치는 core-loop.md §5대로 **로그인 시 1회성 계산** — 별도 상시 워커 불필요.

## 5. 배포 토폴로지 (사용자 기존 경험 기준)

- 프론트엔드: Vercel
- 백엔드: Railway 또는 Render (FastAPI + PostgreSQL 애드온)
- 로컬 개발: `docker-compose.yml`로 Postgres만 컨테이너화, 백엔드/프론트엔드는 로컬 프로세스로 실행 (핫리로드 편의성)

## 6. 에러/치팅 방지 요약

| 벡터 | 방어 |
|---|---|
| 클라이언트가 점수 조작 후 전송 | 서버 재계산 원칙(§3), 응답 스키마에 점수 입력 필드 없음 |
| 발매 스팸으로 차트 오염 | core-loop.md의 "1일 1발매" 제한을 서버가 `characters.id` + 날짜 기준으로 강제 |
| 팬 충성도 조작 | `character_fan_loyalty`는 서버의 발매 재계산 로직에서만 갱신, 클라이언트 직접 쓰기 엔드포인트 없음 |
