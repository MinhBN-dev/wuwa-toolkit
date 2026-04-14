# Echoes Optimizer — Frontend

## File Map

```
frontend/
├── index.html
├── vite.config.ts       Proxy /api → localhost:8001
├── tailwind.config.ts   Custom colors: ww-*, tier-*, element-*
├── tsconfig.json
├── package.json
└── src/
    ├── main.tsx         QueryClientProvider, Toaster, StrictMode
    ├── App.tsx          BrowserRouter, Header nav, Routes
    ├── index.css        Tailwind + custom component classes
    ├── types/
    │   └── echo.ts      TypeScript interfaces: Echo, SubStat, Character, ScoreResponse, etc.
    ├── services/
    │   └── api.ts       axios wrapper: getCharacters, getEchoes, createEcho, extractEchoStats, calculateScore, deleteEcho
    ├── components/
    │   ├── EchoUploader.tsx  Drag-and-drop image upload → calls OCR API
    │   ├── StatsEditor.tsx   Edit echo info + sub-stats with roll quality bars
    │   ├── ScoreDisplay.tsx  Score result: tier badge, percent bar, stat breakdown
    │   └── EchoCard.tsx      Grid card for saved echo (name, stats, tier, delete)
    └── pages/
        ├── Home.tsx     Main page: upload + edit + calculate + save
        └── Saved.tsx    Gallery: filter by character/tier/search, delete echoes
```

## Routes
- `/`       → Home (Analyze tab)
- `/saved`  → Saved Echoes gallery

## Colors (Tailwind custom)

### Background / Surface
- `bg-ww-bg`: #0d1117 (main background)
- `bg-ww-surface`: #161b22 (cards)
- `border-ww-border`: #30363d
- `text-ww-accent`: #e8a045 (gold)
- `text-ww-muted`: #8b949e

### Tiers
- `text-tier-S`: orange (#ff9500)
- `text-tier-A`: purple (#c084fc)
- `text-tier-B`: blue (#60a5fa)
- `text-tier-C`: green (#4ade80)
- `text-tier-D`: slate (#94a3b8)

### Elements
- Glacio: sky blue, Fusion: orange, Electro: purple
- Aero: emerald, Spectro: yellow, Havoc: fuchsia

## Component Classes (index.css)
- `.card` = bg-ww-surface + border + rounded + p-4
- `.btn-primary` = gold bg, black text
- `.btn-secondary` = border bg, white text
- `.input` / `.select` = dark bg, border, focus accent

## Key State (Home.tsx)
- `echoInfo`: {echo_name, echo_set, echo_element, echo_cost, main_stat_type, main_stat_value}
- `subStats`: SubStat[] (max 5)
- `selectedChar`: Character | null
- `totalER`: number (default 100)
- `scoreResult`: ScoreResponse | null (after Calculate)

## API Calls
All via `src/services/api.ts` → baseURL `/api/v1` (proxied to :8001)
- OCR timeout: 90s (vision AI can be slow)
- Default timeout: 60s
