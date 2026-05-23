# CLAUDE.md — Wuwa Toolkit

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project scope

**Wuwa Toolkit** is a self-hosted multi-tool web app for **Wuthering Waves**. Started as the EVC-based echo optimizer (the git history still reflects that origin), now also includes a Convene history tracker, character build planner, and is intended to grow further. Treat the codebase as an umbrella, not a single-feature app — when adding a new feature, prefer adding it as a sibling page/router/service rather than entangling with existing ones. The word **Echo** in code (`Echo` model, `/echoes` routes, `scoring_service`) refers to the in-game echo item — that is domain terminology, not the brand and should not be renamed.

## Before You Start

**Read memory** — `/home/ubuntu-dev/.claude/projects/-home-ubuntu-dev-Projects-Wuwa-Toolkit/memory/MEMORY.md` (user preferences, past feedback, project context).

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
# Backend — port 8000, hot-reload (override --port nếu chạy đồng thời BE khác)
cd backend
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend — port 5174
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd frontend && npm run dev
```

URLs: frontend `http://localhost:5174`, backend `http://localhost:8000/api/v1`, Swagger `http://localhost:8000/docs`.

### Docker (production)

```bash
docker compose build <service> && docker compose up -d <service>   # rebuild 1 service
docker compose logs -f <service>
```

Production URL: `http://wuwa-toolkit.local` (Avahi mDNS). LAN-wide auto-resolve only works when the home modem doesn't filter multicast; modems that do (e.g. Viettel DASAN H646GM-V) require a manual `hosts` entry on each LAN client — see `.agent/DEVOPS.md`.

`docker-compose.override.yml` is gitignored — used on this machine to swap to `shared-postgres` and join the LAN nginx-proxy (via `edge_net`/`db_net`). Public users don't need it. Service & container names: `wuwa-toolkit-backend`/`wuwa-toolkit-frontend` (consistent kebab prefix across all projects on this machine). Detail in `.agent/DEVOPS.md`.

### Database

DB name depends on setup:
- **Public default** (standalone `wuwa-toolkit-postgres`): `wuwa_toolkit_db`
- **This machine** (override → `shared-postgres`, naming convention `{project}_db`): `wuwa_toolkit_db`

```bash
PGPASSWORD="$POSTGRES_PASSWORD" psql -h localhost -U wuwa_toolkit_user -d wuwa_toolkit_db
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

- **OCR is local-first** — RapidOCR (ONNX, models bundled in wheel) → Gemini `gemini-2.5-flash` → OpenAI → Anthropic. RapidOCR is the only local engine (EasyOCR was dropped — its `torch` dep made the image huge and timed out the build on slow networks). It runs on a preprocessed image (`_prep_local_image`: robust decode → upscale-if-small → grayscale+CLAHE) which fixes raw-game-screenshot colorspace/bit-depth quirks; API providers get a normalized PNG. **Never use `gemini-2.0-flash`** (rate limit = 0 on new projects).

- **Character build status is server-side** — `character_profiles` table, accessed via `GET/PUT /api/v1/character-profiles`. `Characters.tsx` auto-migrates from localStorage once on first load when server is empty.

- **EVC banner fetched once per session** — `staleTime: Infinity`. Acknowledge writes both `evc_status.json` (server volume) and `localStorage` (client).

- **Design system** — WuWa-inspired tech-arcane theme. Rajdhani for display/UI/numbers (`font-display`, `.readout`), Inter for body. Reusable classes in `index.css`: `.panel-tech` (glass + clip-path corner cuts), `.section-label`, `.btn-primary` / `.btn-secondary` (slant clip-path + glow), `.dropzone-frame`. Don't introduce per-component custom panel styles — extend the design system in `index.css` instead. Full reference: `.agent/FRONTEND.md`.

- **No migrations framework** — schema changes = manual `ALTER TABLE` in psql, update SQLAlchemy model, rebuild backend container.

- **Adding a new character** — entry in `data/game_data.py → CHARACTER_DATA` (rv weights + er + element/weapon/role). `CHARACTER_LIST` is auto-derived. On backend restart, `seed_characters()` inserts any missing chars idempotently — no manual SQL needed. Frontend portrait: drop `frontend/public/characters/{slug}.webp` (slug = lowercase base name with hyphens; role suffix in parens is stripped automatically).

- **EVC upstream sync** — when `echovaluecalc.com` adds a character (banner fires when `evc_status.acknowledged_date < latest`), pull the rv array + er from the upstream `evc_engine.py` diff (`AstyuteChick/Echo-Value-Calculator`) and **ask the user** for element/weapon/role rather than web-researching.

- **Convene tracker is Oversea-only** — `convene_service.py` hits `gmserver-api.aki-game2.net`. Append-only via `(player_id, card_pool_type, pull_id)` UNIQUE + `ON CONFLICT DO NOTHING`. The export URL token (`record_id`) expires after a short time — not stored, user pastes a fresh URL each sync. `cardPoolId` (gacha_id) from URL must be reused for ALL cardPoolType values when calling the gacha API (passing `""` returns only a fragment of the data). The API doesn't include a unique id per pull, so `pull_id` is synthesized by `synth_pull_id` as a **stable timestamp-anchored id** `"{YYYYMMDDHHMMSS}-{NN}"` (NN = order within that same second, e.g. the 10 items of a 10-pull). **Do NOT use a positional sequence number** — the gacha API returns a *sliding window* (old pulls age out), so positional indices shift and new pulls collide with old ones → `ON CONFLICT` silently drops them ("up to date, no new pulls" after rolling). Timestamp-anchored ids are window-independent. Migrating old positional ids: order by old `pull_id` asc, group by `time`, re-number within each second.

- **50/50 win rate excludes guarantees** — Pool 1 win rate = real_wins / (real_wins + real_losses); a 5★ that came AFTER a standard-pool loss is `guaranteed` and skipped from the calculation. Standard 5★ resonators (used to detect losses): Calcharo, Encore, Jianxin, Lingyang, Verina. Astrites per pull: 160.

- **All UI times in UTC+7** — `utils/time.ts → formatGameTime` for WuWa pull times (parses naive ISO as UTC+8 game-server tz, displays in `Asia/Ho_Chi_Minh`); `formatLocalTime` for server-stored UTC timestamps. Display format: `YYYY-MM-DD HH:MM:SS`.
