# Wuwa Toolkit — DevOps & Environment

> Source of truth cho: chạy local/Docker, env, DB, deployment URLs, troubleshooting.

## Service Map

### Local dev
```
http://localhost:5174  ← Frontend (Vite dev server)
http://localhost:8001  ← Backend (FastAPI + uvicorn --reload)
http://localhost:8001/docs  ← Swagger UI
localhost:5432         ← PostgreSQL (Docker: wuwa-toolkit-postgres / shared-postgres tùy setup)
```

### Docker production
```
http://wuwa-toolkit.local (port ${PORT:-80}) ← nginx (wuwa-toolkit-frontend container)
    ├── /*        → static React build
    ├── /api/     → wuwa-toolkit-backend (:8001)
    └── /uploads/ → wuwa-toolkit-backend (:8001)
```
Hostname `wuwa-toolkit.local` broadcast qua Avahi mDNS — máy LAN tự resolve **nếu modem không filter multicast UDP**. Một số modem mới (vd Viettel DASAN H646GM-V) chặn mDNS giữa WiFi ↔ Ethernet → LAN client phải thêm hosts entry thủ công, xem section "Domain nội bộ" bên dưới. Local dev: Vite proxy `/api` → `localhost:8001` trực tiếp (không qua nginx).

## Local Development

### Prerequisites
- Python 3.12.3 (system), `.venv` tại `backend/.venv`
- Node.js v20 (via nvm)
- Docker (PostgreSQL + app containers)

### Cách chạy local (dev mode)

**1. PostgreSQL** — phải chạy sẵn trong Docker
```bash
# Public default (docker-compose.yml standalone): container `wuwa-toolkit-postgres`
# Trên máy dev này (override): container `shared-postgres` dùng chung nhiều project
docker ps | grep -E 'wuwa-toolkit-postgres|shared-postgres'
```

**2. Backend**
```bash
cd /home/ubuntu-dev/Projects/Echoes_Optimizer/backend
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

> Dir name vẫn là `Echoes_Optimizer/` (giữ nguyên history & path-coupled config); brand mới chỉ áp dụng cho UI/container/DB.

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
| `wuwa-toolkit-frontend` | nginx:alpine + React build | `${PORT:-80}`:80 | Serve static + proxy /api |
| `wuwa-toolkit-backend` | python:3.12-slim | internal:8001 | FastAPI |
| `wuwa-toolkit-postgres` | postgres:16-alpine | internal:5432 | PostgreSQL (self-contained) |

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
      DATABASE_URL: postgresql+asyncpg://wuwa_toolkit_user:${POSTGRES_PASSWORD}@shared-postgres:5432/wuwa_toolkit_db
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

## Domain nội bộ (wuwa-toolkit.local)

VM broadcast hostname qua Avahi mDNS:
```bash
sudo systemctl status avahi-daemon   # phải active
hostname                              # phải là "wuwa-toolkit"
```

Cấu hình nginx proxy trong `nginx/wuwa-toolkit.conf` (không còn dùng sau khi có Docker — frontend container có nginx riêng).

### Truy cập từ các máy
| Máy | URL | Ghi chú |
|---|---|---|
| VM (Ubuntu dev) | http://localhost hoặc http://wuwa-toolkit.local | OK qua loopback + Avahi local |
| Laptop (VMware host) | http://wuwa-toolkit.local hoặc http://192.168.1.12 | Cùng máy với VM, mDNS work qua bridged adapter |
| PC LAN (Ethernet) | http://wuwa-toolkit.local **(cần hosts entry)** hoặc http://192.168.1.12 | Modem hiện tại chặn mDNS — xem workaround |

### mDNS không work giữa LAN clients (modem chặn multicast)

**Topology hiện tại trên máy này:** VM chạy trong VMware trên laptop (laptop kết nối modem qua **WiFi**). PC khác trong LAN cắm dây **Ethernet** vào cùng modem. mDNS cần multicast UDP `224.0.0.251:5353` đi xuyên qua bridge WiFi ↔ Ethernet của modem.

**Modem hiện tại** (Viettel **DASAN H646GM-V**, GPON ONT 2022) **chặn multicast** giữa WiFi và Ethernet ports. Triệu chứng: từ PC LAN, `ping wuwa-toolkit.local` → `could not find host`, nhưng `ping 192.168.1.12` (IP trực tiếp) work bình thường.

**Đã exhausted root-cause fix qua admin panel** (`https://192.168.1.1`, login `admin / DSNW28e81d30` — pass dán đáy modem):
- WiFi Setup → Advanced Settings: AP Isolation OFF cả 2.4GHz và 5GHz, không có option multicast
- Advanced Setup → LAN Setup: port grouping all `Auto/Auto`, không có IGMP Snooping setting
- Firewall Setup → Firewall: tắt UDP Flood không fix
- Firewall Setup → L2 Filter: disabled
- → IGMP Snooping setting **bị firmware Viettel ẩn ở tier kỹ thuật** (pass khác mà chỉ technician Viettel có)

**Workaround — hosts file trên mỗi LAN client:**

Windows: mở Notepad **as Administrator** → File → Open → `C:\Windows\System32\drivers\etc\hosts` (đổi filter "All Files" để thấy file). Thêm dòng cuối:
```
192.168.1.12 wuwa-toolkit.local pit.local
```
Save → trong CMD: `ipconfig /flushdns` → test `ping wuwa-toolkit.local`.

Linux/macOS: thêm cùng dòng vào `/etc/hosts`.

Thay IP `192.168.1.12` bằng IP thực tế của VM trong LAN (`hostname -I` trên VM, lấy IP `192.168.1.x`).

---

## Database

### Connection
| Setup | Container | DB | User |
|---|---|---|---|
| Public default (standalone) | `wuwa-toolkit-postgres` | `wuwa_toolkit_db` | `wuwa_toolkit_user` |
| Máy dev này (override → shared) | `shared-postgres` | `wuwa_toolkit_db` | `wuwa_toolkit_user` |

Password: see `POSTGRES_PASSWORD` in `.env`. Cả 2 setup đều expose port `5432` trên host.

### psql

```bash
# Public default + máy dev này — DB name & user nay đồng nhất
PGPASSWORD="$POSTGRES_PASSWORD" psql -h localhost -U wuwa_toolkit_user -d wuwa_toolkit_db
```

### Reset tables (nếu schema thay đổi)
```bash
PGPASSWORD="$POSTGRES_PASSWORD" psql -h localhost -U wuwa_toolkit_user -d wuwa_toolkit_db \
  -c "DROP TABLE IF EXISTS character_profiles, echo_sets, echoes, characters, convene_pulls CASCADE;"
# Restart backend → tự tạo lại + seed characters
# Lưu ý: xóa character_profiles sẽ mất build status của tất cả nhân vật
#        xóa convene_pulls sẽ mất toàn bộ history đã import
```

### Rebrand từ echoes_user/echoes_db (one-time)

Nếu DB đang còn ở tên cũ (`echoes_user` / `echoes_db`), rename in-place:

```bash
# 1. Stop backend trước (disconnect tất cả session)
docker compose stop backend   # hoặc kill process uvicorn local-dev

# 2. Rename user + DB qua superuser (dba trên shared-postgres, hoặc postgres trên standalone)
docker exec shared-postgres psql -U dba -d postgres -c \
  "ALTER USER echoes_user RENAME TO wuwa_toolkit_user;"
docker exec shared-postgres psql -U dba -d postgres -c \
  "ALTER DATABASE echoes_db RENAME TO wuwa_toolkit_db;"

# 3. (Standalone setup) Cũng rename DB cũ tên `echoes_optimizer` → `wuwa_toolkit_db` nếu có
docker exec wuwa-toolkit-postgres psql -U postgres -c \
  "ALTER DATABASE echoes_optimizer RENAME TO wuwa_toolkit_db;"

# 4. Update DATABASE_URL trong backend/.env và/hoặc docker-compose.override.yml
#    (env files trong repo đã update; chỉ cần đảm bảo .env machine-specific khớp)

# 5. Restart backend
docker compose start backend
```

---

## Env Files

### Docker (root `.env`)
Copy `.env.example` → `.env` and fill in values. docker-compose reads this automatically.
```
POSTGRES_USER=wuwa_toolkit_user
POSTGRES_PASSWORD=your_password
GOOGLE_API_KEY=your_google_ai_key
PORT=80
ALLOWED_ORIGINS=http://localhost,http://wuwa-toolkit.local
```

### Local dev (`backend/.env`)
Copy `backend/.env.example` → `backend/.env`:
```
DATABASE_URL=postgresql+asyncpg://wuwa_toolkit_user:your_password@localhost:5432/wuwa_toolkit_db
GOOGLE_API_KEY=your_key
UPLOAD_DIR=/path/to/backend/uploads
ALLOWED_ORIGINS=http://localhost:5174
```

---

## GitHub

Repo: https://github.com/MinhBN-dev/wuwa-toolkit (private, renamed from `echoes-optimizer` — old URL still redirects)
Credentials: stored in `~/.git-credentials` (credential.helper=store)

```bash
git add -A && git commit -m "..." && git push
```

---

## Common Issues

### Backend không kết nối DB
→ `docker ps | grep -E 'wuwa-toolkit-postgres|shared-postgres'` — postgres container phải đang up
→ Kiểm tra `DATABASE_URL` (Docker: trong `docker-compose.override.yml`/`docker-compose.yml`; local dev: `backend/.env`)
→ Nếu DB vẫn còn tên cũ (`echoes_db`/`echoes_user`) — chưa chạy migration rename. Xem section "Database → Rebrand từ echoes_user/echoes_db".

### OCR không hoạt động
→ Kiểm tra GOOGLE_API_KEY trong `backend/.env`
→ Model: gemini-2.5-flash (gemini-2.0-flash bị limit=0 trên project mới)

### wuwa-toolkit.local không resolve
→ Trên VM/laptop chính: `systemctl is-active avahi-daemon` (phải active), `hostname` (phải là `wuwa-toolkit`). Nếu sai: `sudo hostnamectl set-hostname wuwa-toolkit && sudo systemctl restart avahi-daemon`.
→ Từ PC LAN khác (mạng Ethernet): nếu ping IP `192.168.1.12` work nhưng `ping wuwa-toolkit.local` fail → modem đang chặn mDNS multicast. Dùng hosts file workaround — xem section "Domain nội bộ → mDNS không work giữa LAN clients".

### Frontend không gọi được API (local)
→ Kiểm tra vite.config.ts: proxy /api → http://localhost:8001
→ Kiểm tra backend đang chạy port 8001
