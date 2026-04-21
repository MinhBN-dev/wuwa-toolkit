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
| Deployment | Docker Compose |

---

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose

That's it. No Python, Node, or database installation needed.

### 1. Clone the repository

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

Everything else is optional:
- `GOOGLE_API_KEY` — enables cloud OCR fallback (get one free at [aistudio.google.com](https://aistudio.google.com/app/apikey))
- `PORT` — defaults to `80`
- `ALLOWED_ORIGINS` — add your LAN IP if you want to access from other devices (e.g. `http://localhost,http://192.168.1.100`)

### 3. Start

```bash
docker compose up -d
```

The app will be available at **http://localhost** (or `http://localhost:PORT` if you changed `PORT`).

First startup takes a few minutes to build images. Subsequent starts are instant.

### 4. Stop

```bash
docker compose down          # stop (data is preserved in Docker volumes)
docker compose down -v       # stop and delete all data
```

---

## OCR Setup

Echo screenshots are processed by **EasyOCR** running locally inside Docker — no API key required and no data leaves your machine.

Cloud providers are used as fallback if EasyOCR confidence is low:

| Priority | Provider | Key var |
|----------|----------|---------|
| 1 | EasyOCR (local) | — |
| 2 | Google Gemini | `GOOGLE_API_KEY` |
| 3 | OpenAI | `OPENAI_API_KEY` |
| 4 | Anthropic | `ANTHROPIC_API_KEY` |

Add your preferred API key(s) to `.env` to enable fallbacks.

---

## Local Development (without Docker)

<details>
<summary>Expand</summary>

You'll need Python 3.12 and Node.js 20+, plus a running PostgreSQL instance.

**Backend**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env   # edit DATABASE_URL and other vars
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

**Frontend**

```bash
cd frontend
npm install
npm run dev   # http://localhost:5174
```

Swagger UI: http://localhost:8001/docs

</details>

---

## Scoring Algorithm

The scoring algorithm implements the **EVC 3.2** formula:

```
AV = Σ (value / substat_median) × character_weight   for each sub-stat
EP = sum of top-5 character weights (+ ER weight if Energy Regen is needed)
ES = (AV / EP) × 100    ← not capped, values > 100 are valid
```

**Full-set mode** scores 5 echoes together with a shared ER budget — results differ from scoring each echo independently.

### Tier Labels

| score_percent | Label           |
|---------------|-----------------|
| ≥ 99          | Godly           |
| ≥ 88          | Extreme         |
| ≥ 77          | High Investment |
| ≥ 66          | Well Built      |
| ≥ 55          | Decent          |
| ≥ 44          | Base Level      |
| < 44          | Unbuilt         |

---

## Project Structure

```
echoes-optimizer/
├── .env.example             ← copy to .env and fill in
├── docker-compose.yml
├── backend/
│   ├── .env.example         ← copy to backend/.env for local dev
│   ├── app/
│   │   ├── main.py
│   │   ├── models/          SQLAlchemy ORM models
│   │   ├── routers/         API route handlers
│   │   ├── services/        scoring_service.py, ocr_service.py
│   │   └── data/game_data.py  character weights & ER targets
│   └── requirements.txt
└── frontend/
    └── src/
        ├── pages/           Home, Set, Saved, Characters
        ├── components/      EchoCard, StatsEditor, ScoreDisplay, …
        ├── services/api.ts  all API calls
        └── utils/           tier.ts, echoHelpers.ts, character.ts
```

---

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/characters` | All resonators |
| GET | `/api/v1/characters/game-data` | Weights, ER targets, stat rolls |
| GET | `/api/v1/echoes` | List saved echoes |
| POST | `/api/v1/echoes/find-or-create` | Save echo (with deduplication) |
| DELETE | `/api/v1/echoes/{id}` | Delete echo |
| POST | `/api/v1/ocr/extract` | Upload image → extract stats |
| POST | `/api/v1/score/calculate` | Score a single echo |
| POST | `/api/v1/score/calculate-set` | Score a full 5-echo set |
| GET | `/api/v1/sets` | List saved sets |
| POST | `/api/v1/sets` | Save an echo set |
| DELETE | `/api/v1/sets/{id}` | Delete a set |
| GET | `/api/v1/character-profiles` | Character build status + notes |
| PUT | `/api/v1/character-profiles/{name}` | Update build status/notes |

---

## References

| Source | Usage |
|--------|-------|
| [Echo Value Calculator (EVC)](https://www.echovaluecalc.com/) by **Rei** | Scoring formula, character weights, tier thresholds — all derived from EVC 3.2 |
| [Wuthering Waves](https://wutheringwaves.kurogames.com/) by **Kuro Games** | Game, Echo system, character data |

> **Credit:** The scoring algorithm and character weight data are the intellectual work of the EVC team. This project reimplements the formula locally for personal use and does not claim ownership of those values.

---

## License

This project is for personal and educational use. The EVC formula and Wuthering Waves game data belong to their respective owners.
