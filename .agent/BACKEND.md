# Echoes Optimizer — Backend

## File Map

```
backend/
├── .venv/               Python virtual environment
├── .env                 Local env vars (DB, API key, etc.)
├── requirements.txt
└── app/
    ├── main.py          FastAPI app, CORS, lifespan, seeding
    ├── config.py        Pydantic settings (reads .env)
    ├── database.py      SQLAlchemy async engine, Base, get_db, init_db
    ├── models/
    │   └── echo.py      Echo, Character ORM models
    ├── schemas/
    │   └── echo.py      Pydantic schemas (request/response)
    ├── routers/
    │   ├── echoes.py    CRUD: GET/POST/PUT/DELETE /api/v1/echoes
    │   ├── characters.py GET /api/v1/characters, GET /api/v1/characters/game-data
    │   ├── ocr.py       POST /api/v1/ocr/extract (image upload → Claude Vision)
    │   └── scoring.py   POST /api/v1/score/calculate
    ├── services/
    │   ├── ocr_service.py     Claude Vision integration, image encoding
    │   └── scoring_service.py Weighted scoring algorithm
    └── data/
        └── game_data.py  CHARACTER_WEIGHTS, SUB_STAT_MAX, CHARACTER_LIST, TIER_THRESHOLDS
```

## Models

### Character
- id (UUID PK)
- name (str, unique)
- element (Glacio/Fusion/Electro/Aero/Spectro/Havoc)
- weapon_type (str)
- role (DPS/SubDPS/Support/Healer)

### Echo
- id (UUID PK)
- character_id (FK → characters.id, nullable)
- echo_name, echo_set, echo_element, echo_cost (1/3/4)
- main_stat_type, main_stat_value (float)
- sub_stats (JSON: [{type, value}, ...] max 5)
- total_er (float, nullable) — total ER% của cả build
- score, score_percent (float 0-100), tier (S/A/B/C/D)
- image_path (str, nullable)
- notes (text, nullable)
- created_at (datetime)

## API Routes

| Method | Path | Description |
|---|---|---|
| GET | /api/v1/health | Health check |
| GET | /api/v1/characters | List all characters |
| GET | /api/v1/characters/game-data | Static game data (sets, elements, stat options) |
| GET | /api/v1/echoes | List echoes (filter: character_id) |
| GET | /api/v1/echoes/{id} | Get one echo |
| POST | /api/v1/echoes | Create/save echo |
| PUT | /api/v1/echoes/{id} | Update echo |
| DELETE | /api/v1/echoes/{id} | Delete echo |
| POST | /api/v1/ocr/extract | Upload image → extract stats |
| POST | /api/v1/score/calculate | Calculate score |

## Services

### ocr_service.py
- Model: gemini-2.5-flash (Google, free tier, không cần credit card)
- Note: gemini-2.0-flash và gemini-2.0-flash-lite bị limit=0 trên project mới → dùng gemini-2.5-flash
- SDK: google-genai (unified Google GenAI SDK)
- API key: GOOGLE_API_KEY trong backend/.env (lấy tại aistudio.google.com)
- Sends base64 image + structured prompt
- Returns: echo_name, echo_set, echo_element, echo_cost, main_stat, sub_stats (up to 5)
- Strips markdown fences from response before JSON parse

### scoring_service.py
- `calculate_score(sub_stats, character_name)` → dict
- Uses CHARACTER_WEIGHTS from game_data.py
- Falls back to `get_default_weights()` if no character
- Normalizes to 0-100 scale based on top 5 weighted stats

## Game Data (game_data.py)

### SUB_STAT_MAX
Max value for each sub-stat (5 max rolls):
- Crit Rate: 10.5%, Crit DMG: 21%, ATK%: 11.6%, Flat ATK: 60
- HP%: 11.6%, Flat HP: 580, DEF%: 14.7%, Flat DEF: 70
- Basic/Heavy/Skill/Liberation ATK DMG%: 11.6% each, ER%: 12.4%

### CHARACTER_WEIGHTS
Dict of {character_name: {stat_type: weight}}
Weight 1.0 = best, 0.0 = irrelevant
Currently: 28 characters defined

### CHARACTER_LIST
List of dicts for seeding the characters table on startup
