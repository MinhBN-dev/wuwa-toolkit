# Echoes Optimizer

A web application for scoring, managing, and analyzing Echoes in **Wuthering Waves** — powered by the [Echo Value Calculator (EVC)](https://www.echovaluecalc.com/) scoring formula.

## Features

- **Screenshot OCR** — upload or paste an Echo screenshot; Google Gemini Vision automatically extracts name, main stat, and sub-stats
- **Echo scoring** — weighted score per character using the EVC 3.2 formula, with tier labels (Godly → Unbuilt)
- **Full-set scoring** — score all 5 Echo slots together in a single EVC full-mode call (shared Energy Regen budget across the set)
- **Echo library** — save, filter by tier/character/name, and delete Echoes
- **Set management** — save named sets per resonator, load them back, view aggregate set score
- **EVC changelog banner** — detects new EVC updates and notifies you in-app

---

## Screenshots

> _Set page — score 5 echo slots and save as a named set_

> _Saved Echoes — filter by EVC tier label, character, or echo name_

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12 · FastAPI · SQLAlchemy (async) · asyncpg |
| Frontend | React 18 · TypeScript · Vite · TailwindCSS v3 |
| Database | PostgreSQL 16 |
| OCR | Google Gemini Vision API (`gemini-2.5-flash`) |
| Scoring | EVC 3.2 formula (see [References](#references)) |
| State | TanStack Query v5 · React useState |
| Notifications | Sonner |
| Routing | React Router v6 |
| Deployment | Docker Compose — nginx (frontend) + uvicorn (backend) |

---

## Getting Started

### Prerequisites

- Docker & Docker Compose
- A **Google AI API key** ([Get one free](https://aistudio.google.com/app/apikey)) for OCR

### 1. Clone the repository

```bash
git clone https://github.com/MinhBN-dev/echoes-optimizer.git
cd echoes-optimizer
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@shared-postgres:5432/echoes_optimizer
GOOGLE_API_KEY=your_google_api_key_here
```

### 3. Start with Docker Compose

```bash
docker compose up -d
```

The app will be available at **http://localhost** (port 80).

> On a local network, the hostname `echoes.local` is broadcast via mDNS (Avahi) — any device on the LAN can reach it automatically.

### 4. (Optional) Local development

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev   # http://localhost:5174
```

---

## Project Structure

```
echoes-optimizer/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, lifespan, seeding
│   │   ├── models/echo.py       # SQLAlchemy ORM models
│   │   ├── schemas/echo.py      # Pydantic request/response schemas
│   │   ├── routers/
│   │   │   ├── echoes.py        # GET /echoes, POST /find-or-create, DELETE
│   │   │   ├── characters.py    # GET /characters, GET /game-data
│   │   │   ├── scoring.py       # POST /score/calculate, /calculate-set
│   │   │   ├── ocr.py           # POST /ocr/extract
│   │   │   ├── sets.py          # CRUD /sets
│   │   │   └── evc_status.py    # GET /evc-status, POST /acknowledge
│   │   ├── services/
│   │   │   ├── scoring_service.py  # EVC scoring algorithm
│   │   │   └── ocr_service.py      # Gemini Vision integration
│   │   └── data/game_data.py    # Character weights, ER targets, stat maxima
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx         # Single echo: upload → score → save
│   │   │   ├── Set.tsx          # 5-slot set: OCR, score all, save/load
│   │   │   ├── Saved.tsx        # Echo library with filters
│   │   │   └── Characters.tsx   # Resonator roster + build status
│   │   ├── components/
│   │   │   ├── EchoCard.tsx     # Echo grid card with tier indicator
│   │   │   ├── EchoUploader.tsx # Drag-and-drop / paste image uploader
│   │   │   ├── StatsEditor.tsx  # Sub-stat editor with roll quality bars
│   │   │   ├── ScoreDisplay.tsx # Score result with tier badge + breakdown
│   │   │   ├── ErInfo.tsx       # ER target + importance badge
│   │   │   ├── SaveEchoDialog.tsx # Confirm dialog before saving
│   │   │   └── EvcBanner.tsx    # EVC changelog update banner
│   │   ├── services/api.ts      # Axios API client
│   │   ├── utils/
│   │   │   ├── tier.ts          # Tier labels, colors, thresholds
│   │   │   └── echoHelpers.ts   # snapToRoll, defaultSubStatsForChar
│   │   └── types/echo.ts        # TypeScript interfaces
│   ├── nginx.conf
│   └── Dockerfile
├── docs/
│   └── db_schema.md             # Full ERD + table documentation
├── docker-compose.yml
└── README.md
```

---

## Scoring Algorithm

The scoring algorithm is a direct implementation of the **EVC 3.2** formula:

```
For each sub-stat:
    roll_quality  = actual_value / max_5roll_value      (0 – 1)
    contribution  = roll_quality × character_weight × 100

raw_score     = Σ contributions  (all sub-stats across the echo)
max_possible  = Σ top-5 character weights × 100
score_percent = (raw_score / max_possible) × 100
```

**Full-set mode** (5 echoes together):  
Echoes with an Energy Regen sub-stat are processed first. The remaining ER budget is carried forward sequentially — this matches EVC's stateful ER accounting and is why all 5 echoes must be scored in a single API call.

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

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/characters` | All resonators |
| GET | `/api/v1/characters/game-data` | Weights, ER targets, stat rolls |
| GET | `/api/v1/echoes` | List saved echoes (filter by character) |
| POST | `/api/v1/echoes/find-or-create` | Save echo with deduplication |
| DELETE | `/api/v1/echoes/{id}` | Delete echo |
| POST | `/api/v1/ocr/extract` | Upload image → extract stats |
| POST | `/api/v1/score/calculate` | Score a single echo |
| POST | `/api/v1/score/calculate-set` | Score a full 5-echo set (EVC full mode) |
| GET | `/api/v1/sets` | List saved sets |
| POST | `/api/v1/sets` | Save an echo set |
| DELETE | `/api/v1/sets/{id}` | Delete a set |
| GET | `/api/v1/evc-status` | Check for EVC changelog updates |
| POST | `/api/v1/evc-status/acknowledge` | Mark update as seen |

Full schema documentation: [`docs/db_schema.md`](docs/db_schema.md)

---

## References

| Source | Usage |
|--------|-------|
| [Echo Value Calculator (EVC)](https://www.echovaluecalc.com/) by **Rei** | Scoring formula, character weights, tier thresholds, ER importance values — all derived from EVC 3.2 |
| [EVC Changelog](https://www.echovaluecalc.com/logs) | In-app update banner checks this page for new versions |
| [Wuthering Waves](https://wutheringwaves.kurogames.com/) by **Kuro Games** | Game, Echo system, character data |
| [Google Gemini Vision API](https://ai.google.dev/) | OCR provider for screenshot-to-stats extraction |
| [TanStack Query](https://tanstack.com/query) | Server state management in React |
| [Sonner](https://sonner.emilkowal.ski/) | Toast notification library |

> **Credit:** The scoring algorithm and character weight data are the intellectual work of the EVC team. This project does not claim ownership of those values — it reimplements the formula locally for personal use.

---

## License

This project is for personal and educational use. The EVC formula and Wuthering Waves game data belong to their respective owners.
