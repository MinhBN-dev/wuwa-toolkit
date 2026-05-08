# Wuwa Toolkit — Frontend

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
    │   ├── echoHelpers.ts   snapToRoll, defaultSubStatsForChar (shared giữa Home + Set)
    │   ├── character.ts     getCharacterIcon/Slug + getWeaponIcon/Slug (slug = lowercase + spaces→hyphens; WuWa portraits at /characters/, weapon icons at /weapons/)
    │   └── time.ts          formatGameTime (treat naive WuWa pull time as UTC+8 → display UTC+7), formatLocalTime (treat naive server timestamp as UTC → UTC+7)
    ├── components/
    │   ├── Logo.tsx           `<img>` rendering `/logo.jpeg` (project logo, square, rounded)
    │   ├── EchoUploader.tsx   Drag-and-drop image upload → OCR API; uses .dropzone-frame, rotating diamond icon
    │   ├── StatsEditor.tsx    Edit sub-stats với panel-tech sections; weight badges + RollBar with tier-color glow
    │   ├── ScoreDisplay.tsx   Big tier-colored 5xl readout + glow shimmer bar + stat breakdown + dim/lit tier ladder
    │   ├── EchoCard.tsx       Saved-echo grid card — element-tinted cost badge, tier-glow accent strip, hover element halo
    │   ├── ErInfo.tsx         ER Target + ER Importance chip (Min/Norm/Vital/Max → muted/cyan/yellow/orange glow)
    │   ├── SaveEchoDialog.tsx panel-tech frosted modal, dashed-border dividers, tier-colored score chip
    │   └── EvcBanner.tsx      Backdrop-blur yellow banner with gradient hairlines, ack to localStorage + server
    └── pages/
        ├── Home.tsx         2-col layout — Resonator/upload | StatsEditor | Score readout. Element-colored char chip.
        ├── Set.tsx          Hero + control bar + aggregate score ABOVE 5 slots; dropzone gold glow on paste-target
        ├── Saved.tsx        Hero + total badge + tier-ladder filter chips with active glow; gallery grid of EchoCards
        ├── Characters.tsx   Hero + 4 stat tiles + portrait grid with conic-gradient element ring + status-colored border
        └── Convene.tsx      Auto-extract section (PS one-liner copies URL via Client.log) + manual paste → sync 4 visible pools; pool tabs (full-width) with 2-panel summary (Pool counts | 5★ Luck Rating with progress bars: avg pity, pull ratio, 50/50 win), pity meter, horizontal 5★ portrait row (amber pity ≤50, rose >50), missing-weapon-icon banner, and per-pool paginated history (Pull No., portrait + colored name, Pity, Date UTC+7). Helper script lives at `frontend/public/get-convene-url.ps1`.
```

## Routes
- `/`            → Home (Analyze)
- `/set`         → Full Set optimizer
- `/saved`       → Saved Echoes + Saved Sets
- `/characters`  → Character roster with build status tracking
- `/convene`     → Convene (gacha) history tracker — import via in-game export URL

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
| `ConveneImportResponse` | player_id, svr_id, pools[], total_added, total_fetched |
| `ConvenePoolStats` | pool_type, pool_label, total, 5★/4★ counts, pity_5, pity_4, avg_pity_5, five_stars[] |
| `ConveneStatsResponse` | player_id, last_synced_at, pools[] |
| `ConvenePullResponse` | pull_id, name, item_type, quality_level, time, pity? |
| `ConvenePlayerSummary` | player_id, total_pulls, last_pull_time |

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
importConveneHistory(url)    POST /convene/import          — paste export URL, append-only sync (timeout 90s)
getConvenePlayers()          GET /convene/players          — list synced UIDs
getConveneStats(player_id)   GET /convene/stats            — pity + 5★ per pool
getConveneHistory(params)    GET /convene/history          — paginated, filter pool/rarity
deleteConvenePlayer(uid)     DELETE /convene/players/{uid} — wipe a UID's history
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

## Design Language (per-page treatments)

Each page uses the same shared classes (panel-tech / section-label / readout / btn-*) but has its own visual signature:

| Page | Hero icon | Distinctive treatment |
|---|---|---|
| `/` Home | (none) | 2-col workspace; element-colored char chip top-right; big tier-colored score number with glow |
| `/set` Full Set | Layers | Aggregate score readout pinned ABOVE the 5 slots (at-a-glance); paste-target slot has gold halo |
| `/saved` Library | Library | Total-count cyan badge; tier-ladder filter chips light up active; EchoCard hover halo follows echo's element color |
| `/characters` Resonators | Users | 4 stat tiles (Total/Built/Building/Pending); portrait has conic-gradient element ring + status-colored circular border |

All four pages mount with `animate-fade-up`. Score reveals use `animate-count-in`. Empty states use `◆` glyph in a cyan ring with `animate-pulse-glow`.

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
