# Echoes Optimizer — Backend

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
    │   └── echo.py      Echo, Character, EchoSet ORM models
    ├── schemas/
    │   └── echo.py      Pydantic schemas (request/response)
    ├── routers/
    │   ├── echoes.py    CRUD + find-or-create: /api/v1/echoes
    │   ├── characters.py GET /characters, GET /characters/game-data (incl. ER data)
    │   ├── ocr.py       POST /ocr/extract (image → Gemini Vision)
    │   ├── scoring.py   POST /score/calculate, POST /score/calculate-set
    │   ├── sets.py      CRUD: /sets (saved echo sets)
    │   └── evc_status.py GET /evc-status, POST /evc-status/acknowledge
    ├── services/
    │   ├── ocr_service.py     Gemini Vision integration
    │   └── scoring_service.py Weighted scoring algorithm
    └── data/
        └── game_data.py  CHARACTER_WEIGHTS, SUB_STAT_MAX, CHARACTER_LIST, ER data
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
- score, score_percent (float 0-100), tier (EVC label string e.g. "High Investment")
- image_path (nullable, reserved), notes (nullable, reserved), created_at

### EchoSet
- id (UUID PK), name
- character_id (FK nullable), character_name
- total_er, set_score, set_tier
- slots (JSON list of EchoSetSlot — xem schema)
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
| POST | /api/v1/ocr/extract | Upload image → extract stats via Gemini |
| POST | /api/v1/score/calculate | Calculate single echo score |
| POST | /api/v1/score/calculate-set | Calculate full set score (mean của 5 echo) |
| GET | /api/v1/sets | List saved echo sets |
| POST | /api/v1/sets | Save echo set |
| DELETE | /api/v1/sets/{id} | Delete echo set |
| GET | /api/v1/evc-status | Fetch EVC changelog, compare với acknowledged |
| POST | /api/v1/evc-status/acknowledge | Mark version as seen |

## Echo Deduplication (find-or-create)

```python
# Fingerprint: echo_name + echo_cost + sorted substats (by type, rounded 3dp)
# Fetch candidates by (echo_name, echo_cost), so Python-side compare substats
# Returns existing echo nếu match, else creates new
```
File: `routers/echoes.py` → `find_or_create_echo()` + helper `_canonical_substats()`

## EVC Status

File: `routers/evc_status.py`
- Fetch HTML từ https://www.echovaluecalc.com/logs
- Parse regex: `<h3>DD.MM.YYYY</h3>\s*<ul>...</ul>`
- Compare với `acknowledged_date` trong `evc_status.json`
- `DATA_DIR` env var: thư mục chứa `evc_status.json` (default: backend root, Docker: /app/data)

## Schemas (schemas/echo.py)

Active schemas: `SubStat`, `EchoCreate`, `EchoResponse`, `EchoListResponse`, `CharacterResponse`, `OcrResult`, `ScoreRequest`, `ScoreResponse`, `EchoSetItem`, `SetScoreRequest`, `EchoSetResult`, `SetScoreResponse`, `EchoSetSlot`, `EchoSetSaveRequest`, `EchoSetResponse`

**Removed:** `EchoUpdate` (endpoint bị xóa — không có update echo workflow)

`EchoCreate` fields: `character_id?`, `echo_name`, `echo_element?`, `echo_cost`, `main_stat_type?`, `main_stat_value?`, `sub_stats`, `total_er?`, `score?`, `score_percent?`, `tier?`
(không có `notes`, `echo_set` — không dùng trong FE)

## Services

### ocr_service.py
Provider priority (local-first):
1. **EasyOCR** (local, no API key) — primary, always tried first; ~140 MB models pre-downloaded in Docker image
2. **Gemini** gemini-2.5-flash → gemini-1.5-flash → gemini-1.5-pro (GOOGLE_API_KEY)
3. **OpenAI** gpt-4o-mini → gpt-4o (OPENAI_API_KEY)
4. **Anthropic** claude-haiku-4-5 → claude-sonnet-4-6 (ANTHROPIC_API_KEY)

- 429/quota errors skip to next model immediately; 5xx retries up to 3×
- Returns: echo_name, echo_set, echo_element, echo_cost, **main_stat_type**, **main_stat_value**, sub_stats (≤5)
- EasyOCR: detects main stat via `_SUBSTAT_MAX_VAL` ceiling; maps raw text to standard stat names
- API providers: structured JSON extraction via `EXTRACTION_PROMPT`

### scoring_service.py
- `calculate_score(sub_stats, character_name, echo_cost, total_er)` → dict
- Uses CHARACTER_WEIGHTS từ game_data.py
- Fallback to default_weights nếu không có character
- Normalizes to 0-100 scale (top 5 weighted stats = max_possible)

## Game Data (game_data.py)

### SUB_STAT_MAX (5 max rolls)
- Crit Rate: 10.5%, Crit DMG: 21%, ATK%: 11.6%, Flat ATK: 60
- HP%: 11.6%, Flat HP: 580, DEF%: 14.7%, Flat DEF: 70
- Basic/Heavy/Skill/Liberation ATK DMG%: 11.6%, ER%: 12.4%

### CHARACTER_WEIGHTS
`{character_name: {stat_type: weight}}` — Weight 1.0 = best, 0.0 = irrelevant

### CHARACTER_ER (trong characters router game-data response)
`{character_name: {er_target: float, er_imp: float, er_imp_label: Min|Norm|Vital|Max}}`
- Min: er_imp < 0.3 | Norm: 0.3–0.65 | Vital: 0.65–0.9 | Max: ≥ 0.9
