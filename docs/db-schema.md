# DB 구조 (PostgreSQL)

> GDD §5.4(Song 개념 모델), §9(FanProfile 개념 모델)를 정식 스키마로 확정한다. 프로토타입의 `computeRelease()` 입출력 구조를 그대로 반영해, 서버 이전(§5, §7) 시 데이터 손실 없이 이식되도록 설계했다.

## 1. ERD 요약

```
users 1─* characters 1─* songs 1─* song_reactions *─1 fan_personas
                    │                  │
                    │                  └─* song_likes / song_comments (실유저 상호작용)
                    ├─* character_fan_loyalty *─1 fan_personas
                    └─* follows (follower_character_id → followed_character_id | followed_npc_id)

npc_artists 1─* npc_songs

(후속) companies 1─* company_members / trainees
```

## 2. 테이블 정의

### `users`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | UUID PK | |
| email | TEXT UNIQUE NOT NULL | |
| password_hash | TEXT NOT NULL | bcrypt |
| created_at | TIMESTAMPTZ DEFAULT now() | |

### `characters`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users.id | 1 유저 1 캐릭터로 MVP 시작 (다중 캐릭터는 로드맵) |
| artist_name | TEXT NOT NULL | |
| background_id | TEXT NOT NULL | `BACKGROUNDS` 상수의 id (unknown/star/producer/genius/trainee/indie/ceo_small/ceo_big/random) |
| background_name | TEXT NOT NULL | 랜덤 배경은 확정된 표시명을 스냅샷으로 저장 |
| stats | JSONB NOT NULL | `{composing, lyrics, arrangement, vocal, production, mixing, business, marketing}` |
| talent | JSONB NOT NULL | `{genius, creativity, ear, charisma, effort, leadership, luck}` |
| fame | NUMERIC NOT NULL | |
| money | NUMERIC NOT NULL | |
| fans_count | INTEGER NOT NULL | |
| created_at | TIMESTAMPTZ DEFAULT now() | |
| updated_at | TIMESTAMPTZ DEFAULT now() | |

### `songs`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | UUID PK | |
| character_id | UUID FK → characters.id | |
| title | TEXT NOT NULL | |
| bpm | INTEGER NOT NULL | |
| genre_tags | TEXT[] | 최대 2개 (앱 레벨 검증) |
| mood_tags | TEXT[] | 최대 2개 |
| chord_preset_id | TEXT NOT NULL | `CHORD_PRESETS` id (p1~p6) |
| production_mode | TEXT NOT NULL | `beginner` \| `expert` |
| vocal_source | TEXT NOT NULL | `self` \| `ai` \| `npc` \| `collab` |
| structure | JSONB NOT NULL | 섹션 배치 배열, 예: `["인트로","벌스","코러스","벌스","코러스","아웃트로"]` |
| pattern | JSONB NOT NULL | 섹션별 `{drums, bass, piano, guitar}` — `emptySections()`/섹션 편집 결과 원본 저장 (재편집·리플레이 가능하도록) |
| lyrics | JSONB | 섹션별 가사 텍스트 |
| craft | NUMERIC | 발매 시 서버가 계산해 저장 (0-100) |
| originality | NUMERIC | |
| accessibility | NUMERIC | |
| experimental | NUMERIC | |
| overall_score | NUMERIC | `SongPerformanceScore` |
| tier | TEXT | 대박/성공/무난/부진/참패 |
| genius_event | BOOLEAN DEFAULT false | |
| sleeper_hit | BOOLEAN DEFAULT false | |
| fans_delta | INTEGER | 발매 당시 스냅샷(감사 추적용, character.fans_count는 누적치가 별도 갱신됨) |
| money_delta | NUMERIC | |
| fame_delta | NUMERIC | |
| released_at | TIMESTAMPTZ | NULL이면 미발매 초안(draft) 상태 |
| created_at | TIMESTAMPTZ DEFAULT now() | |
| updated_at | TIMESTAMPTZ DEFAULT now() | |

> **초안(draft) vs 발매(released) 상태**: `released_at IS NULL`인 행은 작업 중인 곡(자동저장)으로 취급한다. 발매 시점에만 서버가 `computeRelease` 상당 로직(`scoring.py`)을 실행해 craft~fame_delta 필드를 채운다 — 클라이언트가 계산한 값은 미리보기일 뿐 저장하지 않는다.

### `fan_personas`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | SERIAL PK | 프로토타입의 9명을 시드 데이터로 그대로 이식 |
| name | TEXT NOT NULL | |
| color | TEXT | UI 표시용 hex |
| genre_pref | JSONB NOT NULL | `{장르: -1.0~1.0, ...}` |
| mood_pref | JSONB NOT NULL | `{무드: -1.0~1.0, ...}` |
| openness | NUMERIC NOT NULL | 0-1, discoveryOpenness |

### `character_fan_loyalty`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| character_id | UUID FK → characters.id | 복합 PK |
| persona_id | INTEGER FK → fan_personas.id | 복합 PK |
| loyalty_score | NUMERIC DEFAULT 0 | 반복 청취로 축적, core-loop.md §3 배치 계산 대상 |
| updated_at | TIMESTAMPTZ DEFAULT now() | |

### `song_reactions`
개별 발매마다 각 팬 페르소나의 시뮬레이션 반응을 기록 (프로토타입의 `personaResults` 영속화 — 피드 댓글/차트 근거 데이터로 재사용).

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | UUID PK | |
| song_id | UUID FK → songs.id | |
| persona_id | INTEGER FK → fan_personas.id | |
| reached | BOOLEAN | |
| affinity | NUMERIC | -1.0~1.0 |
| reaction_score | NUMERIC | 0-100 |
| comment_line | TEXT | `REACTION_LINES`에서 선택된 문구 스냅샷 |

### `follows`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| follower_character_id | UUID FK → characters.id | 복합 PK 일부 |
| followed_type | TEXT NOT NULL | `character` \| `npc` |
| followed_id | UUID NOT NULL | followed_type에 따라 characters.id 또는 npc_artists.id 참조 (앱 레벨 FK, DB 레벨 CHECK로 타입 검증) |
| created_at | TIMESTAMPTZ DEFAULT now() | |

### `npc_artists` / `npc_songs`
프로토타입 `NPC_ARTISTS` 5명을 시드 데이터로 이식. 실제 유저 콘텐츠가 쌓이기 전 커뮤니티 탭을 채우는 정적 콘텐츠 역할 — 완전히 실유저로 대체할지는 §11 로드맵에서 재검토.

| `npc_artists` | 타입 |
|---|---|
| id | UUID PK |
| name | TEXT |
| color | TEXT |
| genre | TEXT |
| bio | TEXT |

| `npc_songs` | 타입 |
|---|---|
| id | UUID PK |
| npc_artist_id | UUID FK |
| title | TEXT |
| tier | TEXT |
| score | NUMERIC |
| bpm | INTEGER |
| pattern | JSONB |

### `song_likes` / `song_comments` (실유저 소셜 상호작용 — GDD §7)
| `song_likes` | 타입 |
|---|---|
| song_id | UUID FK, 복합 PK |
| user_id | UUID FK, 복합 PK |
| created_at | TIMESTAMPTZ |

| `song_comments` | 타입 |
|---|---|
| id | UUID PK |
| song_id | UUID FK |
| user_id | UUID FK |
| body | TEXT |
| created_at | TIMESTAMPTZ |

## 3. 후속 확장을 위한 자리 (12번 회사 시스템 — 아직 생성하지 않음, 스키마만 예약)

```sql
-- companies(id, owner_character_id, name, founded_at, capital, ...)
-- company_members(company_id, character_id, role, joined_at)
-- trainees(id, company_id, name, stats JSONB, talent JSONB, curriculum_stage, ...)
```
MVP 단계에서는 마이그레이션에 포함하지 않는다 (로드맵 §12 "회사 시스템" 단계에서 별도 Alembic revision으로 추가).

## 4. 인덱스 / 제약 메모

- `songs (character_id, released_at)` 인덱스 — 캐릭터별 발매 이력/차트 쿼리
- `songs (overall_score DESC) WHERE released_at IS NOT NULL` 부분 인덱스 — 차트 랭킹
- `character_fan_loyalty (character_id, persona_id)` 복합 PK 자체가 인덱스 역할
- `follows`는 `(follower_character_id, followed_type, followed_id)` UNIQUE 제약으로 중복 팔로우 방지
