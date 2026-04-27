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
  charWeights?: Record<string, number>
  subStatRolls?: Record<string, number[]>
  hideMeta?: boolean
  onEchoInfoChange: (info: EchoInfo) => void
  onSubStatsChange: (stats: SubStat[]) => void
}

function WeightBadge({ weight }: { weight: number }) {
  const tier =
    weight >= 0.9 ? { color: '#facc15', bg: 'rgba(250,204,21,0.12)', border: 'rgba(250,204,21,0.4)' } :
    weight >= 0.4 ? { color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.4)' } :
                    { color: '#8b949e', bg: 'rgba(139,148,158,0.1)', border: 'rgba(139,148,158,0.3)' }
  return (
    <span
      className="readout text-[10px] px-1.5 py-0.5 rounded border shrink-0"
      style={{ color: tier.color, background: tier.bg, borderColor: tier.border }}
    >
      ×{weight.toFixed(2)}
    </span>
  )
}

function RollBar({ type, value }: { type: string; value: number }) {
  const max = SUB_STAT_MAX[type] ?? 1
  const pct = Math.min((value / max) * 100, 100)
  const color =
    pct >= 80 ? '#facc15' :
    pct >= 60 ? '#4ade80' :
    pct >= 40 ? '#67e8f9' :
                '#475569'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-ww-bg-deep/70 rounded-full overflow-hidden border border-ww-border">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            boxShadow: pct > 0 ? `0 0 6px ${color}80` : 'none',
          }}
        />
      </div>
      <span className="readout text-[10px] text-ww-muted w-9 text-right">{Math.round(pct)}%</span>
    </div>
  )
}

export default function StatsEditor({
  echoInfo, subStats, charWeights, subStatRolls, hideMeta,
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
      {/* Echo Identity — hidden when save dialog handles it */}
      {!hideMeta && (
        <section className="panel-tech p-5 space-y-3">
          <h3 className="section-label">Echo Info</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] text-ww-muted mb-1.5 font-display">
                Echo Name
              </label>
              <input
                className="input"
                value={echoInfo.echo_name}
                onChange={e => onEchoInfoChange({ ...echoInfo, echo_name: e.target.value })}
                placeholder="e.g. Inferno Rider"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] text-ww-muted mb-1.5 font-display">
                Cost
              </label>
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
        </section>
      )}

      {/* Sub Stats */}
      <section className="panel-tech p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="section-label">
            Sub Stats
            <span className="text-ww-muted ml-2 normal-case tracking-normal">
              {(() => {
                const displayed = charWeights
                  ? subStats.filter(s => charWeights[s.type] !== undefined)
                  : subStats
                const filled = displayed.filter(s => s.value > 0).length
                return `${filled}/${displayed.length}`
              })()}
            </span>
          </h3>
          <button
            onClick={addStat}
            className="flex items-center gap-1 text-[11px] uppercase tracking-wider font-display text-ww-cyan hover:text-glow-cyan transition-colors"
          >
            <Plus className="w-3 h-3" /> Add stat
          </button>
        </div>

        <div className="space-y-3">
          {subStats.map((stat, idx) => {
            const weight = charWeights?.[stat.type]
            if (charWeights && weight === undefined) return null
            const rolls = subStatRolls?.[stat.type]
            return (
              <div key={idx} className="space-y-1.5">
                <div className="flex gap-2 items-center">
                  <select
                    className="select flex-1 min-w-0"
                    value={stat.type}
                    onChange={e => updateStatType(idx, e.target.value)}
                  >
                    {SUB_STAT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>

                  {charWeights && weight !== undefined && <WeightBadge weight={weight} />}

                  {rolls ? (
                    <select
                      className="select w-20 text-right readout"
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
                      className="input readout w-20 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
            <p className="text-ww-muted text-sm text-center py-4 font-display tracking-wide">
              {charWeights
                ? 'Paste or upload an echo screenshot to fill sub-stats'
                : 'Select a Resonator first, then paste an echo image'}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
