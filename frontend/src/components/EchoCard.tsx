import { Trash2 } from 'lucide-react'
import type { Echo } from '../types/echo'
import { getTierLabel, getTierClass, getBarColor } from '../utils/tier'

// Stats that get tier-color highlight (most impactful for most chars)
const CRIT_STATS = new Set(['Crit Rate', 'Crit DMG'])
const ER_STAT = 'ER%'

const ELEMENT_BG: Record<string, string> = {
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
  const label    = echo.score_percent != null ? getTierLabel(echo.score_percent) : null
  const tierCls  = label ? getTierClass(label) : 'border-ww-border text-ww-muted'
  const barColor = echo.score_percent != null ? getBarColor(echo.score_percent) : 'bg-ww-border'
  // extract just the text- and border- tokens for reuse
  const tierText   = tierCls.split(' ').find(c => c.startsWith('text-'))   ?? 'text-ww-muted'
  const tierBorder = tierCls.split(' ').find(c => c.startsWith('border-')) ?? 'border-ww-border'
  const elemCls = echo.echo_element ? (ELEMENT_BG[echo.echo_element] ?? '') : ''

  return (
    <div className="relative flex flex-col rounded-xl border border-ww-border bg-ww-surface overflow-hidden group transition-all duration-200 hover:border-ww-accent/40 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5">

      {/* ── Tier accent strip ─────────────────────────────────── */}
      <div className={`h-1 w-full shrink-0 ${barColor}`} />

      <div className="flex flex-col flex-1 p-4 gap-3">

        {/* ── Header: name + cost ──────────────────────────────── */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-sm text-ww-text leading-snug flex-1 min-w-0">
            {echo.echo_name}
          </h4>
          <span className="shrink-0 text-[10px] font-bold text-ww-muted border border-ww-border rounded px-1.5 py-0.5 leading-none">
            {echo.echo_cost}✦
          </span>
        </div>

        {/* ── Meta: element + character ────────────────────────── */}
        <div className="flex flex-wrap items-center gap-1.5">
          {echo.echo_element && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border leading-none ${elemCls}`}>
              {echo.echo_element}
            </span>
          )}
          {echo.character && (
            <span className="text-[10px] text-ww-muted border border-ww-border/60 rounded px-1.5 py-0.5 leading-none">
              {echo.character.name}
            </span>
          )}
        </div>

        {/* ── Score block ──────────────────────────────────────── */}
        {echo.score_percent != null ? (
          <div className={`rounded-lg border px-3 py-2.5 ${tierBorder} bg-ww-bg/50`}>
            <div className="flex items-end justify-between mb-2">
              <span className={`text-3xl font-black leading-none tabular-nums ${tierText}`}>
                {echo.score_percent.toFixed(1)}
              </span>
              <span className={`text-[10px] font-bold leading-none ${tierText} opacity-80`}>
                / 100
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 bg-ww-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${Math.min(echo.score_percent, 100)}%` }}
              />
            </div>
            {/* Tier label */}
            {label && (
              <p className={`text-[10px] font-semibold mt-1.5 ${tierText} opacity-70`}>
                {label}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-ww-border px-3 py-2 text-xs text-ww-muted text-center">
            Not scored
          </div>
        )}

        {/* ── Sub-stats ────────────────────────────────────────── */}
        <div className="space-y-1.5 flex-1">
          {echo.sub_stats.slice(0, 5).map((s, i) => {
            const isCrit = CRIT_STATS.has(s.type)
            const isER   = s.type === ER_STAT
            return (
              <div key={i} className="flex items-center justify-between gap-2">
                {/* Dot indicator */}
                <span className={`w-1 h-1 rounded-full shrink-0 ${
                  isCrit ? barColor : isER ? 'bg-purple-400' : 'bg-ww-border'
                }`} />
                <span className={`flex-1 text-xs truncate ${
                  isCrit ? 'text-ww-text font-medium' : 'text-ww-muted'
                }`}>
                  {s.type}
                </span>
                <span className={`text-xs font-semibold tabular-nums shrink-0 ${
                  isCrit ? tierText : isER ? 'text-purple-300' : 'text-ww-text'
                }`}>
                  {s.value}
                </span>
              </div>
            )
          })}
        </div>

        {/* ── Footer: date + delete ────────────────────────────── */}
        <div className="flex items-center justify-between pt-2 border-t border-ww-border/60">
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
