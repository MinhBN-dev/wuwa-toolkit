# Echoes Optimizer — Agent Index

Đây là file chỉ mục để agent đọc trước khi xem code.
Mục đích: tiết kiệm context bằng cách biết chính xác cần đọc file nào cho từng task.

## Tài liệu chính

| File | Nội dung |
|---|---|
| `.agent/ARCHITECTURE.md` | Kiến trúc tổng quan, tech stack, data flow |
| `.agent/BACKEND.md` | Chi tiết backend: models, routes, services, scoring algorithm |
| `.agent/FRONTEND.md` | Chi tiết frontend: components, pages, API hooks |
| `.agent/DEVOPS.md` | Cách chạy local, env variables, DB credentials |

## Quick Reference

### Khi cần sửa scoring algorithm
→ Đọc `.agent/BACKEND.md` phần Services → `scoring_service.py`
→ Character weights: `backend/app/data/game_data.py`

### Khi cần thêm character mới
→ `backend/app/data/game_data.py`: thêm vào `CHARACTER_WEIGHTS` và `CHARACTER_LIST`
→ DB tự seed lại khi restart backend (nếu bảng characters trống)

### Khi cần sửa OCR prompt
→ `backend/app/services/ocr_service.py` → `EXTRACTION_PROMPT`

### Khi cần sửa UI component
→ Đọc `.agent/FRONTEND.md` phần Components

### Khi cần thêm API endpoint
→ Đọc `.agent/BACKEND.md` phần Routers

### Khi có lỗi DB schema
→ DROP tables trong PostgreSQL, restart backend → tự tạo lại
→ Command: `PGPASSWORD="echoes_pass_2026" psql -h localhost -U echoes_user -d echoes_optimizer -c "DROP TABLE IF EXISTS echoes, characters CASCADE;"`
