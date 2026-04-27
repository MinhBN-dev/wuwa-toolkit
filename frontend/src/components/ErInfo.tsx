import type { CharacterEr } from '../types/echo'

const IMP_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  Min:   { color: '#8b949e', bg: 'rgba(139,148,158,0.1)', border: 'rgba(139,148,158,0.35)' },
  Norm:  { color: '#67e8f9', bg: 'rgba(103,232,249,0.1)', border: 'rgba(103,232,249,0.35)' },
  Vital: { color: '#facc15', bg: 'rgba(250,204,21,0.1)',  border: 'rgba(250,204,21,0.4)' },
  Max:   { color: '#ff9500', bg: 'rgba(255,149,0,0.1)',   border: 'rgba(255,149,0,0.45)' },
}

interface Props {
  er: CharacterEr
  totalER?: string
}

export default function ErInfo({ er, totalER }: Props) {
  const current = parseFloat(totalER ?? '')
  const diff = !isNaN(current) ? current - er.er_target : null
  const imp = IMP_STYLE[er.er_imp_label] ?? IMP_STYLE.Min

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-xs font-display uppercase tracking-wider">
        <span className="text-ww-muted">ER Target</span>
        <span className="readout text-ww-text">{er.er_target}%</span>
        {diff !== null && (
          <span className={`readout text-[11px] ${diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            ({diff >= 0 ? '+' : ''}{diff.toFixed(1)})
          </span>
        )}
      </div>

      <span
        className="text-[10px] font-display font-bold uppercase tracking-[0.18em] px-2 py-0.5 rounded border"
        style={{ color: imp.color, background: imp.bg, borderColor: imp.border, boxShadow: `0 0 8px ${imp.color}30` }}
      >
        {er.er_imp_label}
      </span>
    </div>
  )
}
