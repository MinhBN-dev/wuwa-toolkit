# Wuwa Toolkit — Backend

> Source of truth cho scoring algorithm, dedup, data flow, API surface.

## Tech Stack
FastAPI (Python 3.12) · SQLAlchemy async + asyncpg · PostgreSQL 16 · OCR: RapidOCR → EasyOCR (local) → Gemini → OpenAI → Anthropic fallback chain · TanStack Query consumed bởi frontend.

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
    │   ├── character_profiles.py GET/PUT/POST /character-profiles (build status + notes)
    │   └── convene.py    Convene tracker: /convene/import|players|stats|history
    ├── services/
    │   ├── ocr_service.py     OCR pipeline (RapidOCR + EasyOCR local + cloud fallbacks)
    │   ├── scoring_service.py EVC weighted scoring algorithm
    │   └── convene_service.py WuWa gacha API client (URL parse + fetch_all_pools)
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

### ConvenePull
- id (UUID PK), player_id (str), card_pool_type (1..7), pull_id (snowflake str)
- name, item_type ("Resonator" / "Weapon"), quality_level (3/4/5), resource_id, count
- time (DateTime, in-game pull time), created_at
- UNIQUE `(player_id, card_pool_type, pull_id)` → append-only dedup on re-import

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
| POST | /api/v1/convene/import | Paste in-game export URL → fetch all pools → ON CONFLICT DO NOTHING insert. `cardPoolId` (gacha_id) from URL is reused for every cardPoolType (required — empty returns near-zero data) |
| GET | /api/v1/convene/players | List synced UIDs (UID + total + last_pull_time) |
| GET | /api/v1/convene/history | Paginated pulls (default 4★+5★ via `min_rarity`). Filters: `pool_type`, `rarity`, `min_rarity`, `skip`, `limit`. Returns `{items, total, skip, limit}`. **Per-row pity** computed by walking the entire pool oldest-first |
| GET | /api/v1/convene/stats | Always emits an entry for `VISIBLE_POOLS = (1,2,3,4)` even when 0 pulls. Per-pool: total, total_astrites (×160), 5★/4★ counts, current pity_5/pity_4, avg_pity_5, **pull_ratio** (5★/total), **wins_50_50 / losses_50_50 / win_rate_50_50** (only for pool 1), and 5★ list newest-first with pity-at-pull |
| DELETE | /api/v1/convene/players/{uid} | Wipe UID's history |

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
1. **RapidOCR** (local ONNX, no API key) — primary; ONNX models ship inside the `rapidocr-onnxruntime` wheel (no download), warmed up at Docker build
2. **EasyOCR** (local, no API key) — secondary; ~140 MB models pre-downloaded trong Docker image
3. **Gemini** gemini-2.5-flash → gemini-1.5-flash → gemini-1.5-pro (`GOOGLE_API_KEY`)
4. **OpenAI** gpt-4o-mini → gpt-4o (`OPENAI_API_KEY`)
5. **Anthropic** claude-haiku-4-5 → claude-sonnet-4-6 (`ANTHROPIC_API_KEY`)

- **Image preprocessing** (`_prep_local_image`): robust decode via `cv2.IMREAD_UNCHANGED` → normalize 16-bit/float → 8-bit, composite alpha over white, expand grayscale → upscale-if-small (shorter side ≥ 720px) → grayscale + CLAHE. Fixes the "screenshot-from-game reads wrong but re-cropped-from-website reads fine" bug (raw game screenshots can have odd colorspace / bit-depth / alpha). API providers get a normalized PNG (`_normalized_png_bytes`) instead of the raw bytes.
- Local engines (RapidOCR, EasyOCR) share `_parse_ocr_rows(results, provider=, confidence=)` — same `(bbox, text, conf)` block shape; row-grouping by Y-proximity, then `_map_stat_name` + `_SUBSTAT_MAX_VAL` ceiling to split main stat from sub-stats
- 429/quota errors skip ngay sang model kế; 5xx retry tối đa 3×
- KHÔNG dùng `gemini-2.0-flash` — rate limit = 0 trên project mới
- Returns: `echo_name`, `echo_set`, `echo_element`, `echo_cost`, **`main_stat_type`**, **`main_stat_value`**, `sub_stats` (≤5), `provider`, `confidence`
- Cloud providers: structured JSON extraction qua `EXTRACTION_PROMPT`

### convene_service.py

WuWa Convene history client (Oversea region only).

- `parse_export_url(url)` — extracts `svr_id`, `player_id`, `record_id`, `lang` from the URL fragment (params live after `#/record?`, not in the query string). Raises `ConveneUrlError` on missing fields.
- `fetch_pool(...)` — POST to `https://gmserver-api.aki-game2.net/gacha/record/query` with `Origin`/`Referer` matching the in-game webview. Returns the raw `data` array.
- `fetch_all_pools(parsed)` — sequentially queries all 7 `cardPoolType` values; pools that fail (legitimately empty / locked) return `[]` instead of raising.
- `normalize_pull(raw, ...)` — converts API record to DB-ready dict; uses the `id` snowflake as the dedup key.

`POOL_TYPES`: `[(1, "Featured Resonator Convene"), (2, "Featured Weapon Convene"), (3, "Standard Resonator Convene"), (4, "Standard Weapon Convene"), (5, "Beginner Convene"), (6, "Beginner's Choice Convene"), (7, "Beginner's Choice Convene (Selector)")]`.

The export URL `record_id` token expires after a short time — re-export from in-game when sync errors with API code != 0.

**URL acquisition flow** (in addition to in-game Export Records button):
- `frontend/public/get-convene-url.ps1` is served at site root. Users on Windows run `iex (irm 'http://<host>/get-convene-url.ps1')` in PowerShell.
- Script auto-discovers WuWa install path (registry → firewall rules → common drive paths), greps `Client.log` for the gacha URL, copies to clipboard.
- Game must be running with Convene → History opened at least once (URL only appears in log after that webview loads).

**Synthetic `pull_id`** — the WuWa gacha API doesn't include a unique id per record, so we generate `pull_id = f"{sequence:06d}"` where sequence is the index in the API response **reversed** (oldest = 0). Stable across re-syncs because the API response is deterministic and new pulls only append to the high end of the sequence. Combined with `(player_id, card_pool_type)` it forms the UNIQUE dedup key for `ON CONFLICT DO NOTHING`.

**50/50 win rate (Pool 1 only)** — WuWa rule: a standard-pool 5★ ("loss") guarantees the next 5★ is featured. That guaranteed pull is NOT a 50/50 attempt and must be excluded from win rate. Algorithm walks pool 1 pulls oldest-first with a `guaranteed_next` flag; only counts pulls where the flag was False. `STANDARD_5_RESONATORS = {Calcharo, Encore, Jianxin, Lingyang, Verina}`. `ASTRITES_PER_PULL = 160`.

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
