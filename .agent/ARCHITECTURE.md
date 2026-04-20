# Echoes Optimizer — Architecture

## Mục đích
Web app hỗ trợ quản lý và đánh giá echo trong Wuthering Waves.
- Upload ảnh echo → EasyOCR (local) hoặc Google Gemini Vision đọc stats tự động
- Tính điểm echo theo character và build context (công thức EVC 3.2)
- Lưu bộ echo (full set 5 slots) cho từng nhân vật để xem lại
- Theo dõi EVC changelog và thông báo khi có update mới
- Theo dõi build status từng nhân vật (Built/Building/Not Built), lưu server-side

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI (Python 3.12), SQLAlchemy async, asyncpg |
| Frontend | React 18 + TypeScript, Vite, TailwindCSS |
| Database | PostgreSQL 16 (Docker container: shared-postgres) |
| OCR | EasyOCR (local primary) → Gemini gemini-2.5-flash → OpenAI → Anthropic |
| Scoring | Custom algorithm based on EVC (echovaluecalc.com) |
| State | TanStack Query (server state), local useState |
| Notifications | Sonner (toast) |
| Routing | react-router-dom v6 |
| Deployment | Docker Compose (frontend nginx + backend uvicorn) |

## Service Map

### Local Dev
```
http://localhost:5174  ← Frontend (Vite dev server)
http://localhost:8001  ← Backend (FastAPI + uvicorn --reload)
localhost:5432         ← PostgreSQL (Docker: shared-postgres)
```

### Docker Production
```
http://echoes.local (port 80) ← nginx (echoes-frontend container)
    ├── /* → static React build
    ├── /api/ → echoes-backend container (:8001)
    └── /uploads/ → echoes-backend container (:8001)
```
Hostname `echoes.local` broadcast qua Avahi mDNS — mọi máy trong LAN tự resolve.

## Data Flow

```
User uploads echo screenshot
    → POST /api/v1/ocr/extract
    → Backend saves image to uploads/
    → EasyOCR (local) reads stats; falls back to Gemini → OpenAI → Anthropic
    → Returns: echo_name, echo_set, main_stat, sub_stats[]

User chọn character + nhập total ER
    → POST /api/v1/score/calculate
    → Backend tính weighted score theo EVC formula
    → Returns: score_percent (0-100), tier_label (Godly/Extreme/…), breakdown

User bấm Save echo (Home page)
    → POST /api/v1/echoes/find-or-create
    → Dedup: tìm echo trùng (same name+cost+substats) → trả về cũ nếu có

User bấm Save set (Set page)
    → find-or-create mỗi slot → lấy echo_id
    → POST /api/v1/sets với slots chứa echo_id
    → Slots lưu cả snapshot data + echo_id để remap sau này

User xem Saved Echoes
    → GET /api/v1/echoes?character_id=...

App khởi động
    → GET /api/v1/evc-status (staleTime: Infinity — 1 lần/session)
    → Nếu EVC có bản mới → hiện banner vàng
    → User bấm X → POST /evc-status/acknowledge
    → Lưu vào evc_status.json (server) + localStorage (client)
    → Tất cả browser không hiện lại

Characters page khởi động
    → GET /api/v1/character-profiles (source of truth — synced across browsers)
    → Nếu server trống + localStorage có data → POST /character-profiles/bulk (one-time migration)
    → User click icon/badge → PUT /api/v1/character-profiles/{name} (upsert)
```

## Scoring Algorithm (EVC formula)

```
Single echo (stateless):
    AV = Σ (value / substat_median) × character_weight   for each substat
    EP = sum of top-5 character weights (+ er_ep_weight if ER needed)
    ES = (AV / EP) × 100    ← NOT capped, can exceed 100

Full-set (stateful ER — always use for Set page):
    Echoes with ER substat scored first; er_net_av / er_net_ep carried forward
    set_score = (Σ AV across all 5 echoes / Σ EP across all 5 echoes) × 100
    NOT a simple arithmetic mean of individual scores

Tier labels (EVC):
    Godly           ≥ 99
    Extreme         ≥ 88
    High Investment ≥ 77
    Well Built      ≥ 66
    Decent          ≥ 55
    Base Level      ≥ 44
    Unbuilt         < 44
```

## Echo Deduplication

Fingerprint = `echo_name` + `echo_cost` + substats sorted by `type` (values rounded 3dp)
- `POST /echoes/find-or-create`: trả về echo cũ nếu trùng, tạo mới nếu chưa
- Unmapping khỏi set không xóa echo khỏi DB
- Remapping (paste lại echo đó) → find-or-create tự link về đúng record
