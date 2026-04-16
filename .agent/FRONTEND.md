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
    │   ├── EchoUploader.tsx   Drag-and-drop image upload → gọi OCR API
    │   ├── StatsEditor.tsx    Edit sub-stats với roll quality bars; prop `hideMeta` ẩn name/cost
    │   ├── ScoreDisplay.tsx   Score result: tier label box, percent bar, stat breakdown
    │   ├── EchoCard.tsx       Grid card cho saved echo (tier label badge, stats, delete)
    │   ├── ErInfo.tsx         Hiển thị ER Target + ER Importance khi chọn nhân vật
    │   ├── SaveEchoDialog.tsx Modal xác nhận trước khi lưu: name/cost/main stat editable, sub stats + score readonly
    │   └── EvcBanner.tsx      Banner vàng thông báo EVC update (localStorage + server ack)
    ├── utils/
    │   ├── tier.ts          TIER_THRESHOLDS, getTierLabel, getTierClass, getBarColor
    │   ├── echoHelpers.ts   snapToRoll, defaultSubStatsForChar (shared giữa Home + Set)
    │   └── character.ts     getBaseName, getCharacterSlug, getCharacterIcon, build status helpers
    └── pages/
        ├── Home.tsx         Upload + edit + calculate + save echo lẻ
        ├── Set.tsx          Full set 5 slots: OCR, paste target, score all, save/load set
        ├── Saved.tsx        Gallery echoes + saved sets: filter by EVC tier, delete
        └── Characters.tsx   Character grid: icon, element, build status (localStorage)
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
- `bg-ww-bg` #0d1117 | `bg-ww-surface` #161b22 | `border-ww-border` #30363d
- `text-ww-accent` #e8a045 (gold) | `text-ww-muted` #8b949e

### Tiers
- `text-tier-S` orange #ff9500 | `text-tier-A` purple #c084fc
- `text-tier-B` blue #60a5fa | `text-tier-C` green #4ade80 | `text-tier-D` slate #94a3b8

## Component Classes (index.css)
- `.card` = bg-ww-surface + border + rounded + p-4
- `.btn-primary` = gold bg, black text
- `.btn-secondary` = border bg, white text
- `.input` / `.select` = dark bg, border, focus accent
