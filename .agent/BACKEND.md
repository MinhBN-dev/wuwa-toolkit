# Echoes Optimizer — Backend

> Source of truth cho scoring algorithm, dedup, data flow, API surface.

## Tech Stack
FastAPI (Python 3.12) · SQLAlchemy async + asyncpg · PostgreSQL 16 · EasyOCR (local) → Gemini → OpenAI → Anthropic fallback chain · TanStack Query consumed bởi frontend.

## File Map

```
backend/
├── .venv/               Python virtual environment
├── .env                 Local env vars (DB, API keys, etc.)
├── Dockerfile           python:3.12-slim, libpq5 only (no gcc)
├── requirements.txt
└── app/
    ├── main.py          FastAPI app, CORS, lifespan, seeding
    ├── config.py        Pydantic settings (reads .env)
    ├── database.py      SQLAlchemy async engine, Base, get_db, init_db
    ├── models/
    │   └── echo.py      Echo, Character, EchoSet, CharacterProfile ORM models
    ├── schemas/
    │   └── echo.py      Pydantic schemas (request/response)
    ├── routers/
    │   ├── echoes.py    CRUD + find-or-create: /api/v1/echoes
    │   ├── characters.py GET /characters, GET /characters/game-data (incl. ER data)
    │   ├── ocr.py       POST /ocr/extract (image → OCR pipeline)
    │   ├── scoring.py   POST /score/calculate, POST /score/calculate-set
    │   ├── sets.py      CRUD: /sets (saved echo sets)
    │   ├── evc_status.py GET /evc-status, POST /evc-status/acknowledge
    │   └── character_profiles.py GET/PUT/POST /character-profiles (build status + notes)
    ├── services/
    │   ├── ocr_service.py     OCR pipeline (EasyOCR + cloud fallbacks)
    │   └── scoring_service.py EVC weighted scoring algorithm
    └── data/
        └── game_data.py  CHARACTER_DATA, SUBSTAT_MEDIANS, CHARACTER_LIST, TIER_THRESHOLDS, ECHO_SETS, ECHO_ELEMENTS, ECHO_COSTS, MAIN_STAT_OPTIONS
```

## Models

### Character
- id (UUID PK), name (unique), element, weapon_type, role

### Echo
- id (UUID PK)
- character_id (FK nullable)
- echo_name, echo_set, echo_element, echo_cost (1/3/4)
- main_stat_type, main_stat_value (nullable — stored for display, not used in scoring)
- sub_stats (JSON: [{type, value}, ...] max 5)
- total_er (float nullable) — total ER% của cả build
- score, score_percent (float, **uncapped — can exceed 100**), tier (EVC label string e.g. "High Investment")
- image_path (nullable, reserved), notes (nullable, reserved), created_at

### CharacterProfile
- id (UUID PK), character_name (unique, indexed), build_status ('not_built'|'building'|'built'), notes (text nullable), updated_at
- Server-side storage cho Characters page build status + notes (migrated từ localStorage)

### EchoSet
- id (UUID PK), name
- character_id (FK nullable), character_name
- total_er, set_score, set_tier
- slots (JSON list of EchoSetSlot)
- created_at

## API Routes

| Method | Path | Description |
|---|---|---|
| GET | /api/v1/health | Health check |
| GET | /api/v1/characters | List all characters |
| GET | /api/v1/characters/game-data | Static game data + ER targets |
| GET | /api/v1/echoes | List echoes (filter: character_id) |
| POST | /api/v1/echoes/find-or-create | Dedup: tìm trùng → trả cũ, tạo mới nếu chưa có |
| DELETE | /api/v1/echoes/{id} | Delete echo |
| POST | /api/v1/ocr/extract | Upload image → extract stats |
| POST | /api/v1/score/calculate | Single echo score (stateless) |
| POST | /api/v1/score/calculate-set | Full set score (stateful ER — **dùng cho Set page**) |
| GET | /api/v1/sets | List saved echo sets |
| POST | /api/v1/sets | Save echo set |
| DELETE | /api/v1/sets/{id} | Delete echo set |
| GET | /api/v1/evc-status | Fetch EVC changelog, compare với acknowledged |
| POST | /api/v1/evc-status/acknowledge | Mark version as seen |
| GET | /api/v1/character-profiles | All character build statuses + notes |
| PUT | /api/v1/character-profiles/{name} | Upsert single character profile |
| POST | /api/v1/character-profiles/bulk | Bulk upsert (localStorage migration) |

## Data Flow

```
Upload echo screenshot
    → POST /ocr/extract → OCR pipeline → echo_name, echo_set, main_stat, sub_stats[]
Pick character + nhập total ER
    → POST /score/calculate → score_percent, tier_label, breakdown
Save echo (Home)
    → POST /echoes/find-or-create → dedup → existing or new echo_id
Save set (Set page)
    → find-or-create per slot → echo_id → POST /sets với slots {echo_id, snapshot}
View Saved
    → GET /echoes?character_id=...
App boot
    → GET /evc-status (staleTime: Infinity, 1×/session) → banner nếu chưa acknowledged
    → User dismiss → POST /evc-status/acknowledge → ghi evc_status.json + localStorage
Characters page
    → GET /character-profiles (source of truth)
    → Server trống + localStorage có data → POST /character-profiles/bulk (migration 1 lần)
    → Click icon/badge → PUT /character-profiles/{name}
```

## Scoring Algorithm (EVC formula)

Internal stat names dùng trong algorithm (vd `Crit Rate(%)`, `Atk(%)`, `ER(%)`) khác display name của FE/OCR (`Crit Rate`, `ATK%`, `ER%`). Mapping ở `scoring_service.py → STAT_NAME_MAP`.

### Single echo (stateless) — `POST /score/calculate`

```
AV = Σ (value / SUBSTAT_MEDIANS[stat]) × CHARACTER_DATA[char].weights[stat]
EP = Σ top-5 weights (+ er_ep_weight nếu ER cần)
ES = (AV / EP) × 100      ← uncapped, có thể > 100
```

### Full-set (stateful ER) — `POST /score/calculate-set`

**Bắt buộc dùng cho Set page.** Đừng gọi single-echo 5× — ER state share tuần tự, kết quả sẽ lệch khỏi EVC.

- Echoes có ER substat scored trước, phần còn lại sau.
- ER budget: `er_net = total_er − req_er` (negative = deficit), carry forward echo→echo qua `_score_one_stateful()`.
- `set_score = (ΣAV / ΣEP) × 100` — KHÔNG phải arithmetic mean của 5 score lẻ.

### Tier labels (EVC)

| score_percent | Label |
|---|---|
| ≥ 99 | Godly |
| ≥ 88 | Extreme |
| ≥ 77 | High Investment |
| ≥ 66 | Well Built |
| ≥ 55 | Decent |
| ≥ 44 | Base Level |
| < 44 | Unbuilt |

DB columns `echoes.tier` + `echo_sets.set_tier` là `VARCHAR(50)` lưu chính chuỗi label này. Source of truth: `data/game_data.py → TIER_THRESHOLDS` (đối ứng `frontend/src/utils/tier.ts`).

## Echo Deduplication

Fingerprint = `echo_name` + `echo_cost` + substats sorted by `type` (values rounded 3dp).

```python
# routers/echoes.py → find_or_create_echo() + helper _canonical_substats()
# Fetch candidates by (echo_name, echo_cost), Python-side compare substats
# Match → return existing; no match → create new
```

`POST /echoes/find-or-create` là path lưu duy nhất; **không có** `POST /echoes` thuần. Unmapping echo khỏi set không xóa khỏi DB; remap (paste lại) → find-or-create tự link đúng record.

## EVC Status

File: `routers/evc_status.py`
- Fetch HTML từ https://www.echovaluecalc.com/logs
- Parse regex: `<h3>DD.MM.YYYY</h3>\s*<ul>...</ul>`
- Compare với `acknowledged_date` trong `evc_status.json`
- `DATA_DIR` env var: thư mục chứa `evc_status.json` (default: backend root, Docker: `/app/data`)

### Syncing upstream EVC updates

Khi banner báo có update mới, lấy data từ upstream repo (`AstyuteChick/Echo-Value-Calculator`):

```bash
gh api repos/AstyuteChick/Echo-Value-Calculator/commits | jq '.[] | "\(.commit.author.date[:10]) \(.commit.message|split("\n")[0])"'
gh api repos/AstyuteChick/Echo-Value-Calculator/commits/<sha> -H "Accept: application/vnd.github.v3.diff"
```

Đọc diff `evc_engine.py`, copy `[rv_array, [er_target, er_imp, er_imp_label], anal]` vào `data/game_data.py → CHARACTER_DATA`. Element/weapon/role không có trong upstream — **hỏi user** thay vì web research (xem feedback memory).

## Character Seeding

`main.py → seed_characters()` chạy trên mỗi lifespan startup. Idempotent: query `select(Character.name)` → diff với `CHARACTER_LIST` từ game_data → insert những entry mới. Add character vào `CHARACTER_DATA` rồi restart backend là đủ — không cần manual SQL.

## Schemas (schemas/echo.py)

Active: `SubStat`, `EchoCreate`, `EchoResponse`, `EchoListResponse`, `CharacterResponse`, `OcrResult`, `ScoreRequest`, `ScoreResponse`, `EchoSetItem`, `SetScoreRequest`, `EchoSetResult`, `SetScoreResponse`, `EchoSetSlot`, `EchoSetSaveRequest`, `EchoSetResponse`, `CharacterProfileUpsert`, `CharacterProfileResponse`, `BulkProfileUpsert`.

**Removed:** `EchoUpdate` (endpoint xóa — không có update workflow).

`EchoCreate` fields: `character_id?`, `echo_name`, `echo_element?`, `echo_cost`, `main_stat_type?`, `main_stat_value?`, `sub_stats`, `total_er?`, `score?`, `score_percent?`, `tier?` (không có `notes`, `echo_set`).

## Services

### ocr_service.py
Provider priority (local-first):
1. **EasyOCR** (local, no API key) — primary, always tried first; ~140 MB models pre-downloaded trong Docker image
2. **Gemini** gemini-2.5-flash → gemini-1.5-flash → gemini-1.5-pro (`GOOGLE_API_KEY`)
3. **OpenAI** gpt-4o-mini → gpt-4o (`OPENAI_API_KEY`)
4. **Anthropic** claude-haiku-4-5 → claude-sonnet-4-6 (`ANTHROPIC_API_KEY`)

- 429/quota errors skip ngay sang model kế; 5xx retry tối đa 3×
- KHÔNG dùng `gemini-2.0-flash` — rate limit = 0 trên project mới
- Returns: `echo_name`, `echo_set`, `echo_element`, `echo_cost`, **`main_stat_type`**, **`main_stat_value`**, `sub_stats` (≤5)
- EasyOCR: detect main stat qua `_SUBSTAT_MAX_VAL` ceiling; map raw text → standard stat names
- Cloud providers: structured JSON extraction qua `EXTRACTION_PROMPT`

### scoring_service.py
- `calculate_score(sub_stats, character_name, echo_cost, total_er)` → dict (single echo, stateless)
- `calculate_set_score(echoes, character_name, total_er)` → dict (full set, stateful ER)
- Uses `CHARACTER_DATA` từ `game_data.py`; fallback to default weights nếu không có character

## Game Data (game_data.py)

### SUBSTAT_MEDIANS
`{stat_internal_name: float}` — median roll value cho mỗi substat. Dùng chuẩn hóa AV (Actual Value).

### CHARACTER_DATA
`{character_name: {weights: {stat: weight}, er_target: float, er_imp: float, er_imp_label: Min|Norm|Vital|Max}}`
- Weight 1.0 = stat tối ưu nhất, 0.0 = irrelevant
- `er_imp_label` thresholds: Min `< 0.3` | Norm `0.3–0.65` | Vital `0.65–0.9` | Max `≥ 0.9`
- Endpoint `GET /characters/game-data` flatten ra `character_weights` + `character_er` cho frontend

### TIER_THRESHOLDS
List `[(min_score_percent, label)]` — backend tier source. Đối ứng `frontend/src/utils/tier.ts`.
