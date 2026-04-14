# Echoes Optimizer — DevOps & Environment

## Local Development

### Prerequisites
- Python 3.12.3 (system)
- Node.js v20.20.2 (via nvm at ~/.nvm)
- Docker (PostgreSQL runs in shared container)

### Cách chạy local

**1. PostgreSQL (Docker — shared với EASM_Toolkit)**
```bash
# Container đã chạy sẵn: shared-postgres (port 5432)
# Database: echoes_optimizer, User: echoes_user
# Kiểm tra:
sg docker -c "docker ps | grep shared-postgres"
```

**2. Start Backend**
```bash
cd /home/ubuntu-dev/Projects/Echoes_Optimizer/backend
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

**3. Start Frontend**
```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /home/ubuntu-dev/Projects/Echoes_Optimizer/frontend
npm run dev
```

### URLs local
- Frontend: http://localhost:5174
- Backend API: http://localhost:8001/api/v1
- Swagger UI: http://localhost:8001/docs
- PostgreSQL: localhost:5432 (DB: echoes_optimizer)

## Database

### Connection Info
```
Host: localhost:5432 (Docker: shared-postgres)
Database: echoes_optimizer
User: echoes_user
Password: your_password
```

### Connect via psql
```bash
PGPASSWORD="your_password" psql -h localhost -U echoes_user -d echoes_optimizer
```

### Reset tables
```bash
PGPASSWORD="your_password" psql -h localhost -U echoes_user -d echoes_optimizer \
  -c "DROP TABLE IF EXISTS echoes, characters CASCADE;"
# Sau đó restart backend → tables tự tạo lại + seed characters
```

## Env Files

| File | Dùng cho |
|---|---|
| `backend/.env` | Local dev backend |
| `frontend/` | Vite proxy config (vite.config.ts) |

### backend/.env
```
DATABASE_URL=postgresql+asyncpg://echoes_user:your_password@localhost:5432/echoes_optimizer
GOOGLE_API_KEY=<your-google-api-key>   # lấy tại aistudio.google.com, free 1000 req/day
UPLOAD_DIR=/home/ubuntu-dev/Projects/Echoes_Optimizer/backend/uploads
MAX_UPLOAD_SIZE_MB=20
ALLOWED_ORIGINS=http://localhost:5174,http://localhost:3000
```

## Python Virtual Environment

```bash
# Đã tạo tại backend/.venv
cd /home/ubuntu-dev/Projects/Echoes_Optimizer/backend
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload
```

## Node.js (via nvm)

```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd frontend && npm install && npm run dev
```

## Common Issues

### Backend không kết nối DB
→ Kiểm tra shared-postgres container: `sg docker -c "docker ps"`
→ Kiểm tra DATABASE_URL trong `backend/.env`

### OCR không hoạt động
→ Kiểm tra GOOGLE_API_KEY trong `backend/.env`
→ Lấy key miễn phí tại https://aistudio.google.com/apikey
→ Free tier: 1000 requests/ngày với gemini-2.0-flash, không cần credit card

### Frontend không gọi được API
→ Kiểm tra vite.config.ts: proxy /api → http://localhost:8001
→ Kiểm tra backend đang chạy đúng port (8001, không phải 8000 nếu EASM cũng chạy)
