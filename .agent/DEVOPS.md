# Wuwa Toolkit — DevOps & Environment

> Source of truth cho: chạy local/Docker, env, DB, deployment URLs, troubleshooting.

## Service Map

### Local dev (native, no Docker app)
```
http://localhost:5174  ← Frontend (Vite dev server)
http://localhost:8000  ← Backend (FastAPI + uvicorn --reload)
http://localhost:8000/docs  ← Swagger UI
127.0.0.1:5432         ← shared-postgres (bind localhost only)
```

### Docker production (qua nginx-proxy ở `~/Projects/infra/`)
```
http://wuwa-toolkit.local (host :80)
  └── nginx-proxy (infra/) → wuwa-toolkit-frontend:80
                              ├── /*        → static React build
                              ├── /api/     → wuwa-toolkit-backend:8000
                              └── /uploads/ → wuwa-toolkit-backend:8000
```
Hostname `wuwa-toolkit.local` ưu tiên `/etc/hosts` (VM + LAN client). Modem chặn mDNS multicast → mỗi LAN client cần hosts entry. Topology mạng VM chi tiết ở global `~/.claude/CLAUDE.md`.

## Local Development

### Prerequisites
- Python 3.12.3 (system), `.venv` tại `backend/.venv`
- Node.js v20 (via nvm)
- Docker (shared-postgres + nginx-proxy chạy sẵn từ `~/Projects/infra/`)

### Cách chạy local

```bash
# 1. Đảm bảo shared-postgres đang chạy
docker ps | grep shared-postgres

# 2. Backend
cd /home/ubuntu-dev/Projects/Wuwa_Toolkit/backend
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# Cần đồng thời chạy BE khác trên host? Override --port

# 3. Frontend
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /home/ubuntu-dev/Projects/Wuwa_Toolkit/frontend
npm run dev   # → port 5174
```

---

## Docker Production

### Compose layout

| File | Vai trò |
|---|---|
| `docker-compose.yml` | Base (committed). Service `postgres` cho public users standalone. |
| `docker-compose.override.yml` | Machine-specific (gitignored). Disable standalone postgres, dùng `shared-postgres`, join `edge_net`/`db_net`. |

### Containers (trên máy này, với override)

| Container | Image | Port (container) | Networks |
|---|---|---|---|
| `wuwa-toolkit-frontend` | wuwa_toolkit-wuwa-toolkit-frontend | 80 | internal, edge_net |
| `wuwa-toolkit-backend` | wuwa_toolkit-wuwa-toolkit-backend | 8000 | internal, db_net |

KHÔNG có `wuwa-toolkit-postgres` container chạy trên máy này (override disable). DB ở `shared-postgres` (infra/).

### docker-compose.override.yml (machine-specific)

```yaml
services:
  postgres:
    profiles: ["disabled"]
  wuwa-toolkit-backend:
    depends_on:
      postgres:
        condition: service_started
        required: false
    environment:
      DATABASE_URL: postgresql+asyncpg://wuwa_toolkit_user:${POSTGRES_PASSWORD}@shared-postgres:5432/wuwa_toolkit_db
    networks:
      - internal
      - db_net
  wuwa-toolkit-frontend:
    ports: !reset []
    networks:
      - internal
      - edge_net

networks:
  db_net:
    external: true
  edge_net:
    external: true
```

### Khởi động / Dừng / Rebuild

```bash
cd /home/ubuntu-dev/Projects/Wuwa_Toolkit
docker compose up -d                                        # khởi động
docker compose down                                          # dừng (giữ volumes)
docker compose logs -f wuwa-toolkit-backend                 # log BE
docker compose build wuwa-toolkit-frontend && docker compose up -d wuwa-toolkit-frontend  # rebuild 1 service
```

Vhost `wuwa-toolkit.local` được nginx-proxy ở `~/Projects/infra/` route — đã có sẵn block trong `infra/nginx.conf`. Không cần edit gì khi rebuild.

---

## Domain nội bộ (`wuwa-toolkit.local`)

`/etc/hosts` VM đã có `127.0.0.1 wuwa-toolkit.local`. LAN client cần hosts entry (modem chặn mDNS multicast). Chi tiết troubleshoot mạng VM (ens33 NAT, ens37 bridged, Viettel modem, mDNS workaround) ở global `~/.claude/CLAUDE.md` § Deployment Topology.

---

## Database

| Item | Value |
|---|---|
| Container | `shared-postgres` (infra/) |
| DB | `wuwa_toolkit_db` |
| User | `wuwa_toolkit_user` |
| Password | xem `.env` (`POSTGRES_PASSWORD`) |
| Host (native dev) | `localhost:5432` (bind 127.0.0.1) |
| Host (trong Docker) | `shared-postgres:5432` (cùng network `db_net`) |

### psql

```bash
PGPASSWORD="$POSTGRES_PASSWORD" psql -h localhost -U wuwa_toolkit_user -d wuwa_toolkit_db
```

### Reset tables (nếu schema thay đổi)

```bash
PGPASSWORD="$POSTGRES_PASSWORD" psql -h localhost -U wuwa_toolkit_user -d wuwa_toolkit_db \
  -c "DROP TABLE IF EXISTS character_profiles, echo_sets, echoes, characters, convene_pulls CASCADE;"
# Restart backend → tự tạo lại + seed characters
# Lưu ý: xóa character_profiles sẽ mất build status; xóa convene_pulls sẽ mất history
```

### DBA tasks

User `dba` (superuser shared admin). KHÔNG dùng `postgres` hay `dba` trong app `.env`. Schema change → manual `ALTER TABLE` qua `dba` (không có Alembic).

---

## Env Files

### Docker (`.env` root)

```env
POSTGRES_USER=wuwa_toolkit_user
POSTGRES_PASSWORD=your_password
GOOGLE_API_KEY=your_google_ai_key
PORT=80                              # không dùng trên máy này (nginx-proxy proxy vào)
ALLOWED_ORIGINS=http://localhost,http://wuwa-toolkit.local
```

### Local dev (`backend/.env`)

```env
DATABASE_URL=postgresql+asyncpg://wuwa_toolkit_user:your_password@localhost:5432/wuwa_toolkit_db
GOOGLE_API_KEY=your_key
UPLOAD_DIR=/home/ubuntu-dev/Projects/Wuwa_Toolkit/backend/uploads
ALLOWED_ORIGINS=http://localhost:5174
```

---

## GitHub

Repo: <https://github.com/MinhBN-dev/wuwa-toolkit> (private, renamed from `echoes-optimizer` ngày 2026-05-08 — old URL redirects).
Credentials lưu trong `~/.git-credentials` (credential.helper=store). Chi tiết push policy + tạo repo mới ở global `~/.claude/CLAUDE.md`.

---

## Common Issues

### Backend không kết nối DB
- `docker ps | grep shared-postgres` — phải up.
- `DATABASE_URL` đúng host (`localhost` native / `shared-postgres` Docker).
- Recreate `shared-postgres` → restart backend container để flush stale connection pool.

### OCR không hoạt động
- Check `GOOGLE_API_KEY` trong `backend/.env`.
- Model: `gemini-2.5-flash` (KHÔNG `gemini-2.0-flash` — rate limit 0 trên project mới).
- Local OCR (RapidOCR/EasyOCR) miễn key — không phụ thuộc API key.

### `wuwa-toolkit.local` không resolve
- VM: `getent hosts wuwa-toolkit.local` — phải ra `127.0.0.1`.
- LAN client: thêm `<VM-IP> wuwa-toolkit.local` vào hosts file (modem chặn mDNS).

### Frontend local không gọi được API
- `vite.config.ts` proxy `/api` → `http://localhost:8000` (port BE).
- Backend đang chạy port 8000 (check `lsof -i :8000`).
