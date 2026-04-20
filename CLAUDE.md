# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Before You Start

**Read memory first** — check `/home/ubuntu-dev/.claude/projects/-home-ubuntu-dev-Projects-Echoes-Optimizer/memory/MEMORY.md` before starting any task. It contains user preferences, feedback on past approaches, and project context that must inform your work.

**Read `.agent/INDEX.md` first** — it maps every file and quick-lookup pattern, saving you from reading source files unnecessarily. Full docs in `.agent/BACKEND.md`, `.agent/FRONTEND.md`, `.agent/DEVOPS.md`, `.agent/ARCHITECTURE.md`.

**Update `CLAUDE.md` after completing a task** — if you discover something that future Claude instances would benefit from knowing (a new convention, a gotcha, a workflow detail), add it here before finishing.

**Update `.agent/` docs alongside every code change** — same task, not a separate step. Stale docs waste context in future sessions. Rules:
- New endpoint → `.agent/BACKEND.md` (routes table)
- New component/page → `.agent/FRONTEND.md`
- Deployment/env change → `.agent/DEVOPS.md`
- Architecture/algorithm change → `.agent/ARCHITECTURE.md`

---

## Development Commands

### Local dev (no Docker)

```bash
# Backend — port 8001, hot-reload
cd backend
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# Frontend — port 5174
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd frontend && npm run dev
```

Local URLs: frontend `http://localhost:5174`, backend API `http://localhost:8001/api/v1`, Swagger `http://localhost:8001/docs`

### Docker (production)

```bash
# Rebuild and redeploy a single service after code changes
docker compose build frontend && docker compose up -d frontend
docker compose build backend  && docker compose up -d backend

# View logs
docker compose logs -f backend
docker compose logs -f frontend
```

Production URL: `http://echoes.local` (port 80) — Avahi mDNS broadcast, resolves on all LAN machines. Also `http://localhost` or `http://your-server-ip`.

### Database

```bash
# psql
PGPASSWORD="your_password" psql -h localhost -U echoes_user -d echoes_optimizer

# Reset all tables (backend re-creates + re-seeds characters on next startup)
PGPASSWORD="your_password" psql -h localhost -U echoes_user -d echoes_optimizer \
  -c "DROP TABLE IF EXISTS character_profiles, echo_sets, echoes, characters CASCADE;"
```

### Frontend type-check

```bash
cd frontend && npx tsc --noEmit
```

---

## Architecture

FastAPI + React app for scoring Wuthering Waves Echoes using the EVC 3.2 formula.

### Request flow

```
Browser → nginx (echoes-frontend :80)
    /api/*     → echoes-backend :8001 (FastAPI)
    /uploads/* → echoes-backend :8001
    /*         → static React build
```

Local dev: Vite proxies `/api` → `localhost:8001` directly (no nginx).

### Backend (`backend/app/`)

| Path | Purpose |
|------|---------|
| `main.py` | FastAPI app, CORS, lifespan (creates tables, seeds characters if empty) |
| `models/echo.py` | SQLAlchemy ORM: `Character`, `Echo`, `EchoSet`, `CharacterProfile` |
| `schemas/echo.py` | Pydantic schemas — `EchoCreate`, `EchoResponse`, `ScoreRequest`, `SetScoreRequest`, `EchoSetSaveRequest`, `CharacterProfileUpsert`, `BulkProfileUpsert`, etc. |
| `routers/` | One file per domain: `echoes`, `characters`, `scoring`, `ocr`, `sets`, `evc_status`, `character_profiles` |
| `services/scoring_service.py` | EVC algorithm — AV/EP/ES, stateful ER across sets, **no score cap** |
| `services/ocr_service.py` | EasyOCR (local, primary) → Gemini → OpenAI → Anthropic fallback chain |
| `data/game_data.py` | `CHARACTER_DATA` (weights + ER targets), `SUBSTAT_MEDIANS`, `TIER_THRESHOLDS` |

### Frontend (`frontend/src/`)

| Path | Purpose |
|------|---------|
| `pages/Home.tsx` | Single echo: upload → score → save |
| `pages/Set.tsx` | 5-slot set: OCR per slot, paste target, score all (EVC full mode), save/load |
| `pages/Saved.tsx` | Echo library: filter by tier/character/name, delete |
| `pages/Characters.tsx` | Resonator roster + build status (server-synced via `/character-profiles`) |
| `services/api.ts` | All API calls (axios) — single source of truth |
| `utils/tier.ts` | `TIER_THRESHOLDS`, `getTierLabel`, `getTierClass`, `getBarColor` — frontend tier source of truth |
| `utils/echoHelpers.ts` | `snapToRoll`, `defaultSubStatsForChar` — shared between Home and Set |
| `utils/character.ts` | `getBaseName`, `getCharacterIcon`, build status helpers, localStorage read functions |
| `types/echo.ts` | All TypeScript interfaces |

### Docker containers

| Container | Port | Role |
|-----------|------|------|
| `echoes-frontend` | 0.0.0.0:80 | nginx — serves static build + proxies `/api` |
| `echoes-backend` | internal:8001 | FastAPI + uvicorn |
| `shared-postgres` | 5432 | PostgreSQL 16 (external, shared with other projects) |

Networks: `echoes_optimizer_internal` (frontend ↔ backend), `easm_toolkit_default` (backend ↔ postgres).
Volumes: `echoes_optimizer_uploads` (images), `echoes_optimizer_evc_state` (`evc_status.json`).

---

## Scoring Algorithm

### Single echo (`POST /score/calculate`) — stateless

```
AV = Σ (value / substat_median) × character_weight   for each substat
EP = sum of top-5 character weights (+ er_ep weight if ER needed)
ES = (AV / EP) × 100    ← NOT capped, can exceed 100
```

### Full-set (`POST /score/calculate-set`) — stateful ER

**Always use this for the Set page.** Never call single-echo scoring 5× — ER state is shared sequentially and results will differ from EVC.

Processing order: echoes **with ER substat first**, then the rest. ER budget initialized as `er_net = total_er - req_er` (negative = deficit). Carried forward echo-to-echo via `_score_one_stateful()`.

### Tier labels

| score_percent | Label |
|---------------|-------|
| ≥ 99 | Godly |
| ≥ 88 | Extreme |
| ≥ 77 | High Investment |
| ≥ 66 | Well Built |
| ≥ 55 | Decent |
| ≥ 44 | Base Level |
| < 44 | Unbuilt |

---

## Key Conventions

**Tier labels** are EVC strings everywhere (DB, API, frontend). Old letter grades S/A/B/C/D are fully removed. DB columns `echoes.tier` and `echo_sets.set_tier` are `VARCHAR(50)`.

**score_percent is uncapped** — values > 100 are valid. Frontend progress bars use `Math.min(score, 100)` for visual width only; displayed numbers show the real value.

**Stat name duality** — frontend/OCR uses display names (`"Crit Rate"`, `"ATK%"`, `"ER%"`); EVC algorithm uses internal names (`"Crit Rate(%)"`, `"Atk(%)"`, `"ER(%)"`). Mapping: `scoring_service.py → STAT_NAME_MAP`.

**Echo deduplication** — fingerprint is `(echo_name, echo_cost, substats sorted by type, values rounded 3dp)`. `POST /echoes/find-or-create` is the only save path; there is no plain `POST /echoes`.

**Schema migrations** — no migrations framework. Run `ALTER TABLE` manually in psql, update the SQLAlchemy model, then rebuild the backend container.

**Adding a new character** — edit `backend/app/data/game_data.py`: add to `CHARACTER_WEIGHTS`, `CHARACTER_LIST`, and `CHARACTER_ER`. DB re-seeds automatically on next backend restart (if characters table is empty, otherwise run a manual insert or reset).

**OCR provider** — primary is EasyOCR (local, no API key, ~140 MB models pre-downloaded in Docker image). Falls back in order: Gemini `gemini-2.5-flash` → OpenAI → Anthropic. Do NOT use `gemini-2.0-flash` — rate limit = 0 on new projects. Key in `backend/.env`: `GOOGLE_API_KEY`.

**Character build status** — stored server-side in `character_profiles` table (not localStorage). `Characters.tsx` auto-migrates from localStorage on first load when server has no data. All subsequent reads/writes go to `GET/PUT /api/v1/character-profiles`.

**EVC banner** — `GET /evc-status` is fetched once per session (`staleTime: Infinity`). Acknowledge writes to both `evc_status.json` (server volume) and `localStorage` (client).
