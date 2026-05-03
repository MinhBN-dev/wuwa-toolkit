# Echoes Optimizer — Agent Index

Đọc file này TRƯỚC KHI browse code. Mục đích: routing đến đúng file cần đọc, tránh tốn context.

## Routing

| Topic | Đọc file |
|---|---|
| Backend models, routes, schemas, file map | `.agent/BACKEND.md` |
| Scoring algorithm (single + full-set), tier thresholds | `.agent/BACKEND.md` |
| OCR pipeline, providers, fallback chain | `.agent/BACKEND.md` |
| Echo deduplication (find-or-create), EVC status | `.agent/BACKEND.md` |
| Game data structures (`CHARACTER_DATA`, `SUBSTAT_MEDIANS`, ...) | `.agent/BACKEND.md` |
| Backend ↔ Frontend data flow, API call timing | `.agent/BACKEND.md` |
| Frontend pages, components, types, API client | `.agent/FRONTEND.md` |
| Tier UI / colors / `tier.ts` | `.agent/FRONTEND.md` |
| EvcBanner, Set page state, Saved page filtering | `.agent/FRONTEND.md` |
| Convene tracker (gacha import, pity, history) | `.agent/BACKEND.md` (router/service) + `.agent/FRONTEND.md` (page) |
| Docker compose, override, networks, volumes | `.agent/DEVOPS.md` |
| Local dev commands, env files, psql, reset tables | `.agent/DEVOPS.md` |
| Production URL (`echoes.local`), Avahi mDNS | `.agent/DEVOPS.md` |
| Common issues troubleshooting | `.agent/DEVOPS.md` |

## Conventions cheat-sheet (đã có trong CLAUDE.md auto-load — không lặp ở đây)

CLAUDE.md là always-loaded; chứa development commands + key conventions. Đọc file này (INDEX.md) khi cần đi sâu hơn vào 1 area cụ thể.
