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

  // Reset form when dialog opens with new data
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
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-ww-surface border border-ww-border rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-ww-border">
          <h2 className="font-semibold text-ww-text">Xác nhận lưu Echo</h2>
          <button onClick={onClose} className="text-ww-muted hover:text-ww-text transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Score summary */}
          {scoreResult && (
            <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm ${tierClass}`}>
              <span className="font-bold">{tierLabel}</span>
              <span className="text-ww-muted">·</span>
              <span className="font-mono font-semibold">{scoreResult.score_percent.toFixed(3)}%</span>
              <span className="text-ww-muted ml-auto text-xs">score</span>
            </div>
          )}

          {/* Echo name */}
          <div>
            <label className="text-xs text-ww-muted block mb-1">Tên Echo</label>
            <input
              className="input w-full"
              value={form.echo_name}
              onChange={e => setForm(f => ({ ...f, echo_name: e.target.value }))}
              placeholder="e.g. Inferno Rider"
              autoFocus
            />
          </div>

          {/* Cost + Main stat type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ww-muted block mb-1">Cost</label>
              <select
                className="select w-full"
                value={form.echo_cost}
                onChange={e => setForm(f => ({ ...f, echo_cost: parseInt(e.target.value), main_stat_type: null }))}
              >
                {COSTS.map(c => <option key={c} value={c}>{c}-cost</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-ww-muted block mb-1">Main Stat</label>
              {mainStatOptions.length > 0 ? (
                <select
                  className="select w-full"
                  value={form.main_stat_type ?? ''}
                  onChange={e => setForm(f => ({ ...f, main_stat_type: e.target.value || null }))}
                >
                  <option value="">— chọn —</option>
                  {mainStatOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input
                  className="input w-full"
                  value={form.main_stat_type ?? ''}
                  onChange={e => setForm(f => ({ ...f, main_stat_type: e.target.value || null }))}
                  placeholder="e.g. Crit. DMG"
                />
              )}
            </div>
          </div>

          {/* Main stat value */}
          <div>
            <label className="text-xs text-ww-muted block mb-1">Main Stat Value</label>
            <input
              type="number"
              className="input w-full"
              value={form.main_stat_value ?? ''}
              onChange={e => setForm(f => ({ ...f, main_stat_value: parseFloat(e.target.value) || null }))}
              placeholder="e.g. 44.0"
              step="0.1"
            />
          </div>

          {/* Sub stats — read only summary */}
          <div>
            <label className="text-xs text-ww-muted block mb-1.5">
              Sub Stats <span className="text-ww-border">({form.sub_stats.length})</span>
            </label>
            <div className="space-y-1">
              {form.sub_stats.map((s, i) => (
                <div key={i} className="flex justify-between text-xs px-2 py-1 bg-ww-bg rounded border border-ww-border">
                  <span className="text-ww-muted">{s.type}</span>
                  <span className="font-mono text-ww-text font-medium">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-ww-border">
          <button onClick={onClose} className="btn-secondary flex-1">
            Huỷ
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending || !form.echo_name.trim()}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isPending ? 'Đang lưu...' : 'Lưu Echo'}
          </button>
        </div>
      </div>
    </div>
  )
}
