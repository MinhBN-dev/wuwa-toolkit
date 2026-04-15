# Echoes Optimizer — DevOps & Environment

## Local Development

### Prerequisites
- Python 3.12.3 (system), `.venv` tại `backend/.venv`
- Node.js v20 (via nvm)
- Docker (PostgreSQL + app containers)

### Cách chạy local (dev mode)

**1. PostgreSQL** — đã chạy sẵn trong Docker
```bash
docker ps | grep shared-postgres   # kiểm tra
```

**2. Backend**
```bash
cd /home/ubuntu-dev/Projects/Echoes_Optimizer/backend
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

**3. Frontend**
```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /home/ubuntu-dev/Projects/Echoes_Optimizer/frontend
npm run dev   # port 5174
```

### URLs local
- Frontend: http://localhost:5174
- Backend API: http://localhost:8001/api/v1
- Swagger UI: http://localhost:8001/docs

---

## Docker Production

### Cấu trúc containers

| Container | Image | Port | Mô tả |
|---|---|---|---|
| `echoes-frontend` | nginx:alpine + React build | 0.0.0.0:80 | Serve static + proxy /api |
| `echoes-backend` | python:3.12-slim | internal:8001 | FastAPI |
| `shared-postgres` | postgres:16-alpine | 5432 | DB dùng chung, external |

### Networks
- `echoes_optimizer_internal`: frontend ↔ backend
- `easm_toolkit_default` (external): backend ↔ shared-postgres

### Volumes
- `echoes_optimizer_uploads`: ảnh echo upload
- `echoes_optimizer_evc_state`: file `evc_status.json`

### Khởi động / Dừng
```bash
cd /home/ubuntu-dev/Projects/Echoes_Optimizer

docker compose up -d           # khởi động
docker compose down            # dừng (giữ volumes)
docker compose logs -f backend # xem log backend
docker compose logs -f frontend
```

### Rebuild sau khi sửa code
```bash
# Chỉ rebuild frontend (React/TS changes):
docker compose build frontend && docker compose up -d frontend

# Chỉ rebuild backend (Python changes):
docker compose build backend && docker compose up -d backend

# Rebuild tất cả:
docker compose build && docker compose up -d
```

---

## Domain nội bộ (echoes.local)

Dùng Avahi mDNS — VM broadcast hostname, mọi máy trong LAN tự resolve:
```bash
sudo systemctl status avahi-daemon   # phải active
hostname                              # phải là "echoes"
```

Cấu hình nginx proxy trong `nginx/echoes.conf` (không còn dùng sau khi có Docker — frontend container có nginx riêng).

### Truy cập từ các máy
| Máy | URL |
|---|---|
| VM (Ubuntu dev) | http://localhost hoặc http://echoes.local |
| Laptop (VMware host) | http://echoes.local hoặc http://your-server-ip |
| PC LAN | http://echoes.local |

---

## Database

### Connection
```
Host: localhost:5432 (Docker: shared-postgres)
DB:   echoes_optimizer
User: echoes_user / Pass: your_password
```

### psql
```bash
PGPASSWORD="your_password" psql -h localhost -U echoes_user -d echoes_optimizer
```

### Reset tables (nếu schema thay đổi)
```bash
PGPASSWORD="your_password" psql -h localhost -U echoes_user -d echoes_optimizer \
  -c "DROP TABLE IF EXISTS echo_sets, echoes, characters CASCADE;"
# Restart backend → tự tạo lại + seed characters
```

---

## Env Files

### backend/.env (local dev)
```
DATABASE_URL=postgresql+asyncpg://echoes_user:your_password@localhost:5432/echoes_optimizer
GOOGLE_API_KEY=<key>        # aistudio.google.com, free 1000 req/day
UPLOAD_DIR=/home/ubuntu-dev/Projects/Echoes_Optimizer/backend/uploads
MAX_UPLOAD_SIZE_MB=20
ALLOWED_ORIGINS=http://localhost:5174,http://localhost:3000
```

### docker-compose.yml overrides (production)
```
DATABASE_URL: postgresql+asyncpg://...@shared-postgres:5432/...  ← container name
UPLOAD_DIR:   /app/uploads
DATA_DIR:     /app/data
ALLOWED_ORIGINS: http://echoes.local,http://localhost,http://your-server-ip
```

---

## GitHub

Repo: https://github.com/MinhBN-dev/echoes-optimizer (private)
Credentials: stored in `~/.git-credentials` (credential.helper=store)

```bash
git add -A && git commit -m "..." && git push
```

---

## Common Issues

### Backend không kết nối DB
→ `docker ps | grep shared-postgres`
→ Kiểm tra DATABASE_URL trong `backend/.env`

### OCR không hoạt động
→ Kiểm tra GOOGLE_API_KEY trong `backend/.env`
→ Model: gemini-2.5-flash (gemini-2.0-flash bị limit=0 trên project mới)

### echoes.local không resolve
→ `systemctl is-active avahi-daemon` — phải active
→ `hostname` — phải là `echoes`
→ Nếu sai: `sudo systemctl restart avahi-daemon`

### Frontend không gọi được API (local)
→ Kiểm tra vite.config.ts: proxy /api → http://localhost:8001
→ Kiểm tra backend đang chạy port 8001
