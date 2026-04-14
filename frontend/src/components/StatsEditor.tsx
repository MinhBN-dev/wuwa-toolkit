import { Plus, Trash2 } from 'lucide-react'
import type { SubStat } from '../types/echo'

const SUB_STAT_TYPES = [
  'Crit Rate', 'Crit DMG', 'ATK%', 'Flat ATK',
  'HP%', 'Flat HP', 'DEF%', 'Flat DEF',
  'Basic ATK DMG%', 'Heavy ATK DMG%', 'Skill DMG%', 'Liberation DMG%', 'ER%',
]

const SUB_STAT_MAX: Record<string, number> = {
  'Crit Rate': 10.5, 'Crit DMG': 21.0, 'ATK%': 11.6, 'Flat ATK': 60,
  'HP%': 11.6, 'Flat HP': 580, 'DEF%': 14.7, 'Flat DEF': 70,
  'Basic ATK DMG%': 11.6, 'Heavy ATK DMG%': 11.6, 'Skill DMG%': 11.6,
  'Liberation DMG%': 11.6, 'ER%': 12.4,
}

interface EchoInfo {
  echo_name: string
  echo_cost: number
}

interface Props {
  echoInfo: EchoInfo
  subStats: SubStat[]
  /** stat display name → weight (only stats with weight > 0) for selected character */
  charWeights?: Record<string, number>
  /** stat display name → list of valid roll values */
  subStatRolls?: Record<string, number[]>
  onEchoInfoChange: (info: EchoInfo) => void
  onSubStatsChange: (stats: SubStat[]) => void
}

function WeightBadge({ weight }: { weight: number }) {
  const cls =
    weight >= 0.9 ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
    weight >= 0.4 ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                    'bg-ww-border text-ww-muted border-ww-border'
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono shrink-0 ${cls}`}>
      ×{weight.toFixed(2)}
    </span>
  )
}

function RollBar({ type, value }: { type: string; value: number }) {
  const max = SUB_STAT_MAX[type] ?? 1
  const pct = Math.min((value / max) * 100, 100)
  const color = pct >= 80 ? 'bg-yellow-400' : pct >= 60 ? 'bg-green-400' : pct >= 40 ? 'bg-blue-400' : 'bg-ww-muted'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-ww-border rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-ww-muted w-8 text-right">{Math.round(pct)}%</span>
    </div>
  )
}

export default function StatsEditor({
  echoInfo, subStats, charWeights, subStatRolls,
  onEchoInfoChange, onSubStatsChange,
}: Props) {
  const updateStatType = (idx: number, newType: string) => {
    onSubStatsChange(subStats.map((s, i) => i !== idx ? s : { type: newType, value: 0 }))
  }

  const updateStatValue = (idx: number, raw: string) => {
    onSubStatsChange(subStats.map((s, i) => i !== idx ? s : { ...s, value: parseFloat(raw) || 0 }))
  }

  const addStat = () => {
    const used = new Set(subStats.map(s => s.type))
    const next = charWeights
      ? Object.entries(charWeights).sort(([, a], [, b]) => b - a).find(([t]) => !used.has(t))?.[0]
      : undefined
    onSubStatsChange([...subStats, { type: next ?? 'Crit Rate', value: 0 }])
  }

  const removeStat = (idx: number) => {
    onSubStatsChange(subStats.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-4">
      {/* Echo Identity */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-ww-text text-sm uppercase tracking-wider text-ww-accent">
          Echo Info
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-ww-muted mb-1 block">Echo Name</label>
            <input
              className="input"
              value={echoInfo.echo_name}
              onChange={e => onEchoInfoChange({ ...echoInfo, echo_name: e.target.value })}
              placeholder="e.g. Inferno Rider"
            />
          </div>
          <div>
            <label className="text-xs text-ww-muted mb-1 block">Cost</label>
            <select
              className="select"
              value={echoInfo.echo_cost}
              onChange={e => onEchoInfoChange({ ...echoInfo, echo_cost: parseInt(e.target.value) })}
            >
              <option value={4}>4-cost</option>
              <option value={3}>3-cost</option>
              <option value={1}>1-cost</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sub Stats */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-ww-accent">
            Sub Stats{' '}
            <span className="text-ww-muted font-normal">
              {(() => {
                const displayed = charWeights
                  ? subStats.filter(s => charWeights[s.type] !== undefined)
                  : subStats
                const filled = displayed.filter(s => s.value > 0).length
                return `(${filled}/${displayed.length})`
              })()}
            </span>
          </h3>
          <button
            onClick={addStat}
            className="flex items-center gap-1 text-xs text-ww-accent hover:text-ww-accent-hover transition-colors"
          >
            <Plus className="w-3 h-3" /> Add stat
          </button>
        </div>

        <div className="space-y-3">
          {subStats.map((stat, idx) => {
            const weight = charWeights?.[stat.type]
            // When a character is selected, hide slots that have no weight
            if (charWeights && weight === undefined) return null
            const rolls = subStatRolls?.[stat.type]
            return (
              <div key={idx} className="space-y-1">
                <div className="flex gap-2 items-center">
                  {/* Stat type selector */}
                  <select
                    className="select flex-1 min-w-0"
                    value={stat.type}
                    onChange={e => updateStatType(idx, e.target.value)}
                  >
                    {SUB_STAT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>

                  {/* Weight badge */}
                  {charWeights && weight !== undefined && <WeightBadge weight={weight} />}

                  {/* Value — dropdown of valid rolls if available, otherwise free input */}
                  {rolls ? (
                    <select
                      className="select w-20 text-right"
                      value={stat.value || ''}
                      onChange={e => updateStatValue(idx, e.target.value)}
                    >
                      <option value="">—</option>
                      {rolls.map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      className="input w-20 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={stat.value || ''}
                      placeholder="0"
                      onChange={e => updateStatValue(idx, e.target.value)}
                      step="0.1"
                      min={0}
                    />
                  )}

                  <button
                    onClick={() => removeStat(idx)}
                    className="text-ww-muted hover:text-red-400 transition-colors p-1 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <RollBar type={stat.type} value={stat.value} />
              </div>
            )
          })}

          {subStats.length === 0 && (
            <p className="text-ww-muted text-sm text-center py-4">
              {charWeights
                ? 'Paste hoặc upload ảnh echo để điền sub-stats'
                : 'Chọn resonator trước, sau đó paste ảnh echo'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
