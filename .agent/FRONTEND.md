# Echoes Optimizer — Frontend

## File Map

```
frontend/
├── index.html
├── vite.config.ts       Proxy /api + /uploads → localhost:8001
├── tailwind.config.ts   Custom colors: ww-*, tier-*, element-*
├── nginx.conf           Production nginx config (served inside Docker container)
├── Dockerfile           Multi-stage: node build → nginx:alpine serve
├── package.json
└── src/
    ├── main.tsx         QueryClientProvider, Toaster, StrictMode
    ├── App.tsx          BrowserRouter, Header nav, EvcBanner, Routes
    ├── index.css        Tailwind + custom component classes (.card, .btn-*)
    ├── types/
    │   └── echo.ts      TypeScript interfaces (xem phần Types bên dưới)
    ├── services/
    │   └── api.ts       axios wrapper cho tất cả API calls
    ├── utils/
    │   ├── tier.ts          TIER_THRESHOLDS, getTierLabel, getTierClass, getBarColor
    │   └── echoHelpers.ts   snapToRoll, defaultSubStatsForChar (shared giữa Home + Set)
    ├── components/
    │   ├── Logo.tsx           SVG hexagonal "O" mark — gradient stroke + spinning diamond center
    │   ├── EchoUploader.tsx   Drag-and-drop image upload → gọi OCR API (uses .dropzone-frame)
    │   ├── StatsEditor.tsx    Edit sub-stats với roll quality bars; prop `hideMeta` ẩn name/cost
    │   ├── ScoreDisplay.tsx   Score result: big tier-colored number, glow bar, stat breakdown, tier ladder
    │   ├── EchoCard.tsx       Grid card cho saved echo (tier label badge, stats, delete)
    │   ├── ErInfo.tsx         Hiển thị ER Target + ER Importance khi chọn nhân vật
    │   ├── SaveEchoDialog.tsx Modal xác nhận trước khi lưu: name/cost/main stat editable, sub stats + score readonly
    │   └── EvcBanner.tsx      Banner vàng thông báo EVC update (localStorage + server ack)
    └── pages/
        ├── Home.tsx         Upload + edit + calculate + save echo lẻ
        ├── Set.tsx          Full set 5 slots: OCR, paste target, score all, save/load set
        ├── Saved.tsx        Gallery echoes + saved sets: filter by EVC tier, delete
        └── Characters.tsx   Character grid: icon, element, build status (server-synced)
```

## Routes
- `/`            → Home (Analyze)
- `/set`         → Full Set optimizer
- `/saved`       → Saved Echoes + Saved Sets
- `/characters`  → Character roster with build status tracking

## Types (echo.ts)

| Interface | Mô tả |
|---|---|
| `SubStat` | `{type, value}` |
| `Character` | id, name, element, weapon_type, role |
| `Echo` | Full echo record từ DB (không có `notes`, `image_path`, `echo_set` trong TS type) |
| `EchoCreate` | Payload save echo: `echo_name`, `echo_cost`, `echo_element?`, `main_stat_type?`, `main_stat_value?`, `sub_stats`, scoring fields |
| `OcrResult` | echo_name, echo_cost, **main_stat_type**, **main_stat_value**, sub_stats, ... |
| `EchoSetSlot` | Slot trong saved set: `echo_id?`, echo_name, sub_stats, score, tier_label |
| `EchoSetSaveRequest` | Payload save set |
| `SavedEchoSet` | Set record từ DB |
| `ScoreResponse` | score, score_percent, tier, tier_label, breakdown, max_possible |
| `GameData` | echo_sets, sub_stat_types, character_weights, character_er, sub_stat_rolls |
| `CharacterEr` | er_target, er_imp, er_imp_label |
| `CharacterProfile` | character_name, build_status, notes |
| `CharacterProfileUpsert` | build_status, notes? |

## API Calls (api.ts)

```
getCharacters()              GET /characters
getGameData()                GET /characters/game-data
getEchoes(params?)           GET /echoes
findOrCreateEcho(data)       POST /echoes/find-or-create  — dedup (dùng khi save)
deleteEcho(id)               DELETE /echoes/{id}
extractEchoStats(file)       POST /ocr/extract     — timeout 90s
calculateScore(data)         POST /score/calculate
calculateSetScore(data)      POST /score/calculate-set  — EVC full mode, dùng cho Set page
getEchoSets()                GET /sets
saveEchoSet(data)            POST /sets
deleteEchoSet(id)            DELETE /sets/{id}
getEvcStatus()               GET /evc-status
acknowledgeEvcUpdate(date)   POST /evc-status/acknowledge
getCharacterProfiles()       GET /character-profiles         — tất cả build status + notes
upsertCharacterProfile(n,d)  PUT /character-profiles/{name}  — save 1 char
bulkUpsertCharacterProfiles  POST /character-profiles/bulk   — one-time localStorage migration
```
**Đã xóa:** `createEcho`, `updateEcho`, `getEcho` — không có component nào gọi

## Tier System (utils/tier.ts)

EVC labels thay thế S/A/B/C/D:
```
≥ 99 → Godly           (màu tier-S)
≥ 88 → Extreme         (màu tier-S)
≥ 77 → High Investment (màu tier-A)
≥ 66 → Well Built      (màu tier-B)
≥ 55 → Decent          (màu tier-B)
≥ 44 → Base Level      (màu tier-C)
<  44 → Unbuilt         (màu tier-D)
```
`getBarColor(score)` dùng label mapping qua `TIER_BAR_COLOR` — nhất quán với `getTierClass()`

## EvcBanner (components/EvcBanner.tsx)

- Query `evc-status` với `staleTime: Infinity` — chỉ fetch 1 lần/session
- Ẩn nếu: `!data.has_update` OR `localStorage[evc_acknowledged_date] >= latest_date`
- Acknowledge: gọi API + set localStorage → tất cả browser không hiện lại

## Set Page Key State (pages/Set.tsx)

```typescript
slots: SlotState[5]         // mỗi slot: echoName, echoCost, mainStatType, mainStatValue, subStats, scoreResult
selectedChar: Character | null
totalER: string
pasteTarget: number         // index slot sẽ nhận paste (Crosshair icon)
saveName: string
```

- **Paste**: clipboard → slot tại `pasteTarget` → auto advance `(pasteTarget+1)%5`
- **Score all**: `handleCalculateAll` → `calculateSetScore` (1 call duy nhất, EVC full-mode) → cập nhật scoreResult từng slot
- **Save set**: `findOrCreateEcho` mỗi slot → lấy `echo_id` → `saveEchoSet` với slots có `echo_id`
- **Load set**: fill slots từ saved data, set character + totalER

## Colors (Tailwind custom)

### Background / Surface
- `bg-ww-bg-deep` #070912 | `bg-ww-bg` #0a0e1a | `bg-ww-surface` #161b22 | `bg-ww-surface-2` #1c2230
- `border-ww-border` #2a3142 | `border-ww-border-glow` #3a4256
- `text-ww-text` #e6e8ee | `text-ww-muted` #8b949e

### Accents
- `text-ww-accent` #e8a045 (gold) | `text-ww-cyan` #67e8f9 | `text-ww-purple` #a78bfa

### Tiers
- `text-tier-S` orange #ff9500 | `text-tier-A` purple #c084fc
- `text-tier-B` blue #60a5fa | `text-tier-C` green #4ade80 | `text-tier-D` slate #94a3b8

### Element (Glacio/Fusion/Electro/Aero/Spectro/Havoc)
Defined in `tailwind.config.ts`; also inlined in Home.tsx for runtime tag styling.

## Component Classes (index.css)

Design system: **WuWa-inspired tech-arcane** — dark navy base, glassmorphism panels, cyan-purple-gold accents, Rajdhani display font + Inter body.

- `.glass` / `.glass-strong` — frosted-glass panels (backdrop-blur + subtle border + shadow)
- `.panel-tech` — `.glass` + diagonal corner cuts (clip-path) + cyan corner ticks (::before/::after)
- `.section-label` — small caps cyan headings with leading hairline accent
- `.btn-primary` — gold gradient with diagonal slant clip-path + gold glow
- `.btn-secondary` — bordered, hover-glow cyan, slant clip-path
- `.btn-icon` — small square reset/utility button
- `.btn-danger` — dark-red bordered (used in dialogs)
- `.input` / `.select` — dark bg, focus glow cyan, Rajdhani font
- `.dropzone-frame` / `.dropzone-active` — dashed gradient border with hover/active glow
- `.readout` — Rajdhani tabular-nums for stat numbers
- `.shimmer-line` — animated cyan gradient sweep (used on score bar)
- `.text-glow-cyan` / `.text-glow-gold` — text-shadow utilities
- `.above-stars` — z-index helper to sit above body::before starfield overlay
- Animations: `animate-fade-up`, `animate-count-in`, `animate-pulse-glow`, `animate-shimmer`, `animate-spin-slow`

Fonts loaded via Google Fonts in `index.html`: Rajdhani (400/500/600/700) + Inter (400/500/600).
