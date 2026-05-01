# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Before You Start

**Read memory** — `/home/ubuntu-dev/.claude/projects/-home-ubuntu-dev-Projects-Echoes-Optimizer/memory/MEMORY.md` (user preferences, past feedback, project context).

**Use `.agent/INDEX.md` as router** — for anything beyond what's in this file (full route table, scoring detail, file maps, troubleshooting), open the relevant `.agent/<area>.md`. Don't re-derive by reading source files.

**Update docs alongside code (same task, not later):**
- New endpoint / model / scoring change → `.agent/BACKEND.md`
- New page / component / type / API call → `.agent/FRONTEND.md`
- Env / Docker / deployment / DB change → `.agent/DEVOPS.md`
- New convention or non-obvious gotcha → this file (`CLAUDE.md`)

The detailed docs are intentionally **the** source of truth — don't duplicate them here. If you'd write more than 1 line about the topic, it belongs in `.agent/`.

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

URLs: frontend `http://localhost:5174`, backend `http://localhost:8001/api/v1`, Swagger `http://localhost:8001/docs`.

### Docker (production)

```bash
docker compose build <service> && docker compose up -d <service>   # rebuild 1 service
docker compose logs -f <service>
```

Production URL: `http://echoes.local` (Avahi mDNS, LAN-wide).

`docker-compose.override.yml` is gitignored — used on this machine to swap to `shared-postgres` and join the LAN nginx-proxy. Public users don't need it. Detail in `.agent/DEVOPS.md`.

### Database

DB name depends on setup:
- **Public default** (standalone `echoes-postgres`): `echoes_optimizer`
- **This machine** (override → `shared-postgres`, naming convention `{project}_db`): `echoes_db`

```bash
PGPASSWORD="$POSTGRES_PASSWORD" psql -h localhost -U echoes_user -d <db_name>
```

Reset tables → `.agent/DEVOPS.md`.

### Frontend type-check
```bash
cd frontend && npx tsc --noEmit
```

---

## Key Conventions

These are non-obvious rules; the WHY is in the linked `.agent/` docs.

- **EVC tier labels everywhere** — DB stores the strings (`"Godly"`, `"High Investment"`, ...) in `VARCHAR(50)`. Old letter grades S/A/B/C/D fully removed. Source of truth: `data/game_data.py → TIER_THRESHOLDS` (backend) and `frontend/src/utils/tier.ts` (frontend) — keep them in sync.

- **`score_percent` is uncapped** — values > 100 are valid. Frontend bars use `Math.min(score, 100)` for visual width only; displayed numbers show the real value.

- **Stat name duality** — frontend/OCR uses display names (`"Crit Rate"`, `"ATK%"`, `"ER%"`); EVC algorithm uses internal names (`"Crit Rate(%)"`, `"Atk(%)"`, `"ER(%)"`). Mapping: `scoring_service.py → STAT_NAME_MAP`.

- **Echo dedup is the only save path** — `POST /echoes/find-or-create` (fingerprint = name + cost + sorted substats rounded 3dp). There is **no** plain `POST /echoes`.

- **Set page must use `POST /score/calculate-set`** — never call single-echo scoring 5×. ER state is shared sequentially across echoes; arithmetic mean of single scores diverges from EVC.

- **OCR is local-first** — EasyOCR (no API key, ~140 MB models in image) → Gemini `gemini-2.5-flash` → OpenAI → Anthropic. **Never use `gemini-2.0-flash`** (rate limit = 0 on new projects).

- **Character build status is server-side** — `character_profiles` table, accessed via `GET/PUT /api/v1/character-profiles`. `Characters.tsx` auto-migrates from localStorage once on first load when server is empty.

- **EVC banner fetched once per session** — `staleTime: Infinity`. Acknowledge writes both `evc_status.json` (server volume) and `localStorage` (client).

- **Design system** — WuWa-inspired tech-arcane theme. Rajdhani for display/UI/numbers (`font-display`, `.readout`), Inter for body. Reusable classes in `index.css`: `.panel-tech` (glass + clip-path corner cuts), `.section-label`, `.btn-primary` / `.btn-secondary` (slant clip-path + glow), `.dropzone-frame`. Don't introduce per-component custom panel styles — extend the design system in `index.css` instead. Full reference: `.agent/FRONTEND.md`.

- **No migrations framework** — schema changes = manual `ALTER TABLE` in psql, update SQLAlchemy model, rebuild backend container.

- **Adding a new character** — entry in `data/game_data.py → CHARACTER_DATA` (rv weights + er + element/weapon/role). `CHARACTER_LIST` is auto-derived. On backend restart, `seed_characters()` inserts any missing chars idempotently — no manual SQL needed. Frontend portrait: drop `frontend/public/characters/{slug}.webp` (slug = lowercase base name with hyphens; role suffix in parens is stripped automatically).

- **EVC upstream sync** — when `echovaluecalc.com` adds a character (banner fires when `evc_status.acknowledged_date < latest`), pull the rv array + er from the upstream `evc_engine.py` diff (`AstyuteChick/Echo-Value-Calculator`) and **ask the user** for element/weapon/role rather than web-researching.
