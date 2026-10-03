# CLAUDE.md — Wuwa Toolkit

## Project scope

Self-hosted multi-tool web app cho **Wuthering Waves**: echo optimizer (EVC-based, gốc của repo), Convene history tracker, character build planner — và sẽ còn mở rộng. Treat codebase như umbrella: feature mới thêm dạng page/router/service **sibling**, không đan vào cái có sẵn. Chữ **Echo** trong code (`Echo` model, `/echoes`, `scoring_service`) là thuật ngữ in-game, **không** đổi tên.

## Before You Start

1. **Đọc memory** — `~/.claude/projects/-home-ubuntu-dev-Projects-Wuwa-Toolkit/memory/MEMORY.md`.
2. **`.agent/INDEX.md` là router** — mọi thứ ngoài file này (route table, scoring detail, file map, troubleshooting) nằm ở `.agent/<area>.md`. Đừng đọc source để tự suy ra.
3. **Cập nhật docs cùng task với code**: endpoint/model/scoring → `.agent/BACKEND.md` · page/component/type/API → `.agent/FRONTEND.md` · schema/migration → `.agent/DATABASE.md` · env/Docker/deploy → `.agent/DEVOPS.md` · convention mới → file này (1 dòng).

`.agent/` là **source of truth**. Viết hơn 1 dòng về một chủ đề ⇒ nó thuộc `.agent/`, không thuộc đây.

---

## Development Commands

### Local dev (no Docker)

```bash
# Backend — port 8001 (khớp proxy trong vite.config.ts), hot-reload
cd backend
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# Frontend — port 5174
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd frontend && npm run dev
```

FE `http://localhost:5174` · BE `http://localhost:8001/api/v1` · Swagger `http://localhost:8001/docs`. Đổi port BE **phải** sửa cả `frontend/vite.config.ts` (proxy `/api` + `/uploads`), không thì FE nhận 500.

### Docker (production)

```bash
docker compose build <service> && docker compose up -d <service>   # rebuild 1 service
docker compose logs -f <service>
```

Production URL `http://wuwa-toolkit.local` (Avahi mDNS). Container names `wuwa-toolkit-backend` / `-frontend`. `docker-compose.override.yml` (gitignored) là thứ nối máy này vào `shared-postgres` + `edge_net`/`db_net` — public user không cần. Chi tiết + troubleshooting mDNS: `.agent/DEVOPS.md`, topology máy: `~/.claude/docs/NETWORK.md`.

### Database & type-check

```bash
PGPASSWORD="$POSTGRES_PASSWORD" psql -h localhost -U wuwa_toolkit_user -d wuwa_toolkit_db
cd frontend && npx tsc --noEmit
```

DB name `wuwa_toolkit_db` ở cả hai setup (standalone lẫn shared-postgres). Reset tables → `.agent/DEVOPS.md`.

---

## Key Conventions

Rule 1 dòng — WHY và chi tiết ở `.agent/` được trỏ kèm.

**Scoring**
- **Điểm đã lưu là snapshot đóng băng** — sửa weight/formula/threshold/`STAT_NAME_MAP` làm chúng stale ⇒ chạy `POST /score/recalculate-all`. Thêm nhân vật MỚI thì không cần. → `BACKEND.md → Recalculating saved scores`
- **`score_percent` không bị cap** — >100 là hợp lệ; `Math.min(...,100)` chỉ dùng cho bề rộng thanh bar.
- **Set page bắt buộc `POST /score/calculate-set`** — không gọi single-echo 5×; ER là state chạy tuần tự nên trung bình cộng sai lệch với EVC. → `BACKEND.md`
- **ER là một khoảng, không phải điểm** — `_ER_SURPLUS_BUFFER = 3.1`. → `BACKEND.md → ER surplus-range model`
- **Tier là chuỗi EVC** (`"Godly"`, `"High Investment"`…), letter grade S/A/B/C/D đã bỏ hẳn. Sync `data/game_data.py → TIER_THRESHOLDS` ↔ `frontend/src/utils/tier.ts`.
- **Stat name duality** — display name (FE/OCR) vs internal name (EVC): `scoring_service.py → STAT_NAME_MAP`.
- **EVC upstream sync** — lấy rv + er từ diff upstream, **hỏi user** element/weapon/role thay vì tự research; validate bằng parity harness. → `BACKEND.md → Syncing upstream EVC updates`

**Data**
- **Save echo chỉ qua `POST /echoes/find-or-create`** (fingerprint dedup) — **không** có `POST /echoes` thường.
- **Không có migrations framework** — schema đổi = `ALTER TABLE` tay + sửa model + rebuild backend. → `DEVOPS.md`
- **Thêm nhân vật** = entry trong `CHARACTER_DATA` + portrait `frontend/public/characters/{slug}.webp`; `seed_characters()` insert idempotent khi restart. Rename thì **không** tự migrate → `BACKEND.md → Rename gotcha`.
- **Convene: `pull_id` neo theo timestamp** (`synth_pull_id`), **tuyệt đối không** dùng số thứ tự vị trí — API trả sliding window nên index dịch chuyển, pull mới bị `ON CONFLICT` nuốt im lặng. Oversea-only. → `BACKEND.md`
- **Win rate 50/50 loại guaranteed** — 5★ đến sau một lần thua standard pool không tính vào mẫu.
- **`buff_data.py` là dataset tra cứu, không phải input scoring** — sửa nó không cần recalculate. → `BACKEND.md → Team buff data`

**Frontend**
- **OCR local-first** — RapidOCR → Gemini `gemini-2.5-flash` → OpenAI → Anthropic. **Không dùng `gemini-2.0-flash`** (rate limit = 0). → `BACKEND.md`
- **Design system ở `index.css`** (`.panel-tech`, `.btn-*`, `.section-label`) — mở rộng ở đó, đừng chế panel style riêng cho từng component. → `FRONTEND.md → Component Classes`
- **Nhãn tiếng Việt phải dùng `font-vn`** (Chakra Petch) — Rajdhani (`font-display`) không có glyph tiếng Việt, chữ có dấu sẽ lệch font.
- **Mọi thời gian UI ở UTC+7** — `utils/time.ts`: `formatGameTime` cho pull time, `formatLocalTime` cho timestamp UTC. Format `YYYY-MM-DD HH:MM:SS`.
- **Character build status ở server** (`character_profiles`), `Characters.tsx` auto-migrate từ localStorage 1 lần. **EVC banner** fetch 1 lần/session (`staleTime: Infinity`).
