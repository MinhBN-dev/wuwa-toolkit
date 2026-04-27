import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import type { SubStat, ScoreResponse, GameData } from '../types/echo'
import { getTierLabel, getTierClass } from '../utils/tier'

export interface SaveEchoData {
  echo_name: string
  echo_cost: number
  main_stat_type: string | null
  main_stat_value: number | null
  sub_stats: SubStat[]
  score?: number
  score_percent?: number
  tier?: string
}

interface Props {
  open: boolean
  initial: SaveEchoData
  scoreResult: ScoreResponse | null
  gameData: GameData | undefined
  isPending: boolean
  onConfirm: (data: SaveEchoData) => void
  onClose: () => void
}

const COSTS = [4, 3, 1]

export default function SaveEchoDialog({
  open, initial, scoreResult, gameData, isPending, onConfirm, onClose,
}: Props) {
  const [form, setForm] = useState<SaveEchoData>(initial)

  useEffect(() => {
    if (open) setForm(initial)
  }, [open, initial])

  if (!open) return null

  const mainStatOptions = gameData?.main_stat_options?.[String(form.echo_cost)] ?? []
  const tierLabel = scoreResult ? getTierLabel(scoreResult.score_percent) : null
  const tierClass = tierLabel ? getTierClass(tierLabel) : ''

  const handleConfirm = () => {
    if (!form.echo_name.trim()) return
    onConfirm(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ww-bg-deep/80 backdrop-blur-sm animate-fade-up">
      <div className="panel-tech w-full max-w-md shadow-panel">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dashed border-ww-border">
          <h2 className="section-label">Confirm Save Echo</h2>
          <button onClick={onClose} className="text-ww-muted hover:text-ww-cyan transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Score summary */}
          {scoreResult && (
            <div className={`flex items-center gap-3 px-3 py-2 rounded-md border text-sm ${tierClass}`}>
              <span className="font-display font-bold uppercase tracking-wider">{tierLabel}</span>
              <span className="text-ww-muted">·</span>
              <span className="readout font-semibold">{scoreResult.score_percent.toFixed(2)}%</span>
              <span className="text-ww-muted ml-auto text-[10px] uppercase tracking-wider font-display">score</span>
            </div>
          )}

          {/* Echo name */}
          <div>
            <label className="block text-[11px] uppercase tracking-[0.2em] text-ww-muted mb-1.5 font-display">
              Echo Name
            </label>
            <input
              className="input"
              value={form.echo_name}
              onChange={e => setForm(f => ({ ...f, echo_name: e.target.value }))}
              placeholder="e.g. Inferno Rider"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] text-ww-muted mb-1.5 font-display">
                Cost
              </label>
              <select
                className="select"
                value={form.echo_cost}
                onChange={e => setForm(f => ({ ...f, echo_cost: parseInt(e.target.value), main_stat_type: null }))}
              >
                {COSTS.map(c => <option key={c} value={c}>{c}-cost</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] text-ww-muted mb-1.5 font-display">
                Main Stat
              </label>
              {mainStatOptions.length > 0 ? (
                <select
                  className="select"
                  value={form.main_stat_type ?? ''}
                  onChange={e => setForm(f => ({ ...f, main_stat_type: e.target.value || null }))}
                >
                  <option value="">— select —</option>
                  {mainStatOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input
                  className="input"
                  value={form.main_stat_type ?? ''}
                  onChange={e => setForm(f => ({ ...f, main_stat_type: e.target.value || null }))}
                  placeholder="e.g. Crit. DMG"
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-[0.2em] text-ww-muted mb-1.5 font-display">
              Main Stat Value
            </label>
            <input
              type="number"
              className="input readout"
              value={form.main_stat_value ?? ''}
              onChange={e => setForm(f => ({ ...f, main_stat_value: parseFloat(e.target.value) || null }))}
              placeholder="e.g. 44.0"
              step="0.1"
            />
          </div>

          {/* Sub stats — read-only summary */}
          <div>
            <label className="block text-[11px] uppercase tracking-[0.2em] text-ww-muted mb-1.5 font-display">
              Sub Stats <span className="text-ww-border-glow">({form.sub_stats.length})</span>
            </label>
            <div className="space-y-1">
              {form.sub_stats.map((s, i) => (
                <div key={i} className="flex justify-between text-xs px-2.5 py-1.5 rounded-md bg-ww-bg-deep/60 border border-ww-border">
                  <span className="text-ww-muted">{s.type}</span>
                  <span className="readout text-ww-text">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-dashed border-ww-border">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending || !form.echo_name.trim()}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isPending ? 'Saving' : 'Save Echo'}
          </button>
        </div>
      </div>
    </div>
  )
}
