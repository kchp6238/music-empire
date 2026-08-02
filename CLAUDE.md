# Music Empire

음악 산업 오픈엔디드 라이프 시뮬레이션 게임 (웹 앱). 설계 원문은 `docs/` 참고.

## Stack
- **frontend/**: React 19 + Vite 8 + TailwindCSS 4 + Zustand 5 + react-router 7 + framer-motion + Tone.js(오디오) + PWA. Lint: oxlint.
- **backend/**: FastAPI + SQLAlchemy + PostgreSQL. 배포: Railway.

## Run
```bash
# frontend (port 5173)
cd frontend && npm install && npm run dev
# backend
cd backend && python -m venv .venv && .venv/Scripts/activate && pip install -r requirements.txt && uvicorn app.main:app --reload
```

## Layout
- `frontend/src/`: `components/` UI · `state/` Zustand 스토어 · `lib/` 유틸 · `App.jsx` 라우팅 진입점
- `backend/app/`: `routers/` API 엔드포인트 · `models/` DB 모델 · `schemas/` Pydantic · `services/` 비즈니스 로직 · `db/` 세션 · `deps.py` 의존성 · `seed.py` 시드
- `docs/`: GDD·아키텍처·MVP 계획. 핵심 게임 루프는 `docs/core-loop.md`, 구현 순서는 `docs/implementation-order.md`.

## Conventions
- 프론트 상태는 Zustand 스토어(`frontend/src/state/`)로 관리 — 컴포넌트에 로직 몰지 말 것.
- 백엔드는 라우터→서비스→모델 계층 분리 유지.
- 파일은 단일 책임, 가급적 짧게. 오디오는 Tone.js 사용.

## Notes
- Railway 무료 트라이얼 종료 예정(~2026-08-06). 무료 유지 경로는 **Render(백엔드) + Neon(Postgres)** — 루트 `render.yaml` 블루프린트 + `docs/deployment.md` 상단 이전 가이드 참고. 코드는 host-agnostic(`DATABASE_URL` + `db/session.py` 정규화), 백엔드 수정 불필요.
