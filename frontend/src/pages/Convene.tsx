import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Dices, Download, Trash2, Star, AlertTriangle, Terminal, Copy, Check,
  Sword, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react'
import { getCharacterIcon, getWeaponIcon, getWeaponSlug } from '../utils/character'
import { formatGameTime, formatGameDate, formatLocalTime } from '../utils/time'
import { toast } from 'sonner'
import {
  importConveneHistory,
  getConvenePlayers,
  getConveneStats,
  getConveneHistory,
  deleteConvenePlayer,
} from '../services/api'
import type { ConvenePoolStats } from '../types/echo'

/** Color for the item-name text in the history table — matches the screenshot
 *  convention (5★ amber, 4★ violet). */
const RARITY_NAME_COLOR: Record<number, string> = {
  5: 'text-amber-300',
  4: 'text-violet-300',
  3: 'text-sky-300',
}

/** Tiny circular thumb used inside the Item Name cell. Resonator → portrait
 *  from /characters/, Weapon → portrait from /weapons/, fallback to sword
 *  chip on load failure (and notify parent of missing icon). */
function HistoryThumb({
  name, itemType, rarity, onIconMissing,
}: {
  name: string
  itemType: string
  rarity: number
  onIconMissing?: (name: string, type: 'resonator' | 'weapon') => void
}) {
  const isResonator = itemType.toLowerCase().includes('resonator')
  const [errored, setErrored] = useState(false)
  const ringColor =
    rarity === 5 ? 'border-amber-400/70' :
    rarity === 4 ? 'border-violet-400/60' :
                   'border-sky-400/50'
  const iconSrc = isResonator ? getCharacterIcon(name) : getWeaponIcon(name)

  if (!errored) {
    return (
      <img
        src={iconSrc}
        alt={name}
        onError={() => {
          setErrored(true)
          onIconMissing?.(name, isResonator ? 'resonator' : 'weapon')
        }}
        className={`w-9 h-9 rounded-full object-cover border-2 bg-ww-bg-deep ${ringColor}`}
      />
    )
  }
  return (
    <div className={`w-9 h-9 rounded-full border-2 bg-violet-400/15 flex items-center justify-center text-violet-300 ${ringColor}`}>
      <Sword className="w-4 h-4" />
    </div>
  )
}

const HARD_PITY_5: Record<number, number> = {
  // Soft hint for the pity bar. Wuwa hard pity for 5★ is 80 on character/weapon banners.
  1: 80, 2: 80, 3: 80, 4: 80, 5: 50, 6: 1, 7: 80,
}

interface PoolMeta {
  short: string
  tint: string
}

const POOL_META: Record<number, PoolMeta> = {
  1: { short: 'Featured Resonator',  tint: 'text-amber-300 border-amber-400/50 bg-amber-400/10' },
  2: { short: 'Featured Weapon',     tint: 'text-violet-300 border-violet-400/50 bg-violet-400/10' },
  3: { short: 'Standard Resonator',  tint: 'text-ww-cyan border-ww-cyan/50 bg-ww-cyan/10' },
  4: { short: 'Standard Weapon',     tint: 'text-sky-300 border-sky-400/50 bg-sky-400/10' },
}

/** Pools we render UI for. Pools 5/6/7 (beginner variants) are skipped — most
 *  accounts have 0 pulls there and the API returns no records anyway. */
const VISIBLE_POOL_TYPES = [1, 2, 3, 4] as const

/** Pity badge color — yellow when pulled before pity 50 (got lucky), red when
 *  closer to / at hard pity. Matches the wuwatracker convention. */
function pityBadgeClass(pity: number): string {
  if (pity <= 50) return 'bg-amber-400 text-black'
  return 'bg-rose-600 text-white'
}

/** A 5★ pull rendered as a circular portrait. Resonators pull from
 *  /characters/{slug}.webp, weapons from /weapons/{slug}.webp. If the weapon
 *  icon fails to load, we fall back to a sword chip AND notify the parent so
 *  it can prompt the user to add the missing file. */
function FiveStarPortrait({
  name, itemType, pity, time, onIconMissing,
}: {
  name: string
  itemType: string
  pity: number
  time: string
  onIconMissing?: (name: string, type: 'resonator' | 'weapon') => void
}) {
  const isResonator = itemType.toLowerCase().includes('resonator')
  const [errored, setErrored] = useState(false)
  const tooltip = `${name} · pity ${pity} · ${formatGameDate(time)}`
  const ringColor = isResonator ? 'border-amber-400/70' : 'border-sky-400/70'
  const glow = isResonator ? 'shadow-[0_0_10px_rgba(251,191,36,0.35)]' : 'shadow-[0_0_10px_rgba(125,211,252,0.30)]'
  const iconSrc = isResonator ? getCharacterIcon(name) : getWeaponIcon(name)

  return (
    <div className="relative shrink-0" title={tooltip}>
      {!errored ? (
        <img
          src={iconSrc}
          alt={name}
          onError={() => {
            setErrored(true)
            onIconMissing?.(name, isResonator ? 'resonator' : 'weapon')
          }}
          className={`w-14 h-14 rounded-full object-cover border-2 ${ringColor} ${glow} bg-ww-bg-deep`}
        />
      ) : (
        <div className="w-14 h-14 rounded-full border-2 border-violet-400/60 bg-violet-400/15 flex items-center justify-center text-violet-300">
          <Sword className="w-6 h-6" />
        </div>
      )}
      <span
        className={`absolute -bottom-0.5 -right-0.5 min-w-[22px] h-[22px] px-1 rounded-full
                    flex items-center justify-center text-[11px] font-bold font-display
                    border border-black/40 shadow-md ${pityBadgeClass(pity)}`}
      >
        {pity}
      </span>
    </div>
  )
}

const STORAGE_KEY = 'convene.last_player_id'

// PowerShell one-liner: downloads + executes the helper script from the same
// origin serving this page. Vite (dev) and nginx (prod) serve files in
// frontend/public/ at the site root, so `/get-convene-url.ps1` resolves.
function buildPsOneliner(origin: string): string {
  return `iex (irm '${origin}/get-convene-url.ps1')`
}

/** A label/value row used inside the pool summary panel. */
function StatRow({ label, value, valueClass = 'text-ww-text' }: {
  label: string; value: React.ReactNode; valueClass?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-ww-muted">{label}</span>
      <span className={`readout text-base ${valueClass}`}>{value}</span>
    </div>
  )
}

/** A label / value / progress-bar block used in the Luck Rating panel. */
function LuckStat({ label, value, fillPct, color = 'bg-amber-400' }: {
  label: string; value: string; fillPct: number; color?: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-ww-muted">{label}</span>
        <span className="readout text-base text-ww-text">{value}</span>
      </div>
      <div className="h-1 bg-ww-border/60 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${color}`}
          style={{ width: `${Math.max(0, Math.min(100, fillPct))}%` }}
        />
      </div>
    </div>
  )
}

function PoolCard({
  pool, onIconMissing,
}: {
  pool: ConvenePoolStats
  onIconMissing?: (name: string, type: 'resonator' | 'weapon') => void
}) {
  const [showAll, setShowAll] = useState(false)
  const hard = HARD_PITY_5[pool.pool_type] ?? 80
  const pityPct = Math.min(100, (pool.pity_5 / hard) * 100)
  const pityColor =
    pool.pity_5 >= hard - 5 ? 'bg-amber-400'
    : pool.pity_5 >= Math.floor(hard * 0.7) ? 'bg-violet-400'
    : 'bg-ww-cyan'

  const meta = POOL_META[pool.pool_type] ?? { short: pool.pool_label, tint: 'text-ww-cyan' }
  const empty = pool.total === 0

  return (
    <section className="panel-tech p-4 space-y-4">
      <header className="flex items-center justify-between gap-2 flex-wrap" title={pool.pool_label}>
        <div>
          <p className="section-label">Pool {pool.pool_type}</p>
          <h3 className="font-display uppercase tracking-wider text-ww-text text-sm leading-tight">{meta.short}</h3>
        </div>
        <div className="flex gap-3 text-xs font-display uppercase tracking-wider text-ww-muted">
          <span><span className="readout text-ww-text mr-1">{pool.total}</span> pulls</span>
          <span className="text-amber-300"><span className="readout mr-1">{pool.five_star_count}</span> 5★</span>
          <span className="text-violet-300"><span className="readout mr-1">{pool.four_star_count}</span> 4★</span>
        </div>
      </header>

      {empty ? (
        <p className="text-center py-8 text-ww-muted italic">
          No pulls in this pool yet — pull in-game and re-sync.
        </p>
      ) : (
      <>
      {/* Two-column summary: pool counts | 5★ luck rating */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded border border-ww-border bg-ww-bg-deep/40 p-4 space-y-2">
          <h4 className="font-display uppercase tracking-wider text-ww-text mb-2">{meta.short}</h4>
          <StatRow label="Total Pulls" value={pool.total.toLocaleString()} />
          <StatRow label="Total Astrites" value={pool.total_astrites.toLocaleString()} />
          <StatRow label="5★ Pulls" value={pool.five_star_count} valueClass="text-amber-300" />
          <StatRow label="4★ Pulls" value={pool.four_star_count} valueClass="text-violet-300" />
        </div>

        <div className="rounded border border-ww-border bg-ww-bg-deep/40 p-4 space-y-3">
          <h4 className="font-display uppercase tracking-wider text-ww-text mb-2">5★ Luck Rating</h4>
          {pool.avg_pity_5 != null ? (
            <LuckStat
              label="Average Pity"
              value={pool.avg_pity_5.toFixed(2)}
              fillPct={(pool.avg_pity_5 / hard) * 100}
            />
          ) : (
            <p className="text-xs text-ww-muted italic">No 5★ pulled yet.</p>
          )}
          {pool.pull_ratio != null && (
            <LuckStat
              label="Pull Ratio"
              value={`${pool.pull_ratio.toFixed(2)}%`}
              fillPct={pool.pull_ratio * 20}
            />
          )}
          {pool.win_rate_50_50 != null && (
            <LuckStat
              label="50/50 Wins"
              value={`${pool.win_rate_50_50.toFixed(2)}%`}
              fillPct={pool.win_rate_50_50}
            />
          )}
          {pool.pool_type === 1 && pool.win_rate_50_50 == null && pool.five_star_count > 0 && (
            <p className="text-xs text-ww-muted italic">
              Need a non-guaranteed 5★ to compute 50/50.
            </p>
          )}
        </div>
      </div>

      {/* Pity meter */}
      <div className="space-y-1">
        <div className="flex items-baseline justify-between text-xs font-display uppercase tracking-wider">
          <span className="text-ww-muted">Current Pity</span>
          <span>
            <span className={`readout text-lg ${pool.pity_5 >= hard - 5 ? 'text-amber-300' : 'text-ww-text'}`}>
              {pool.pity_5}
            </span>
            <span className="text-ww-muted"> / {hard}</span>
            {pool.avg_pity_5 != null && (
              <span className="text-ww-muted ml-3">avg {pool.avg_pity_5.toFixed(1)}</span>
            )}
          </span>
        </div>
        <div className="h-1.5 bg-ww-border/60 rounded-full overflow-hidden">
          <div className={`h-full transition-all ${pityColor}`} style={{ width: `${pityPct}%` }} />
        </div>
      </div>

      {/* Recent 5★ — horizontal portraits row, newest first */}
      {pool.five_stars.length === 0 ? (
        <p className="text-xs text-ww-muted italic">No 5★ pulled in this pool yet.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <p className="section-label flex items-center gap-1.5">
              <Star className="w-3 h-3 text-amber-300 fill-amber-300" />
              Recent 5★
            </p>
            {pool.five_stars.length > 14 && (
              <button
                onClick={() => setShowAll(s => !s)}
                className="text-[10px] text-ww-cyan hover:text-glow-cyan font-display uppercase tracking-wider"
              >
                {showAll ? 'Collapse' : `+${pool.five_stars.length - 14} more`}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2.5 pt-1">
            {(showAll ? pool.five_stars : pool.five_stars.slice(0, 14)).map(p => (
              <FiveStarPortrait
                key={p.pull_id}
                name={p.name}
                itemType={p.item_type}
                pity={p.pity ?? 0}
                time={p.time}
                onIconMissing={onIconMissing}
              />
            ))}
          </div>
        </div>
      )}
      </>
      )}
    </section>
  )
}

export default function ConvenePage() {
  const qc = useQueryClient()
  const [url, setUrl] = useState('')
  const [activePlayer, setActivePlayer] = useState<string>('')
  const [historyRarity, setHistoryRarity] = useState<number | ''>('')
  const [historyPage, setHistoryPage] = useState(0)
  const [historyPageSize, setHistoryPageSize] = useState(20)
  const [psCopied, setPsCopied] = useState(false)
  const [activePool, setActivePool] = useState<number | null>(null)
  const [missingIcons, setMissingIcons] = useState<{ name: string; type: 'resonator' | 'weapon' }[]>([])

  const reportIconMissing = useCallback((name: string, type: 'resonator' | 'weapon') => {
    setMissingIcons(prev => prev.some(i => i.name === name && i.type === type) ? prev : [...prev, { name, type }])
  }, [])

  const psOneliner = useMemo(
    () => buildPsOneliner(typeof window !== 'undefined' ? window.location.origin : ''),
    []
  )

  const copyPs = async () => {
    let ok = false
    // Modern API — only available on https:// or localhost
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(psOneliner)
        ok = true
      } catch { /* fall through to legacy */ }
    }
    // Legacy fallback — works on http:// in private LANs
    if (!ok) {
      const ta = document.createElement('textarea')
      ta.value = psOneliner
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      ta.setAttribute('readonly', '')
      document.body.appendChild(ta)
      ta.select()
      try { ok = document.execCommand('copy') } catch { ok = false }
      document.body.removeChild(ta)
    }
    if (ok) {
      setPsCopied(true)
      setTimeout(() => setPsCopied(false), 2000)
      toast.success('PowerShell command copied')
    } else {
      toast.error('Copy blocked — click the command box and copy manually')
    }
  }

  const { data: players = [] } = useQuery({
    queryKey: ['convene', 'players'],
    queryFn: getConvenePlayers,
  })

  // Hydrate active player from localStorage / first-available
  useEffect(() => {
    if (activePlayer || players.length === 0) return
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && players.some(p => p.player_id === stored)) {
      setActivePlayer(stored)
    } else {
      setActivePlayer(players[0].player_id)
    }
  }, [players, activePlayer])

  useEffect(() => {
    if (activePlayer) localStorage.setItem(STORAGE_KEY, activePlayer)
  }, [activePlayer])

  const { data: stats, isFetching: statsLoading } = useQuery({
    queryKey: ['convene', 'stats', activePlayer],
    queryFn: () => getConveneStats(activePlayer),
    enabled: !!activePlayer,
  })

  const { data: historyData } = useQuery({
    queryKey: ['convene', 'history', activePlayer, activePool, historyRarity, historyPage, historyPageSize],
    queryFn: () => getConveneHistory({
      player_id: activePlayer,
      pool_type: activePool ?? undefined,
      rarity: historyRarity === '' ? undefined : historyRarity,
      min_rarity: 4,                 // never include 3★ in history table
      skip: historyPage * historyPageSize,
      limit: historyPageSize,
    }),
    enabled: !!activePlayer && activePool != null,
  })
  const history = historyData?.items ?? []
  const historyTotal = historyData?.total ?? 0
  const historyMaxPage = Math.max(0, Math.ceil(historyTotal / historyPageSize) - 1)

  // Reset history to page 0 whenever the active pool / rarity / size changes
  useEffect(() => { setHistoryPage(0) }, [activePool, historyRarity, historyPageSize, activePlayer])

  const importMut = useMutation({
    mutationFn: importConveneHistory,
    onSuccess: (data) => {
      toast.success(
        data.total_added > 0
          ? `Synced ${data.total_added} new pulls (${data.total_fetched} fetched)`
          : `Up to date — no new pulls (${data.total_fetched} fetched)`
      )
      setActivePlayer(data.player_id)
      setUrl('')
      qc.invalidateQueries({ queryKey: ['convene'] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? err?.message ?? 'Import failed'
      toast.error(String(msg))
    },
  })

  const deleteMut = useMutation({
    mutationFn: deleteConvenePlayer,
    onSuccess: () => {
      toast.success('Player history deleted')
      setActivePlayer('')
      qc.invalidateQueries({ queryKey: ['convene'] })
    },
    onError: () => toast.error('Delete failed'),
  })

  const totalPulls = useMemo(
    () => stats?.pools.reduce((sum, p) => sum + p.total, 0) ?? 0,
    [stats]
  )

  const visiblePools = useMemo(
    () => stats?.pools.filter(p => (VISIBLE_POOL_TYPES as readonly number[]).includes(p.pool_type)) ?? [],
    [stats]
  )

  // Default the active tab to the first pool with data once stats loads / changes
  useEffect(() => {
    if (visiblePools.length === 0) return
    if (activePool == null || !visiblePools.some(p => p.pool_type === activePool)) {
      setActivePool(visiblePools[0].pool_type)
    }
  }, [visiblePools, activePool])

  const activePoolStats = visiblePools.find(p => p.pool_type === activePool) ?? null

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5 animate-fade-up">
      {/* Hero */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="section-label mb-1">Convene Tracker</p>
          <h1 className="font-display font-bold text-3xl uppercase tracking-[0.15em] text-ww-text flex items-center gap-3">
            <Dices className="w-7 h-7 text-ww-cyan" />
            <span>Pull <span className="text-ww-cyan text-glow-cyan">History</span></span>
          </h1>
        </div>
        {activePlayer && (
          <div className="flex items-center gap-2">
            <select
              className="select w-44"
              value={activePlayer}
              onChange={e => setActivePlayer(e.target.value)}
            >
              {players.map(p => (
                <option key={p.player_id} value={p.player_id}>UID {p.player_id}</option>
              ))}
            </select>
            <button
              onClick={() => {
                if (confirm(`Delete all pull history for UID ${activePlayer}?`)) {
                  deleteMut.mutate(activePlayer)
                }
              }}
              className="p-2 text-ww-muted hover:text-rose-400 transition-colors"
              title="Delete this player's history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Auto-extract URL via PowerShell */}
      <section className="panel-tech p-4 space-y-3">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <p className="section-label flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5" /> Auto-extract URL (Windows)
          </p>
          <p className="text-xs text-ww-muted">
            Open Convene → History in-game first, then run this in PowerShell
          </p>
        </div>
        <div className="flex gap-2 items-stretch">
          <code
            className="flex-1 flex items-center px-3 py-2 rounded bg-black/40 border border-ww-border font-mono text-xs text-ww-cyan overflow-x-auto whitespace-nowrap cursor-pointer select-all"
            onClick={(e) => {
              const range = document.createRange()
              range.selectNodeContents(e.currentTarget)
              const sel = window.getSelection()
              sel?.removeAllRanges()
              sel?.addRange(range)
            }}
            title="Click to select all, then Ctrl+C"
          >
            {psOneliner}
          </code>
          <button
            onClick={copyPs}
            className="btn-secondary inline-flex items-center gap-2 px-3"
            title="Copy to clipboard"
          >
            {psCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {psCopied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <ol className="text-[11px] text-ww-muted space-y-1 list-decimal pl-4">
          <li>Launch Wuthering Waves and open <span className="text-ww-text">Convene → History</span> (any banner).</li>
          <li>Open <span className="text-ww-text">Windows PowerShell</span> on that PC and paste the command above.</li>
          <li>Script auto-finds your install, reads <span className="text-ww-text">Client.log</span>, copies the URL to your clipboard.</li>
          <li>Paste the URL below and click <span className="text-ww-text">Sync</span>.</li>
        </ol>
      </section>

      {/* Manual URL paste + sync */}
      <section className="panel-tech p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="section-label">Sync URL</p>
          <p className="text-xs text-ww-muted">
            Or paste your <span className="text-ww-text">Convene → Export Records</span> URL directly
          </p>
        </div>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="https://aki-gm-resources-oversea.aki-game.net/aki/gacha/index.html#/record?…"
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
          <button
            className="btn-primary inline-flex items-center gap-2"
            disabled={!url.trim() || importMut.isPending}
            onClick={() => importMut.mutate(url.trim())}
          >
            <Download className="w-4 h-4" />
            {importMut.isPending ? 'Syncing…' : 'Sync'}
          </button>
        </div>
        <p className="text-[11px] text-ww-muted flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" />
          The token in the URL expires after a short time — re-extract when sync fails.
          Only new pulls are appended; safe to sync repeatedly.
        </p>
      </section>

      {!activePlayer ? (
        <div className="panel-tech text-center py-16">
          <div className="mx-auto w-12 h-12 mb-3 rounded-md border border-ww-cyan/40 bg-ww-cyan/5 flex items-center justify-center text-ww-cyan animate-pulse-glow">
            ◆
          </div>
          <p className="font-display uppercase tracking-[0.18em] text-ww-text">No history tracked yet</p>
          <p className="text-sm mt-1 text-ww-muted">Paste your export URL above to start tracking.</p>
        </div>
      ) : (
        <>
          {/* Player summary */}
          <div className="panel-tech px-4 py-3 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div>
                <p className="section-label">UID</p>
                <p className="readout text-lg text-ww-cyan">{activePlayer}</p>
              </div>
              <div>
                <p className="section-label">Total Pulls</p>
                <p className="readout text-lg text-ww-text">{totalPulls}</p>
              </div>
              <div>
                <p className="section-label">Last Synced</p>
                <p className="text-sm text-ww-text">{formatLocalTime(stats?.last_synced_at)}</p>
              </div>
            </div>
          </div>

          {/* Pool tabs + active pool detail */}
          {statsLoading && !stats ? (
            <div className="text-center py-16 text-ww-muted font-display uppercase tracking-wider">
              Loading…
            </div>
          ) : visiblePools.length === 0 ? (
            <p className="text-center py-8 text-ww-muted italic">No pulls in any pool yet.</p>
          ) : (
            <div className="space-y-3">
              {/* Tab strip */}
              <div className="flex flex-wrap gap-2 panel-tech p-2">
                {visiblePools.map(p => {
                  const meta = POOL_META[p.pool_type] ?? { short: p.pool_label, tint: 'text-ww-cyan' }
                  const active = p.pool_type === activePool
                  return (
                    <button
                      key={p.pool_type}
                      onClick={() => setActivePool(p.pool_type)}
                      className={`flex-1 min-w-[160px] px-3 py-2 rounded text-left transition-all border
                        ${active
                          ? `${meta.tint} shadow-glow-cyan`
                          : 'border-ww-border bg-ww-bg-deep/40 text-ww-muted hover:border-ww-cyan/40 hover:text-ww-text'}`}
                      title={p.pool_label}
                    >
                      <p className="font-display uppercase tracking-wider text-xs leading-tight truncate">
                        {meta.short}
                      </p>
                      <p className="mt-1 text-[10px] flex gap-2 font-display uppercase tracking-wider opacity-80">
                        <span><span className="readout">{p.total}</span> pulls</span>
                        <span className="text-amber-300"><span className="readout">{p.five_star_count}</span> 5★</span>
                        <span className="ml-auto">pity <span className="readout">{p.pity_5}</span></span>
                      </p>
                    </button>
                  )
                })}
              </div>

              {/* Missing weapon-icons banner — only shows for the active pool */}
              {(() => {
                if (!activePoolStats) return null
                // Names of weapons in the active pool's 5★ list AND in the
                // currently-loaded history page that we know are missing.
                const namesInPool = new Set<string>()
                for (const f of activePoolStats.five_stars) {
                  if (!f.item_type.toLowerCase().includes('resonator')) namesInPool.add(f.name)
                }
                for (const h of history) {
                  if (h.card_pool_type === activePool && !h.item_type.toLowerCase().includes('resonator')) {
                    namesInPool.add(h.name)
                  }
                }
                const missing = missingIcons.filter(m => m.type === 'weapon' && namesInPool.has(m.name))
                if (missing.length === 0) return null
                return (
                  <div className="panel-tech p-4 border-l-2 border-l-amber-400/60 bg-amber-400/5">
                    <p className="section-label flex items-center gap-1.5 text-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Missing weapon icons ({missing.length})
                    </p>
                    <p className="text-xs text-ww-muted mt-1.5 mb-2">
                      Drop the corresponding <span className="text-ww-text">.webp</span> files into{' '}
                      <code className="px-1 py-0.5 bg-black/40 rounded text-ww-cyan font-mono">frontend/public/weapons/</code>
                      {' '}and refresh the page.
                    </p>
                    <ul className="space-y-1 font-mono text-xs">
                      {missing.map(m => (
                        <li key={m.name} className="flex gap-2">
                          <span className="text-amber-300 min-w-[180px]">{m.name}</span>
                          <span className="text-ww-muted">→</span>
                          <span className="text-ww-text">{getWeaponSlug(m.name)}.webp</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })()}

              {/* Active pool detail (full width) */}
              {activePoolStats && <PoolCard pool={activePoolStats} onIconMissing={reportIconMissing} />}
            </div>
          )}

          {/* History — scoped to the active pool tab */}
          <section className="panel-tech p-4 space-y-3">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <p className="section-label">
                History — {POOL_META[activePool ?? 0]?.short ?? '—'}
              </p>
              <div className="flex gap-2">
                <select
                  className="select w-32 text-xs"
                  value={historyRarity}
                  onChange={e => setHistoryRarity(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">4★ + 5★</option>
                  <option value="5">5★ only</option>
                  <option value="4">4★ only</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-display uppercase tracking-wider text-ww-muted border-b border-ww-border">
                    <th className="text-left py-2 px-3 w-24">Pull No.</th>
                    <th className="text-left py-2 px-3">Item Name</th>
                    <th className="text-left py-2 px-3 w-20">Pity</th>
                    <th className="text-right py-2 px-3 w-56">Date Received (UTC+7)</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8 text-ww-muted italic">No pulls match.</td></tr>
                  ) : (
                    history.map(p => {
                      const pullNo = p.pull_no ?? ''   // server-computed 1-based chronological no.
                      const nameColor = RARITY_NAME_COLOR[p.quality_level] ?? 'text-ww-text'
                      return (
                        <tr key={`${p.card_pool_type}-${p.pull_id}`} className="border-b border-ww-border/40 hover:bg-ww-cyan/5">
                          <td className="py-2 px-3 text-ww-muted readout">{pullNo}</td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-3">
                              <HistoryThumb
                                name={p.name}
                                itemType={p.item_type}
                                rarity={p.quality_level}
                                onIconMissing={reportIconMissing}
                              />
                              <span className={`font-medium ${nameColor}`}>{p.name}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-ww-text readout">{p.pity ?? ''}</td>
                          <td className="py-2 px-3 text-right text-ww-muted whitespace-nowrap font-mono text-xs">
                            {formatGameTime(p.time)}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-ww-border/50">
              <div className="flex items-center gap-2 text-xs font-display uppercase tracking-wider text-ww-muted">
                <span>Items per page</span>
                <select
                  className="select w-20 text-xs"
                  value={historyPageSize}
                  onChange={e => setHistoryPageSize(Number(e.target.value))}
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>

              <div className="flex items-center gap-2 text-xs font-display uppercase tracking-wider">
                <span className="text-ww-muted">
                  {historyTotal === 0 ? '0 of 0' : (
                    <>
                      <span className="readout text-ww-text">
                        {historyPage * historyPageSize + 1}
                      </span>
                      –
                      <span className="readout text-ww-text">
                        {Math.min((historyPage + 1) * historyPageSize, historyTotal)}
                      </span>
                      {' '}of{' '}
                      <span className="readout text-ww-text">{historyTotal}</span>
                    </>
                  )}
                </span>
                <div className="flex gap-0.5 ml-1">
                  <button
                    className="p-1.5 rounded border border-ww-border text-ww-muted hover:text-ww-cyan hover:border-ww-cyan disabled:opacity-30 disabled:hover:text-ww-muted disabled:hover:border-ww-border"
                    onClick={() => setHistoryPage(0)}
                    disabled={historyPage === 0}
                  ><ChevronsLeft className="w-3.5 h-3.5" /></button>
                  <button
                    className="p-1.5 rounded border border-ww-border text-ww-muted hover:text-ww-cyan hover:border-ww-cyan disabled:opacity-30 disabled:hover:text-ww-muted disabled:hover:border-ww-border"
                    onClick={() => setHistoryPage(p => Math.max(0, p - 1))}
                    disabled={historyPage === 0}
                  ><ChevronLeft className="w-3.5 h-3.5" /></button>
                  <button
                    className="p-1.5 rounded border border-ww-border text-ww-muted hover:text-ww-cyan hover:border-ww-cyan disabled:opacity-30 disabled:hover:text-ww-muted disabled:hover:border-ww-border"
                    onClick={() => setHistoryPage(p => Math.min(historyMaxPage, p + 1))}
                    disabled={historyPage >= historyMaxPage}
                  ><ChevronRight className="w-3.5 h-3.5" /></button>
                  <button
                    className="p-1.5 rounded border border-ww-border text-ww-muted hover:text-ww-cyan hover:border-ww-cyan disabled:opacity-30 disabled:hover:text-ww-muted disabled:hover:border-ww-border"
                    onClick={() => setHistoryPage(historyMaxPage)}
                    disabled={historyPage >= historyMaxPage}
                  ><ChevronsRight className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
