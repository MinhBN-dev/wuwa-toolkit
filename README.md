# Echoes Optimizer

A web application for scoring, managing, and analyzing Echoes in **Wuthering Waves** — powered by the [Echo Value Calculator (EVC)](https://www.echovaluecalc.com/) scoring formula.

## Features

- **Screenshot OCR** — upload or paste an Echo screenshot; stats are extracted automatically (EasyOCR runs locally, no API key required)
- **Echo scoring** — weighted score per character using the EVC 3.2 formula, with tier labels (Godly → Unbuilt)
- **Full-set scoring** — score all 5 Echo slots together in a single EVC full-mode call (shared Energy Regen budget across the set)
- **Echo library** — save, filter by tier/character/name, and delete Echoes
- **Set management** — save named sets per resonator, load them back, view aggregate set score
- **Character tracker** — track build status (Built / Building / Not Built) and notes per resonator, synced across browsers

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12 · FastAPI · SQLAlchemy (async) · asyncpg |
| Frontend | React 18 · TypeScript · Vite · TailwindCSS v3 |
| Database | PostgreSQL 16 |
| OCR | EasyOCR (local, primary) · Google Gemini · OpenAI · Anthropic (fallbacks) |
| Scoring | EVC 3.2 formula |
| Deployment | Docker Compose · or run components directly on the host |

---

## Two Ways to Run

| Mode | Best for | Requires |
|---|---|---|
| **Docker** *(recommended)* | Production / self-hosting / quick try-out | Docker + Docker Compose only |
| **Local** | Active development with hot-reload | Python 3.12, Node 20+, your own PostgreSQL |

Pick one path below. They are independent — you don't need both.

---

## Path A — Docker (recommended)

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & Docker Compose

That's all. No Python, Node, or PostgreSQL install needed — the stack is self-contained.

### 1. Clone

```bash
git clone https://github.com/MinhBN-dev/echoes-optimizer.git
cd echoes-optimizer
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set **at minimum**:

```env
POSTGRES_PASSWORD=choose_a_password
```

Optional:
- `GOOGLE_API_KEY` — enables cloud OCR fallback (free tier at [aistudio.google.com](https://aistudio.google.com/app/apikey))
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` — additional fallbacks
- `PORT` — host port to expose the app on (default `80`)
- `ALLOWED_ORIGINS` — comma-separated CORS origins; add your LAN IP/hostname if accessing from other devices

### 3. Start

```bash
docker compose up -d
```

The app is at **http://localhost** (or `http://localhost:PORT` if you changed `PORT`).
First boot takes a few minutes to build images; subsequent starts are seconds.

### 4. Day-to-day commands

```bash
docker compose logs -f backend         # tail backend logs
docker compose logs -f frontend
docker compose build backend && docker compose up -d backend     # rebuild after code change
docker compose build frontend && docker compose up -d frontend
docker compose down                    # stop (data preserved in volumes)
docker compose down -v                 # stop and DROP all data
```

Containers in this setup:

| Container | Port | Role |
|---|---|---|
| `echoes-frontend` | `${PORT:-80}` → 80 | nginx — serves static React build, proxies `/api` to backend |
| `echoes-backend` | internal `:8001` | FastAPI + uvicorn |
| `echoes-postgres` | internal `:5432` | PostgreSQL 16 (data in `postgres_data` volume) |

> **Advanced:** If you already have a shared PostgreSQL on this machine, you can disable the bundled one with a `docker-compose.override.yml`. See [docs/](docs/) or check `.gitignore` for the override pattern.

---

## Path B — Local Development

Run each component on the host with hot-reload. Useful when you're modifying code frequently.

### Prerequisites
- Python 3.12+
- Node.js 20+
- A running PostgreSQL 16 (Docker container, system service, or remote — your choice)

### 1. Clone & create database

```bash
git clone https://github.com/MinhBN-dev/echoes-optimizer.git
cd echoes-optimizer
```

Create a database and user (example using a local Postgres instance):

```bash
psql -U postgres -c "CREATE USER echoes_user WITH PASSWORD 'choose_a_password';"
psql -U postgres -c "CREATE DATABASE echoes_optimizer OWNER echoes_user;"
```

### 2. Backend

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit backend/.env — at minimum set DATABASE_URL:
#   DATABASE_URL=postgresql+asyncpg://echoes_user:choose_a_password@localhost:5432/echoes_optimizer
# Optionally set GOOGLE_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY for OCR fallbacks
# ALLOWED_ORIGINS=http://localhost:5174   (so the frontend can call the API)

uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Backend is at `http://localhost:8001` · Swagger UI: `http://localhost:8001/docs`.

On first start the backend creates tables and seeds the character roster automatically.

### 3. Frontend (separate terminal)

```bash
cd frontend
npm install
npm run dev
```

Frontend is at `http://localhost:5174`. Vite proxies `/api` → `http://localhost:8001` automatically (no nginx in dev mode).

### 4. Type-check / build

```bash
cd frontend
npx tsc --noEmit       # type-check only
npm run build          # production build → frontend/dist/
```

---

## OCR Setup

Echo screenshots are processed by **EasyOCR** running locally — no API key required and no data leaves your machine.

Cloud providers are used as fallback if EasyOCR confidence is low or fails:

| Priority | Provider | Key var |
|---|---|---|
| 1 | EasyOCR (local) | — |
| 2 | Google Gemini (`gemini-2.5-flash`) | `GOOGLE_API_KEY` |
| 3 | OpenAI (`gpt-4o-mini` → `gpt-4o`) | `OPENAI_API_KEY` |
| 4 | Anthropic (`claude-haiku-4-5` → `claude-sonnet-4-6`) | `ANTHROPIC_API_KEY` |

Add any subset of keys to `.env` (Docker) or `backend/.env` (local) to enable fallbacks.

---

## Scoring Algorithm

Implements the **EVC 3.2** formula:

```
AV = Σ (value / substat_median) × character_weight   for each sub-stat
EP = sum of top-5 character weights (+ ER weight if Energy Regen is needed)
ES = (AV / EP) × 100    ← not capped, values > 100 are valid
```

**Full-set mode** scores 5 echoes together with a shared ER budget — results differ from scoring each echo independently. Always use `/score/calculate-set` for full-set scoring.

### Tier Labels

| score_percent | Label |
|---|---|
| ≥ 99 | Godly |
| ≥ 88 | Extreme |
| ≥ 77 | High Investment |
| ≥ 66 | Well Built |
| ≥ 55 | Decent |
| ≥ 44 | Base Level |
| < 44 | Unbuilt |

---

## Project Structure

```
echoes-optimizer/
├── .env.example             ← copy to .env (Docker)
├── docker-compose.yml
├── backend/
│   ├── .env.example         ← copy to backend/.env (local dev)
│   ├── app/
│   │   ├── main.py
│   │   ├── models/          SQLAlchemy ORM models
│   │   ├── routers/         API route handlers
│   │   ├── services/        scoring_service.py, ocr_service.py
│   │   └── data/game_data.py  character weights & ER targets
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/           Home, Set, Saved, Characters
│   │   ├── components/      EchoCard, StatsEditor, ScoreDisplay, …
│   │   ├── services/api.ts  all API calls
│   │   └── utils/           tier.ts, echoHelpers.ts, character.ts
│   ├── nginx.conf           production nginx config
│   └── Dockerfile
└── nginx/                   reverse-proxy config (optional, for advanced setups)
```

---

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/characters` | All resonators |
| GET | `/api/v1/characters/game-data` | Weights, ER targets, stat rolls |
| GET | `/api/v1/echoes` | List saved echoes (filter by `character_id`) |
| POST | `/api/v1/echoes/find-or-create` | Save echo (with deduplication) |
| DELETE | `/api/v1/echoes/{id}` | Delete echo |
| POST | `/api/v1/ocr/extract` | Upload image → extract stats |
| POST | `/api/v1/score/calculate` | Score a single echo |
| POST | `/api/v1/score/calculate-set` | Score a full 5-echo set (stateful ER) |
| GET | `/api/v1/sets` | List saved sets |
| POST | `/api/v1/sets` | Save an echo set |
| DELETE | `/api/v1/sets/{id}` | Delete a set |
| GET | `/api/v1/character-profiles` | Character build status + notes |
| PUT | `/api/v1/character-profiles/{name}` | Update build status/notes |
| GET | `/api/v1/evc-status` | Check for EVC formula updates |

Full Swagger docs at `/docs` when the backend is running.

---

## Troubleshooting

**Backend can't connect to the database**
- Docker: `docker compose ps` — make sure `echoes-postgres` is `healthy`.
- Local: confirm PostgreSQL is running and `DATABASE_URL` in `backend/.env` matches your DB credentials.

**OCR returns empty / wrong stats**
- The first OCR call inside Docker downloads ~140 MB of EasyOCR models — give it a minute.
- Try a higher-resolution screenshot (game UI scale 100% or higher).
- Add a cloud fallback key (Gemini is free and accurate).

**CORS errors from the frontend**
- Add the origin you're loading from to `ALLOWED_ORIGINS` in `.env` (Docker) or `backend/.env` (local).

**Port 80 already in use (Docker)**
- Set `PORT=8080` (or any free port) in `.env`, then `docker compose up -d`.

---

## References

| Source | Usage |
|---|---|
| [Echo Value Calculator (EVC)](https://www.echovaluecalc.com/) by **Rei** | Scoring formula, character weights, tier thresholds — all derived from EVC 3.2 |
| [Wuthering Waves](https://wutheringwaves.kurogames.com/) by **Kuro Games** | Game, Echo system, character data |

> **Credit:** The scoring algorithm and character weight data are the intellectual work of the EVC team. This project reimplements the formula locally for personal use and does not claim ownership of those values.

---

## License

This project is for personal and educational use. The EVC formula and Wuthering Waves game data belong to their respective owners.
