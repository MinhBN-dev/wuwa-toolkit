# Echoes Optimizer — Agent Index

Đọc file này TRƯỚC KHI browse code. Mục đích: biết chính xác cần đọc file nào, tránh tốn context.

## Tài liệu chính

| File | Nội dung |
|---|---|
| `.agent/ARCHITECTURE.md` | Kiến trúc tổng quan, tech stack, data flow, scoring formula, dedup |
| `.agent/BACKEND.md` | Models, API routes, services, game data |
| `.agent/FRONTEND.md` | Components, pages, types, API calls, tier system |
| `.agent/DEVOPS.md` | Chạy local, Docker, domain, DB credentials, GitHub |

---

## Quick Reference

### Khi cần sửa scoring algorithm
→ `.agent/BACKEND.md` phần Services → `backend/app/services/scoring_service.py`
→ Character weights: `backend/app/data/game_data.py`

### Khi cần thêm character mới
→ `backend/app/data/game_data.py`: thêm vào `CHARACTER_WEIGHTS`, `CHARACTER_LIST`, và `CHARACTER_ER`
→ DB tự seed lại khi restart backend (nếu bảng characters trống)

### Khi cần sửa OCR prompt
→ `backend/app/services/ocr_service.py` → `EXTRACTION_PROMPT`
→ Model hiện tại: gemini-2.5-flash (KHÔNG dùng gemini-2.0-flash — bị rate limit=0)

### Khi cần sửa tier labels
→ `frontend/src/utils/tier.ts` → `TIER_THRESHOLDS`
→ Backend: `backend/app/services/scoring_service.py` → `_get_tier_label()` + `backend/app/data/game_data.py` → `TIER_THRESHOLDS`

### Khi cần thêm API endpoint
→ `.agent/BACKEND.md` phần API Routes để biết pattern
→ Thêm vào router tương ứng trong `backend/app/routers/`
→ Đăng ký trong `backend/app/main.py` nếu là router mới
→ Thêm vào `frontend/src/services/api.ts`
→ **CẬP NHẬT `.agent/BACKEND.md` + `.agent/FRONTEND.md` ngay cùng lúc**

### Khi cần sửa UI component
→ `.agent/FRONTEND.md` phần Components để tìm file đúng

### Khi cần deploy lên Docker
→ `.agent/DEVOPS.md` phần Docker Production
→ Lệnh: `docker compose build <service> && docker compose up -d <service>`

### Khi có lỗi DB schema
→ Drop + recreate: xem `.agent/DEVOPS.md` phần Reset tables

### Khi echoes.local không truy cập được
→ Xem `.agent/DEVOPS.md` phần Common Issues → echoes.local không resolve

### Khi cần hiểu EVC deduplication
→ `.agent/ARCHITECTURE.md` phần Echo Deduplication
→ Code: `backend/app/routers/echoes.py` → `find_or_create_echo()`

### Khi cần hiểu EVC banner / changelog
→ `.agent/ARCHITECTURE.md` phần Data Flow (EVC)
→ Backend: `backend/app/routers/evc_status.py`
→ Frontend: `frontend/src/components/EvcBanner.tsx`

### Khi cần sửa character build status / notes
→ Backend: `backend/app/routers/character_profiles.py` + model `CharacterProfile` trong `models/echo.py`
→ Frontend: `frontend/src/pages/Characters.tsx` + `frontend/src/utils/character.ts`
→ API: `GET/PUT /api/v1/character-profiles`, `POST /api/v1/character-profiles/bulk`
