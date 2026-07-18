# Music Empire: The Music Life

플레이어가 음악 산업 안에서 자신만의 인생을 사는 오픈엔디드 음악 라이프 시뮬레이션 게임. 핵심 원칙과 전체 시스템 설계는 [docs/](docs/)를 참고.

- `docs/` — GDD 및 설계 문서 (핵심 루프, UI/UX, DB, 서버/프론트/백엔드 아키텍처, MVP 계획, 로드맵)
- `frontend/` — Vite + React + TailwindCSS + Zustand
- `backend/` — FastAPI + SQLAlchemy + PostgreSQL

## 시작하기

```bash
# 프론트엔드
cd frontend
npm install
npm run dev

# 백엔드
cd backend
python -m venv .venv
.venv/Scripts/activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

자세한 내용은 [docs/mvp-plan.md](docs/mvp-plan.md), [docs/implementation-order.md](docs/implementation-order.md) 참고.
