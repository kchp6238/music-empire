# 배포 가이드 (Vercel + Railway)

> 목표: 인터넷 주소로 다른 사람들이 접속해서 같이 플레이. 내 PC가 꺼져 있어도 동작.
>
> **구조**: 프론트엔드(Vercel) → 백엔드(Railway) → Postgres(Railway)

**이 문서의 단계는 직접 하셔야 합니다.** 계정 생성·결제 수단 등록·배포 버튼 클릭은 대신 해드릴 수 없습니다. 코드와 설정 파일은 모두 준비되어 있습니다.

---

## ⭐ Railway 무료 트라이얼 종료 → Render + Neon로 무료 이전 (~2026-08-06 전)

> Railway 무료 크레딧이 곧 끝납니다. **카드 등록 없이 계속 무료**로 돌릴 조합:
>
> **프론트: Vercel (그대로)** · **백엔드: Render 무료** · **DB: Neon 무료 Postgres**
>
> 코드는 이미 어떤 Postgres와도 호환됩니다(`DATABASE_URL` + `db/session.py`의 URL 정규화). **백엔드 코드 수정은 없습니다.** 저장소 루트의 `render.yaml`이 Render 배포를 자동 구성합니다.

**트레이드오프**: Render 무료 웹서비스는 15분간 요청이 없으면 잠들고, 그다음 첫 요청 때 ~30초 깨어납니다(그 요청만 느림). DB(Neon)는 안 사라집니다. 항상 켜둬야 하면 Railway Hobby($5/월)가 대안.

### A. Neon Postgres 만들기 (무료, 카드 X)

1. [neon.tech](https://neon.tech) 가입 → **Create project** (리전은 아무거나, 서울이면 좋음)
2. 대시보드에서 **Connection string** 복사. 두 종류가 보이면 **`-pooler`가 없는 "직접(Direct)" 문자열**을 쓰세요.
   > 이유: 이 앱은 psycopg 3를 쓰는데, Neon의 pooler(pgBouncer)는 prepared statement와 충돌할 수 있습니다. 소규모라 직접 연결로 충분합니다.
   > 형태: `postgresql://user:pass@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
   > `sslmode=require`는 그대로 두세요 — 코드가 이 뒤를 보존해서 psycopg에 전달합니다.

### B. 백엔드 배포 (Render, 무료, 카드 X)

1. [render.com](https://render.com) 가입 → **New +** → **Blueprint** → 이 GitHub 저장소 선택
   > 루트의 `render.yaml`을 읽어 서비스를 자동 구성합니다. (Blueprint가 안 보이면 **New + → Web Service**로 만들고 Root Directory `backend`, Start Command는 `render.yaml`의 `startCommand`를 복붙.)
2. 배포 전 환경변수 3개를 채우라고 물어봅니다(`sync: false`로 표시된 것):

   | 변수 | 값 |
   |---|---|
   | `DATABASE_URL` | A에서 복사한 Neon **직접** 연결 문자열 |
   | `INVITE_CODES` | 정한 초대 코드 (예: `music-empire-2026`) |
   | `CORS_ORIGINS` | 기존 Vercel 주소 (예: `https://music-empire.vercel.app`) |

   > `JWT_SECRET`은 Render가 자동 생성(`generateValue`), `ENVIRONMENT=production`도 자동 설정됩니다.
3. **Apply / Deploy** → 첫 배포 로그에서 `alembic upgrade head`가 성공하는지 확인.
4. Render가 준 주소(`https://music-empire-backend.onrender.com`) → `/health` 열어 `{"status":"ok"}` 확인. (잠들어 있으면 첫 로딩 ~30초)

### C. 프론트를 새 백엔드로 연결

1. [vercel.com](https://vercel.com) → 프로젝트 → **Settings → Environment Variables**
2. `VITE_API_URL`을 **B의 Render 주소**로 변경 (끝에 `/` 없이) → **Redeploy**.

이게 끝입니다. Railway 프로젝트는 이제 지워도 됩니다.

> **기존 데이터(계정·곡)는 새 DB로 자동 이전되지 않습니다.** 새로 시작하면 시드(NPC·월드)는 자동 생성되고 플레이어만 다시 가입하면 됩니다. 기존 데이터를 꼭 옮기려면 Railway Postgres에서 `pg_dump` → Neon으로 `psql` 복원(원하면 명령을 만들어 드릴게요).

---

## (기존) Railway로 배포하는 경우

아래는 Railway를 계속 쓸 때의 원래 절차입니다. 위 무료 이전을 택했다면 건너뛰세요.

## 0. 사전 준비

1. **GitHub에 코드 올리기** — Vercel/Railway 둘 다 GitHub 저장소에서 배포합니다.
   ```bash
   cd C:\Users\a0108\projects\music-empire
   git remote add origin https://github.com/<내계정>/music-empire.git
   git push -u origin master
   ```
   > `.gitignore`에 `.env`가 있어 로컬 비밀값은 올라가지 않습니다. 확인만 한 번 하세요.

2. **JWT 시크릿 생성** — 아래 명령으로 나온 값을 어딘가 적어두세요.
   ```bash
   cd backend
   .\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

3. **초대 코드 정하기** — 예: `music-empire-2026`. 친구들에게 알려줄 값입니다.

---

## 1. 백엔드 + DB (Railway)

1. [railway.app](https://railway.app) 로그인 → **New Project** → **Deploy from GitHub repo** → 저장소 선택
2. 서비스 설정에서 **Root Directory**를 `backend`로 지정
3. 같은 프로젝트에 **+ New** → **Database** → **Add PostgreSQL**
4. 백엔드 서비스 → **Variables** 탭에서 아래를 추가:

   | 변수 | 값 |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (Railway가 자동 연결) |
   | `JWT_SECRET` | 0번에서 생성한 값 |
   | `ENVIRONMENT` | `production` |
   | `INVITE_CODES` | 정한 초대 코드 (쉼표로 여러 개 가능) |
   | `CORS_ORIGINS` | 일단 비워두고, 2번에서 Vercel 주소 받은 뒤 채웁니다 |

5. **Settings → Networking → Generate Domain**으로 공개 주소를 만듭니다.
   → `https://xxx.up.railway.app` 형태. 이 주소를 적어두세요.
6. 잘 떴는지 확인: 브라우저에서 `https://<railway주소>/health` → `{"status":"ok"}`

> 마이그레이션과 시드는 `railway.json`의 시작 명령에 포함되어 있어 배포할 때 자동 실행됩니다.

---

## 2. 프론트엔드 (Vercel)

1. [vercel.com](https://vercel.com) 로그인 → **Add New Project** → 같은 저장소 선택
2. **Root Directory**를 `frontend`로 지정 (Framework는 Vite 자동 감지)
3. **Environment Variables**에 추가:

   | 변수 | 값 |
   |---|---|
   | `VITE_API_URL` | 1번에서 받은 Railway 주소 (끝에 `/` 없이) |

4. **Deploy** → 완료되면 `https://xxx.vercel.app` 주소가 나옵니다.

---

## 3. 마지막 연결 (중요)

Railway로 돌아가 `CORS_ORIGINS`에 **2번의 Vercel 주소**를 넣고 저장 → 자동 재배포.

```
CORS_ORIGINS=https://xxx.vercel.app
```

> 이걸 안 하면 화면은 뜨는데 로그인·저장이 전부 실패합니다 (브라우저가 API 요청을 차단). 증상은 "아무것도 안 됨"이라 원인을 찾기 어려우니 꼭 확인하세요.

이제 Vercel 주소를 친구들에게 공유하고, **초대 코드**를 알려주면 가입할 수 있습니다.

---

## 배포된 서버에서 달라지는 점

- **가입에 초대 코드 필요** (`INVITE_CODES` 설정 시). 코드를 바꾸려면 변수만 수정하면 됩니다 — 기존 가입자는 영향 없습니다.
- **로그인 유지 14일**. 만료되면 자동으로 로그인 화면으로 돌아갑니다.
- **녹음 파일은 DB에 저장**됩니다. PaaS는 디스크가 재배포마다 초기화되기 때문입니다. 1인당 200MB, 파일당 10MB 제한.
- **기본 JWT 시크릿으로는 기동을 거부**합니다 (`ENVIRONMENT=production`일 때). 저장소가 공개돼 있으면 샘플 시크릿으로 누구나 토큰을 위조할 수 있기 때문입니다.
- 가입은 IP당 시간당 5회, 로그인은 5분당 10회로 제한됩니다.

## 알려진 제약

- **레이트 리밋이 프로세스 메모리 기반**입니다. 재배포하면 초기화되고, 인스턴스를 여러 개로 늘리면 인스턴스마다 따로 셉니다. 소규모 초대제 서버 기준으로는 충분하지만, 규모가 커지면 Redis 기반으로 바꿔야 합니다.
- **녹음 파일을 DB에 넣는 방식은 수 GB까지가 한계**입니다. 그 이상은 S3/R2 같은 오브젝트 스토리지로 옮겨야 합니다.
- **초대 코드는 재사용 가능**하고 사용 이력을 남기지 않습니다. 코드가 유출되면 누구나 가입할 수 있으니, 그럴 땐 변수를 바꿔 교체하세요.
- **리프레시 토큰이 없습니다.** 14일이 지나면 다시 로그인해야 합니다.
- **Postgres 환경은 로컬에서 검증하지 못했습니다** (개발 PC에 Docker/Postgres 없음). 코드는 SQLite/Postgres 양쪽 호환으로 작성했고 URL 변환·연결 유지 설정도 넣었지만, 첫 배포 때 마이그레이션 로그를 꼭 확인하세요.

## 문제가 생기면

| 증상 | 확인할 것 |
|---|---|
| 화면은 뜨는데 로그인·저장이 다 실패 | `CORS_ORIGINS`에 Vercel 주소가 정확히(https 포함, 끝 슬래시 없이) 들어갔는지 |
| 새로고침하면 404 | `frontend/vercel.json`이 저장소에 있는지 (SPA 라우팅 처리) |
| 백엔드가 안 뜸 | 로그에서 `JWT_SECRET is still the sample value` → 시크릿 미설정 (Render는 `generateValue`라 보통 자동) |
| 가입이 안 됨 | 초대 코드 오타, 또는 비밀번호 8자 미만 |
| DB 연결 실패 (Railway) | `DATABASE_URL`이 `${{Postgres.DATABASE_URL}}`로 연결됐는지 |
| 첫 요청이 30초쯤 걸림 (Render) | 정상 — 무료 웹서비스가 잠들었다 깨는 중. 이후 요청은 빠름 |
| `prepared statement ... already exists` (Neon) | pooler 문자열을 썼을 때. `-pooler` 없는 **직접** 연결 문자열로 교체 |
| Render 배포는 됐는데 로그인 실패 | `CORS_ORIGINS`에 Vercel 주소, `VITE_API_URL`에 Render 주소가 서로 맞게 들어갔는지 |
