import type { CharacterEr } from '../types/echo'

const IMP_COLORS: Record<string, string> = {
  Min:   'text-ww-muted   bg-ww-border/60        border-ww-border',
  Norm:  'text-blue-300   bg-blue-500/10         border-blue-500/30',
  Vital: 'text-yellow-300 bg-yellow-500/10       border-yellow-500/30',
  Max:   'text-tier-S     bg-tier-S/10           border-tier-S/40',
}

interface Props {
  er: CharacterEr
  totalER?: string   // current user input, to compare against target
}

export default function ErInfo({ er, totalER }: Props) {
  const current = parseFloat(totalER ?? '')
  const diff = !isNaN(current) ? current - er.er_target : null
  const impClass = IMP_COLORS[er.er_imp_label] ?? IMP_COLORS.Min

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* ER Target */}
      <div className="flex items-center gap-1 text-xs">
        <span className="text-ww-muted">ER Target:</span>
        <span className="font-semibold text-ww-text">{er.er_target}%</span>
        {diff !== null && (
          <span className={`font-mono text-[11px] ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ({diff >= 0 ? '+' : ''}{diff.toFixed(1)})
          </span>
        )}
      </div>

      {/* ER Importance */}
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${impClass}`}>
        {er.er_imp_label}
      </span>
    </div>
  )
}
