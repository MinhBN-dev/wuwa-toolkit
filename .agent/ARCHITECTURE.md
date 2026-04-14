# Echoes Optimizer — Architecture

## Mục đích
Web app hỗ trợ quản lý và đánh giá echo trong Wuthering Waves.
- Upload ảnh echo → Claude Vision AI đọc stats tự động
- Tính điểm echo theo character và build context
- Lưu bộ echo cho từng nhân vật để xem lại

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI (Python 3.12), SQLAlchemy async, asyncpg |
| Frontend | React 18 + TypeScript, Vite, TailwindCSS |
| Database | PostgreSQL 16 (Docker container: shared-postgres) |
| OCR | Google Gemini Vision API (gemini-2.0-flash, free 1000 req/day) |
| Scoring | Custom algorithm based on WW community data |
| State | TanStack Query (server state), local useState |
| Notifications | Sonner (toast) |
| File Upload | react-dropzone |
| Routing | react-router-dom v6 |

## Service Map (local dev)

```
http://localhost:5174  ← Frontend (Vite dev server)
http://localhost:8001  ← Backend (FastAPI + uvicorn --reload)
localhost:5432         ← PostgreSQL (Docker: shared-postgres)
```

Swagger UI: http://localhost:8001/docs

## Data Flow

```
User uploads echo screenshot
    → POST /api/v1/ocr/extract
    → Backend saves image to /backend/uploads/
    → Claude Vision API reads stats from image
    → Returns: echo_name, echo_set, main_stat, sub_stats[]

User chọn character + nhập total ER
    → POST /api/v1/score/calculate
    → Backend tính weighted score dựa trên character weights
    → Returns: score (0-100), tier (S/A/B/C/D), breakdown per stat

User bấm Save
    → POST /api/v1/echoes
    → Lưu vào DB với score đã tính

User xem Saved Echoes
    → GET /api/v1/echoes?character_id=...
    → Filter by character, tier, search
```

## Scoring Algorithm

```
For each sub-stat:
    roll_quality = actual_value / max_value (0-1)
    contribution = roll_quality × character_weight × 100

raw_score = Σ contributions
max_possible = sum of top 5 character weights × 100
score_percent = (raw_score / max_possible) × 100

Tier:
    S ≥ 75%
    A ≥ 55%
    B ≥ 40%
    C ≥ 25%
    D < 25%
```
