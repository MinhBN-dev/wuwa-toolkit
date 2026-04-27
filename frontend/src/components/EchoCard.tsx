import { Trash2 } from 'lucide-react'
import type { Echo } from '../types/echo'
import { getTierLabel, getTierClass, getBarColor } from '../utils/tier'

const CRIT_STATS = new Set(['Crit Rate', 'Crit DMG'])
const ER_STAT = 'ER%'

const ELEMENT_COLOR: Record<string, string> = {
  Glacio:  '#7dd3fc',
  Fusion:  '#f97316',
  Electro: '#a855f7',
  Aero:    '#34d399',
  Spectro: '#facc15',
  Havoc:   '#e879f9',
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
  const elemColor  = echo.echo_element ? (ELEMENT_COLOR[echo.echo_element] ?? '#67e8f9') : '#67e8f9'

  const stats = echo.sub_stats.slice(0, 5)
  const padded: (typeof stats[0] | null)[] = [
    ...stats,
    ...Array(Math.max(0, 5 - stats.length)).fill(null),
  ]

  return (
    <div
      className="relative flex flex-col rounded-lg overflow-hidden group transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: 'linear-gradient(135deg, rgba(28,34,48,0.7) 0%, rgba(22,27,34,0.55) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = `0 8px 24px ${elemColor}33, 0 0 0 1px ${elemColor}55`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)'
      }}
    >
      {/* Tier accent strip */}
      <div className={`h-0.5 w-full shrink-0 ${barColor}`} style={{ boxShadow: `0 0 8px currentColor` }} />

      <div className="flex flex-col flex-1 p-3.5 gap-2.5">
        {/* Name + cost badge */}
        <div className="flex items-start justify-between gap-2 min-h-[2.5rem]">
          <h4 className="font-display font-semibold text-sm text-ww-text leading-snug line-clamp-2 flex-1 min-w-0 tracking-wide">
            {echo.echo_name}
          </h4>
          <span
            className="shrink-0 readout text-[10px] font-bold border rounded px-1.5 py-0.5 leading-none mt-0.5"
            style={{ borderColor: `${elemColor}55`, color: elemColor, background: `${elemColor}10` }}
          >
            {echo.echo_cost}◆
          </span>
        </div>

        {/* Meta chips */}
        <div className="flex flex-wrap items-center gap-1.5 min-h-[1.5rem]">
          {echo.echo_element && (
            <span
              className="text-[10px] font-display uppercase tracking-wider px-1.5 py-0.5 rounded border leading-none"
              style={{
                background: `${elemColor}15`,
                borderColor: `${elemColor}40`,
                color: elemColor,
              }}
            >
              {echo.echo_element}
            </span>
          )}
          {echo.character && (
            <span className="inline-flex items-center gap-1 text-[10px] font-display uppercase tracking-wider text-ww-accent bg-ww-accent/10 border border-ww-accent/25 rounded-full px-2 py-0.5 leading-none">
              <span className="w-1 h-1 rounded-full bg-ww-accent shrink-0" style={{ boxShadow: '0 0 4px #e8a045' }} />
              {echo.character.name}
            </span>
          )}
        </div>

        {/* Score block */}
        <div
          className="rounded-md border px-3 py-2.5 h-[4.5rem] flex flex-col justify-between"
          style={{
            background: 'rgba(7,9,18,0.5)',
            borderColor: label ? `${elemColor}30` : 'rgba(42,49,66,0.6)',
          }}
        >
          {echo.score_percent != null ? (
            <>
              <div className="flex items-baseline justify-between gap-1">
                <span className={`readout text-2xl font-bold leading-none ${tierText}`}>
                  {echo.score_percent.toFixed(1)}
                </span>
                <span className={`text-[9px] font-display uppercase tracking-wider leading-none ${tierText} opacity-80`}>
                  {label}
                </span>
              </div>
              <div className="h-1 bg-ww-bg-deep/80 rounded-full overflow-hidden mt-1.5">
                <div
                  className={`h-full rounded-full ${barColor}`}
                  style={{
                    width: `${Math.min(echo.score_percent, 100)}%`,
                    boxShadow: '0 0 6px currentColor',
                  }}
                />
              </div>
            </>
          ) : (
            <span className="text-xs text-ww-muted m-auto font-display uppercase tracking-wider">Not scored</span>
          )}
        </div>

        {/* Sub-stats */}
        <div className="space-y-1">
          {padded.map((s, i) =>
            s ? (
              <div key={i} className="flex items-center gap-2">
                <span className={`w-1 h-1 rounded-full shrink-0 ${
                  CRIT_STATS.has(s.type) ? barColor : s.type === ER_STAT ? 'bg-ww-purple' : 'bg-ww-border-glow'
                }`} />
                <span className={`flex-1 text-[11px] truncate ${
                  CRIT_STATS.has(s.type) ? 'text-ww-text font-medium' : 'text-ww-muted'
                }`}>
                  {s.type}
                </span>
                <span className={`readout text-[11px] shrink-0 ${
                  CRIT_STATS.has(s.type) ? tierText : s.type === ER_STAT ? 'text-ww-purple' : 'text-ww-text'
                }`}>
                  {s.value}
                </span>
              </div>
            ) : (
              <div key={i} className="h-[1rem]" />
            )
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-dashed border-ww-border/60 mt-auto">
          <span className="text-[10px] font-display uppercase tracking-wider text-ww-muted/60">
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
