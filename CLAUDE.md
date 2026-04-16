# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Before You Start

**Always read `.agent/INDEX.md` first** — it maps every file and quick-lookup pattern. It will save you from reading source files you don't need. The full docs are in `.agent/BACKEND.md`, `.agent/FRONTEND.md`, `.agent/DEVOPS.md`, and `.agent/ARCHITECTURE.md`.

**Always update `.agent/` docs alongside code changes** — treat them as part of the same task. If you add an endpoint, update `.agent/BACKEND.md`. If you add a component, update `.agent/FRONTEND.md`. Stale docs waste context in future sessions.

---

## Development Commands

### Local dev (no Docker)

```bash
# Backend (port 8001, hot-reload)
cd backend
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# Frontend (port 5174)
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd frontend && npm run dev
```

### Docker (production)

```bash
# Rebuild and redeploy a single service after code changes:
docker compose build frontend && docker compose up -d frontend
docker compose build backend  && docker compose up -d backend

# Logs
docker compose logs -f backend
```

### Database

```bash
# psql direct access
PGPASSWORD="echoes_pass_2026" psql -h localhost -U echoes_user -d echoes_optimizer

# Reset all tables (backend re-creates + re-seeds characters on next start)
PGPASSWORD="echoes_pass_2026" psql -h localhost -U echoes_user -d echoes_optimizer \
  -c "DROP TABLE IF EXISTS echo_sets, echoes, characters CASCADE;"
```

### Frontend type-check

```bash
cd frontend && npx tsc --noEmit
```

---

## Architecture

This is a **FastAPI + React** app for scoring Wuthering Waves Echoes using the EVC 3.2 formula.

### Request flow

```
Browser → nginx (echoes-frontend :80)
    /api/*  → echoes-backend :8001 (FastAPI)
    /*      → static React build
```

Local dev skips nginx — Vite proxies `/api` to `localhost:8001` directly.

### Backend structure

```
backend/app/
├── main.py              FastAPI app + lifespan (creates tables, seeds characters)
├── models/echo.py       SQLAlchemy ORM: Character, Echo, EchoSet
├── schemas/echo.py      Pydantic schemas (EchoCreate, EchoResponse, SetScoreRequest, …)
├── routers/             One file per domain (echoes, characters, scoring, ocr, sets, evc_status)
├── services/
│   ├── scoring_service.py   EVC algorithm (AV/EP/ES, stateful ER, no score cap)
│   └── ocr_service.py       Gemini Vision fallback chain
└── data/game_data.py    CHARACTER_DATA (weights + ER targets), SUBSTAT_MEDIANS
```

The `Character` seed runs on startup via `lifespan` in `main.py` — only inserts if the table is empty.

### Frontend structure

```
frontend/src/
├── pages/          Home (single echo), Set (5-slot), Saved (library), Characters
├── components/     EchoCard, EchoUploader, StatsEditor, ScoreDisplay, ErInfo, …
├── services/api.ts Axios client — all API calls defined here
├── utils/
│   ├── tier.ts         Tier labels, colors, thresholds (source of truth for FE tier system)
│   └── echoHelpers.ts  snapToRoll, defaultSubStatsForChar (shared between Home + Set)
└── types/echo.ts   All TypeScript interfaces
```

### Scoring algorithm

**Single echo** (`POST /score/calculate`): stateless — `ES = (AV / EP) × 100`. Score can exceed 100.

**Full-set** (`POST /score/calculate-set`): **stateful ER** — echoes with ER substats are processed first; the remaining ER budget carries forward. Always call this for the Set page — never call single-echo scoring 5× separately or results will differ from EVC.

ER budget is initialized as `er_net = total_er - req_er` (negative = deficit). See `scoring_service.py → _score_one_stateful()`.

### Echo deduplication

`POST /echoes/find-or-create` fingerprints by `(echo_name, echo_cost, sorted substats rounded to 3dp)`. This is the **only** save path used by the frontend — there is no plain `POST /echoes` endpoint.

### EVC banner

`GET /evc-status` scrapes `echovaluecalc.com/logs`, compares against `evc_status.json` (persisted in Docker volume `/app/data`). Acknowledged state is stored both server-side (file) and client-side (localStorage).

---

## Key Conventions

- **Tier labels** are EVC strings (`"Godly"`, `"Extreme"`, `"High Investment"`, `"Well Built"`, `"Decent"`, `"Base Level"`, `"Unbuilt"`). The old letter grades S/A/B/C/D are gone everywhere — DB columns `echoes.tier` and `echo_sets.set_tier` are `VARCHAR(50)`.
- **`score_percent` is not capped at 100** in the backend. Frontend progress bars use `Math.min(score, 100)` for width only.
- **Stat names**: frontend/OCR uses display names (`"Crit Rate"`, `"ATK%"`, `"ER%"`); EVC algorithm uses internal names (`"Crit Rate(%)"`, `"Atk(%)"`, `"ER(%)"`). Mapping lives in `scoring_service.py → STAT_NAME_MAP`.
- **Schema changes** require `ALTER TABLE` manually (no migrations framework). After changing a column, run the ALTER in psql, then rebuild the backend container.
