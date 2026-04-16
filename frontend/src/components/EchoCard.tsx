import { Trash2 } from 'lucide-react'
import type { Echo } from '../types/echo'
import { getTierLabel, getTierClass, getBarColor } from '../utils/tier'

const CRIT_STATS = new Set(['Crit Rate', 'Crit DMG'])
const ER_STAT = 'ER%'

const ELEMENT_CHIP: Record<string, string> = {
  Glacio:  'bg-sky-500/15 border-sky-500/30 text-sky-300',
  Fusion:  'bg-orange-500/15 border-orange-500/30 text-orange-300',
  Electro: 'bg-purple-500/15 border-purple-500/30 text-purple-300',
  Aero:    'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
  Spectro: 'bg-yellow-400/15 border-yellow-400/30 text-yellow-200',
  Havoc:   'bg-rose-500/15 border-rose-500/30 text-rose-300',
}

interface Props {
  echo: Echo
  onDelete: (id: string) => void
}

export default function EchoCard({ echo, onDelete }: Props) {
  const label      = echo.score_percent != null ? getTierLabel(echo.score_percent) : null
  const tierCls    = label ? getTierClass(label) : 'border-ww-border text-ww-muted bg-ww-border/10'
  const barColor   = echo.score_percent != null ? getBarColor(echo.score_percent) : 'bg-ww-border'
  const tierText   = tierCls.split(' ').find(c => c.startsWith('text-'))   ?? 'text-ww-muted'
  const tierBorder = tierCls.split(' ').find(c => c.startsWith('border-')) ?? 'border-ww-border'
  const elemCls    = echo.echo_element ? (ELEMENT_CHIP[echo.echo_element] ?? '') : ''

  // Always show exactly 5 stat rows (pad with nulls so every card is same height)
  const stats = echo.sub_stats.slice(0, 5)
  const padded: (typeof stats[0] | null)[] = [
    ...stats,
    ...Array(Math.max(0, 5 - stats.length)).fill(null),
  ]

  return (
    <div className="relative flex flex-col rounded-xl border border-ww-border bg-ww-surface overflow-hidden group transition-all duration-200 hover:border-ww-accent/40 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5">

      {/* ── Tier accent strip ─────────────────────────────────── */}
      <div className={`h-1 w-full shrink-0 ${barColor}`} />

      <div className="flex flex-col flex-1 p-4 gap-2.5">

        {/* ── Name (fixed height = 2 lines) ────────────────────── */}
        <div className="flex items-start justify-between gap-2 min-h-[2.75rem]">
          <h4 className="font-semibold text-sm text-ww-text leading-snug line-clamp-2 flex-1 min-w-0">
            {echo.echo_name}
          </h4>
          <span className="shrink-0 text-[10px] font-bold text-ww-muted border border-ww-border rounded px-1.5 py-0.5 leading-none mt-0.5">
            {echo.echo_cost}✦
          </span>
        </div>

        {/* ── Meta chips (fixed height) ─────────────────────────── */}
        <div className="flex flex-wrap items-center gap-1.5 min-h-[1.5rem]">
          {echo.echo_element && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border leading-none ${elemCls}`}>
              {echo.echo_element}
            </span>
          )}
          {echo.character && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-ww-accent bg-ww-accent/10 border border-ww-accent/25 rounded-full px-2 py-0.5 leading-none">
              <span className="w-1 h-1 rounded-full bg-ww-accent shrink-0" />
              {echo.character.name}
            </span>
          )}
        </div>

        {/* ── Score block (fixed height) ────────────────────────── */}
        <div className={`rounded-lg border px-3 py-2.5 ${tierBorder} bg-ww-bg/50 h-[4.5rem] flex flex-col justify-between`}>
          {echo.score_percent != null ? (
            <>
              {/* Number + label on same row */}
              <div className="flex items-baseline justify-between gap-1">
                <span className={`text-2xl font-black leading-none tabular-nums ${tierText}`}>
                  {echo.score_percent.toFixed(1)}
                </span>
                <span className={`text-[10px] font-semibold leading-none ${tierText} opacity-75`}>
                  {label}
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-ww-border rounded-full overflow-hidden mt-1">
                <div
                  className={`h-full rounded-full ${barColor}`}
                  style={{ width: `${Math.min(echo.score_percent, 100)}%` }}
                />
              </div>
            </>
          ) : (
            <span className="text-xs text-ww-muted m-auto">Not scored</span>
          )}
        </div>

        {/* ── Sub-stats (always 5 rows, fixed height) ──────────── */}
        <div className="space-y-1.5">
          {padded.map((s, i) =>
            s ? (
              <div key={i} className="flex items-center gap-2">
                <span className={`w-1 h-1 rounded-full shrink-0 ${
                  CRIT_STATS.has(s.type) ? barColor : s.type === ER_STAT ? 'bg-purple-400' : 'bg-ww-border'
                }`} />
                <span className={`flex-1 text-xs truncate ${
                  CRIT_STATS.has(s.type) ? 'text-ww-text font-medium' : 'text-ww-muted'
                }`}>
                  {s.type}
                </span>
                <span className={`text-xs font-semibold tabular-nums shrink-0 ${
                  CRIT_STATS.has(s.type) ? tierText : s.type === ER_STAT ? 'text-purple-300' : 'text-ww-text'
                }`}>
                  {s.value}
                </span>
              </div>
            ) : (
              <div key={i} className="h-[1.125rem]" /> /* placeholder for empty slots */
            )
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-2 border-t border-ww-border/60 mt-auto">
          <span className="text-[10px] text-ww-muted/60">
            {new Date(echo.created_at).toLocaleDateString('vi-VN')}
          </span>
          <button
            onClick={() => onDelete(echo.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-ww-muted hover:text-red-400 p-0.5 rounded"
            title="Delete echo"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  )
}
