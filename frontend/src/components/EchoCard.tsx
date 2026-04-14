import { Trash2, User } from 'lucide-react'
import type { Echo } from '../types/echo'
import { getTierLabel, getTierClass } from '../utils/tier'

const ELEMENT_COLORS: Record<string, string> = {
  Glacio: 'text-element-Glacio', Fusion: 'text-element-Fusion',
  Electro: 'text-element-Electro', Aero: 'text-element-Aero',
  Spectro: 'text-element-Spectro', Havoc: 'text-element-Havoc',
}

interface Props {
  echo: Echo
  onDelete: (id: string) => void
}

export default function EchoCard({ echo, onDelete }: Props) {
  const label = echo.score_percent != null ? getTierLabel(echo.score_percent) : null
  const tierClass = label ? getTierClass(label) : 'border-ww-border text-ww-muted'
  const elemClass = echo.echo_element ? (ELEMENT_COLORS[echo.echo_element] ?? '') : ''

  return (
    <div className="card hover:border-ww-accent/40 transition-colors group relative">
      {/* Tier badge */}
      {label && (
        <div className={`absolute top-3 right-3 px-2 py-0.5 rounded-lg border text-[10px] font-bold max-w-[90px] text-center leading-tight ${tierClass}`}>
          {label}
        </div>
      )}

      {/* Header */}
      <div className="pr-24">
        <h4 className="font-semibold text-ww-text">{echo.echo_name}</h4>
        <div className="flex items-center gap-2 mt-0.5">
          {echo.echo_element && (
            <span className={`text-xs font-medium ${elemClass}`}>{echo.echo_element}</span>
          )}
          {echo.echo_set && (
            <span className="text-xs text-ww-muted">{echo.echo_set}</span>
          )}
          <span className="text-xs text-ww-muted">{echo.echo_cost}-cost</span>
        </div>
      </div>

      {/* Character */}
      {echo.character && (
        <div className="flex items-center gap-1.5 mt-2">
          <User className="w-3 h-3 text-ww-muted" />
          <span className="text-xs text-ww-muted">{echo.character.name}</span>
        </div>
      )}

      {/* Sub stats */}
      <div className="mt-3 space-y-1 overflow-visible">
        {echo.sub_stats.slice(0, 5).map((s, i) => (
          <div key={i} className="flex justify-between text-xs">
            <span className="text-ww-muted">{s.type}</span>
            <span className="text-ww-text font-medium">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Score */}
      {echo.score_percent != null && (
        <div className="mt-3 pt-3 border-t border-ww-border flex items-center justify-between">
          <span className="text-xs text-ww-muted">Score</span>
          <span className={`text-sm font-bold ${tierClass.split(' ').find(c => c.startsWith('text-')) ?? ''}`}>
            {echo.score_percent.toFixed(3)}
          </span>
        </div>
      )}

      {/* Delete */}
      <button
        onClick={() => onDelete(echo.id)}
        className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-ww-muted hover:text-red-400"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {/* Date */}
      <p className="text-xs text-ww-muted mt-2">
        {new Date(echo.created_at).toLocaleDateString()}
      </p>
    </div>
  )
}
