# Echoes Optimizer — DevOps & Environment

> Source of truth cho: chạy local/Docker, env, DB, deployment URLs, troubleshooting.

## Service Map

### Local dev
```
http://localhost:5174  ← Frontend (Vite dev server)
http://localhost:8001  ← Backend (FastAPI + uvicorn --reload)
http://localhost:8001/docs  ← Swagger UI
localhost:5432         ← PostgreSQL (Docker: echoes-postgres / shared-postgres tùy setup)
```

### Docker production
```
http://echoes.local (port ${PORT:-80}) ← nginx (echoes-frontend container)
    ├── /*        → static React build
    ├── /api/     → echoes-backend (:8001)
    └── /uploads/ → echoes-backend (:8001)
```
Hostname `echoes.local` broadcast qua Avahi mDNS — mọi máy LAN tự resolve. Local dev: Vite proxy `/api` → `localhost:8001` trực tiếp (không qua nginx).

## Local Development

### Prerequisites
- Python 3.12.3 (system), `.venv` tại `backend/.venv`
- Node.js v20 (via nvm)
- Docker (PostgreSQL + app containers)

### Cách chạy local (dev mode)

**1. PostgreSQL** — phải chạy sẵn trong Docker
```bash
# Public default (docker-compose.yml standalone): container `echoes-postgres`
# Trên máy dev này (override): container `shared-postgres` dùng chung nhiều project
docker ps | grep -E 'echoes-postgres|shared-postgres'
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
| `echoes-frontend` | nginx:alpine + React build | `${PORT:-80}`:80 | Serve static + proxy /api |
| `echoes-backend` | python:3.12-slim | internal:8001 | FastAPI |
| `echoes-postgres` | postgres:16-alpine | internal:5432 | PostgreSQL (self-contained) |

### Networks
- `internal` (bridge): tất cả 3 container kết nối với nhau

### Volumes
- `postgres_data`: dữ liệu PostgreSQL
- `uploads`: ảnh echo upload
- `evc_state`: file `evc_status.json`

### docker-compose.override.yml (machine-specific, NOT committed)

Dùng để override config cho từng máy mà không sửa `docker-compose.yml` public.
Ví dụ trên máy dev này:
```yaml
services:
  postgres:
    profiles: ["disabled"]   # dùng shared-postgres thay vì standalone
  backend:
    depends_on:
      postgres:
        condition: service_started
        required: false
    environment:
      # shared-postgres convention: {project}_user / {project}_db
      DATABASE_URL: postgresql+asyncpg://echoes_user:${POSTGRES_PASSWORD}@shared-postgres:5432/echoes_db
    networks:
      - internal
      - easm_toolkit_default
  frontend:
    ports: !reset []          # bỏ port mapping, để nginx-proxy handle
    networks:
      - internal
      - nginx_proxy_default
networks:
  easm_toolkit_default:
    external: true
  nginx_proxy_default:
    external: true
```
File này đã được thêm vào `.gitignore`. Public users không cần file này (standalone postgres tự đủ).

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
| Setup | Container | DB | User |
|---|---|---|---|
| Public default (standalone) | `echoes-postgres` | `echoes_optimizer` | `echoes_user` |
| Máy dev này (override → shared) | `shared-postgres` | `echoes_db` | `echoes_user` |

Password: see `POSTGRES_PASSWORD` in `.env`. Cả 2 setup đều expose port `5432` trên host.

### psql

```bash
# Public default
PGPASSWORD="$POSTGRES_PASSWORD" psql -h localhost -U echoes_user -d echoes_optimizer

# Máy dev này (shared-postgres)
PGPASSWORD="$POSTGRES_PASSWORD" psql -h localhost -U echoes_user -d echoes_db
```

### Reset tables (nếu schema thay đổi)
```bash
# Thay -d <db_name> theo setup tương ứng (echoes_optimizer hoặc echoes_db)
PGPASSWORD="$POSTGRES_PASSWORD" psql -h localhost -U echoes_user -d <db_name> \
  -c "DROP TABLE IF EXISTS character_profiles, echo_sets, echoes, characters CASCADE;"
# Restart backend → tự tạo lại + seed characters
# Lưu ý: xóa character_profiles sẽ mất build status của tất cả nhân vật
```

---

## Env Files

### Docker (root `.env`)
Copy `.env.example` → `.env` and fill in values. docker-compose reads this automatically.
```
POSTGRES_PASSWORD=your_password
GOOGLE_API_KEY=your_google_ai_key
PORT=80
ALLOWED_ORIGINS=http://localhost
```

### Local dev (`backend/.env`)
Copy `backend/.env.example` → `backend/.env`:
```
DATABASE_URL=postgresql+asyncpg://echoes_user:your_password@localhost:5432/echoes_optimizer
GOOGLE_API_KEY=your_key
UPLOAD_DIR=/path/to/backend/uploads
ALLOWED_ORIGINS=http://localhost:5174
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
→ `docker ps | grep -E 'echoes-postgres|shared-postgres'` — postgres container phải đang up
→ Kiểm tra `DATABASE_URL` (Docker: trong `docker-compose.override.yml`/`docker-compose.yml`; local dev: `backend/.env`)
→ Nếu shared-postgres reset: DB name hiện là `echoes_db` (theo convention `{project}_db`), không phải `echoes_optimizer`

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
