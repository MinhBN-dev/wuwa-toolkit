import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload, Loader2, TrendingUp, X, RefreshCw, Save, FolderOpen, Trash2, Crosshair } from 'lucide-react'
import { toast } from 'sonner'
import { getCharacters, getGameData, extractEchoStats, calculateScore, findOrCreateEcho, saveEchoSet, getEchoSets, deleteEchoSet } from '../services/api'
import type { Character, SubStat, ScoreResponse, OcrResult, SavedEchoSet } from '../types/echo'
import { getTierLabel, getTierClass, TIER_THRESHOLDS } from '../utils/tier'
import ErInfo from '../components/ErInfo'

// ── Helpers ──────────────────────────────────────────────────────────────────

function snapToRoll(value: number, rolls: number[]): number {
  if (!rolls.length) return value
  return rolls.reduce((best, r) => Math.abs(r - value) < Math.abs(best - value) ? r : best)
}

function defaultSubStatsForChar(
  charName: string,
  charWeights: Record<string, Record<string, number>>,
): SubStat[] {
  const weights = charWeights[charName] ?? {}
  return Object.entries(weights)
    .filter(([, w]) => w > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([type]) => ({ type, value: 0 }))
}


// ── Slot state ────────────────────────────────────────────────────────────────

interface SlotState {
  echoName: string
  echoCost: number
  mainStatType: string | null
  mainStatValue: number | null
  subStats: SubStat[]
  imageUrl: string | null
  loading: boolean
  scoreResult: ScoreResponse | null
}

function emptySlot(charName?: string, charWeights?: Record<string, Record<string, number>>): SlotState {
  return {
    echoName: '',
    echoCost: 4,
    mainStatType: null,
    mainStatValue: null,
    subStats: charName && charWeights ? defaultSubStatsForChar(charName, charWeights) : [],
    imageUrl: null,
    loading: false,
    scoreResult: null,
  }
}

// ── EchoSlot component ────────────────────────────────────────────────────────

interface SlotProps {
  index: number
  slot: SlotState
  charWeights: Record<string, number> | null
  isPasteTarget: boolean
  onSelectTarget: () => void
  onFile: (file: File) => void
  onClear: () => void
}

function EchoSlot({ index, slot, charWeights, isPasteTarget, onSelectTarget, onFile, onClear }: SlotProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('image/')) onFile(file)
  }, [onFile])

  const filledStats = slot.subStats.filter(s =>
    s.value > 0 && (!charWeights || charWeights[s.type] !== undefined)
  )

  const tierClass = slot.scoreResult ? getTierClass(getTierLabel(slot.scoreResult.score_percent)) : ''

  return (
    <div className={`card flex flex-col gap-3 transition-all ${isPasteTarget ? 'ring-2 ring-ww-accent' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onSelectTarget}
          title="Chọn làm paste target"
          className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
            isPasteTarget ? 'text-ww-accent' : 'text-ww-muted hover:text-ww-text'
          }`}
        >
          <Crosshair className="w-3.5 h-3.5" />
          Echo {index + 1}
        </button>
        <div className="flex items-center gap-2">
          {slot.scoreResult && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${tierClass}`}>
              {getTierLabel(slot.scoreResult.score_percent)} · {slot.scoreResult.score_percent.toFixed(3)}%
            </span>
          )}
          {(slot.imageUrl || slot.subStats.some(s => s.value > 0)) && (
            <button onClick={onClear} className="text-ww-muted hover:text-red-400 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Upload zone / preview */}
      {slot.imageUrl ? (
        <div className="relative rounded-lg overflow-hidden border border-ww-border">
          <img src={slot.imageUrl} alt="" className="w-full object-contain bg-black/20 max-h-32" />
          {slot.loading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-ww-accent animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all
            ${isPasteTarget
              ? 'border-ww-accent/60 bg-ww-accent/5 hover:bg-ww-accent/10'
              : 'border-ww-border hover:border-ww-accent/40 hover:bg-ww-surface/50'
            }`}
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
          />
          <Upload className="w-5 h-5 mx-auto text-ww-muted mb-1" />
          <p className="text-xs text-ww-muted">
            {isPasteTarget ? 'Paste (Ctrl+V) hoặc click' : 'Click để upload'}
          </p>
        </div>
      )}

      {/* Echo name */}
      {slot.echoName && (
        <p className="text-xs font-semibold text-ww-text truncate">{slot.echoName}</p>
      )}

      {/* Sub-stats */}
      {filledStats.length > 0 && (
        <div className="space-y-1">
          {filledStats.map((s, i) => {
            const weight = charWeights?.[s.type]
            return (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-ww-muted truncate">{s.type}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {weight !== undefined && (
                    <span className={`text-[10px] font-mono px-1 rounded ${
                      weight >= 0.9 ? 'text-yellow-300' : weight >= 0.4 ? 'text-green-300' : 'text-ww-muted'
                    }`}>×{weight.toFixed(2)}</span>
                  )}
                  <span className="text-ww-text font-mono">{s.value}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Score bar */}
      {slot.scoreResult && (
        <div className="pt-1 border-t border-ww-border">
          <div className="w-full h-1.5 bg-ww-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                slot.scoreResult.score_percent >= 88 ? 'bg-tier-S' :
                slot.scoreResult.score_percent >= 66 ? 'bg-tier-A' :
                slot.scoreResult.score_percent >= 50 ? 'bg-tier-B' :
                slot.scoreResult.score_percent >= 35 ? 'bg-tier-C' : 'bg-tier-D'
              }`}
              style={{ width: `${slot.scoreResult.score_percent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Set summary ───────────────────────────────────────────────────────────────

function SetSummary({ slots, charName }: { slots: SlotState[]; charName: string | null }) {
  const scored = slots.filter(s => s.scoreResult && s.scoreResult.tier_label !== 'Not Applicable')
  if (scored.length === 0) return null

  const totalAV = scored.reduce((s, sl) => s + sl.scoreResult!.score, 0)
  const totalEP = scored.reduce((s, sl) => s + sl.scoreResult!.max_possible, 0)
  const setScore = scored.reduce((s, sl) => s + sl.scoreResult!.score_percent, 0) / scored.length
  const tierLabel = getTierLabel(setScore)
  const tierClass = getTierClass(tierLabel)

  // Aggregate breakdown across all scored echoes
  const breakdown: Record<string, number> = {}
  for (const sl of scored) {
    for (const [stat, val] of Object.entries(sl.scoreResult!.breakdown)) {
      breakdown[stat] = (breakdown[stat] ?? 0) + val
    }
  }
  const sortedBreakdown = Object.entries(breakdown).sort(([, a], [, b]) => b - a).filter(([, v]) => v > 0)

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-ww-accent" />
        <h3 className="font-semibold text-sm uppercase tracking-wider text-ww-accent">Set Score</h3>
        {charName && <span className="text-xs text-ww-muted">for {charName}</span>}
        <span className="text-xs text-ww-muted ml-auto">{scored.length}/5 echoes</span>
      </div>

      <div className="flex items-center gap-6">
        <div className={`w-24 h-24 rounded-xl border-2 flex items-center justify-center shrink-0 ${tierClass}`}>
          <span className="text-xs font-black text-center leading-tight px-2">{tierLabel}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-end gap-2">
            <span className="text-4xl font-black text-ww-text">{setScore.toFixed(3)}</span>
            <span className="text-ww-muted text-lg mb-1">/ 100</span>
          </div>
          <div className="w-full h-3 bg-ww-border rounded-full overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all ${
                setScore >= 75 ? 'bg-tier-S' : setScore >= 55 ? 'bg-tier-A' :
                setScore >= 40 ? 'bg-tier-B' : setScore >= 25 ? 'bg-tier-C' : 'bg-tier-D'
              }`}
              style={{ width: `${setScore}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-ww-muted mt-1">
            <span>Total AV: {totalAV.toFixed(3)}</span>
            <span>Total EP: {totalEP.toFixed(3)}</span>
          </div>
        </div>
      </div>

      {sortedBreakdown.length > 0 && (
        <div>
          <p className="text-xs text-ww-muted uppercase tracking-wider mb-2">Combined Contributions</p>
          <div className="space-y-1.5">
            {sortedBreakdown.map(([stat, contrib]) => {
              const pct = totalEP > 0 ? (contrib / totalEP) * 100 : 0
              return (
                <div key={stat} className="flex items-center gap-2">
                  <span className="text-xs text-ww-text w-36 shrink-0">{stat}</span>
                  <div className="flex-1 h-1.5 bg-ww-border rounded-full overflow-hidden">
                    <div className="h-full bg-ww-accent/70 rounded-full" style={{ width: `${Math.min(pct * 4, 100)}%` }} />
                  </div>
                  <span className="text-xs text-ww-muted w-12 text-right">{contrib.toFixed(3)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1 pt-1 border-t border-ww-border">
        {TIER_THRESHOLDS.map(([, lbl]) => (
          <div key={lbl} className={`flex-1 min-w-0 text-center py-1 px-1 rounded text-[10px] font-bold border whitespace-nowrap ${getTierClass(lbl)} ${lbl === tierLabel ? 'opacity-100' : 'opacity-25'}`}>
            {lbl}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SetPage() {
  const [selectedChar, setSelectedChar] = useState<Character | null>(null)
  const [totalER, setTotalER] = useState('100')
  const [slots, setSlots] = useState<SlotState[]>(() => Array.from({ length: 5 }, () => emptySlot()))
  const [calcLoading, setCalcLoading] = useState(false)
  const [pasteTarget, setPasteTarget] = useState<number>(0)
  const [saveName, setSaveName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [showLoadPanel, setShowLoadPanel] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)

  const qc = useQueryClient()
  const { data: characters = [] } = useQuery({ queryKey: ['characters'], queryFn: getCharacters })
  const { data: gameData } = useQuery({ queryKey: ['game-data'], queryFn: getGameData })
  const { data: savedSets = [] } = useQuery({ queryKey: ['echo-sets'], queryFn: getEchoSets })

  const charWeights = selectedChar && gameData ? (gameData.character_weights[selectedChar.name] ?? null) : null
  const subStatRolls = gameData?.sub_stat_rolls ?? {}

  const updateSlot = useCallback((idx: number, patch: Partial<SlotState>) => {
    setSlots(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
  }, [])

  const handleCharacterChange = (char: Character | null) => {
    setSelectedChar(char)
    setSlots(Array.from({ length: 5 }, () =>
      emptySlot(char?.name, gameData?.character_weights)
    ))
  }

  const handleCalculateAll = useCallback(async () => {
    const cw = selectedChar && gameData ? (gameData.character_weights[selectedChar.name] ?? null) : null
    const totalERNum = parseFloat(totalER) || 100
    const toScore = slots
      .map((slot, idx) => ({ slot, idx }))
      .filter(({ slot }) => slot.subStats.some(s => s.value > 0 && (!cw || cw[s.type] !== undefined)))

    if (toScore.length === 0) {
      toast.warning('Chưa có echo nào có dữ liệu')
      return
    }

    setCalcLoading(true)
    try {
      const results = await Promise.all(
        toScore.map(async ({ slot, idx }) => {
          const activeStats = slot.subStats.filter(s =>
            s.value > 0 && (!cw || cw[s.type] !== undefined)
          )
          const r = await calculateScore({
            character_name: selectedChar?.name,
            echo_cost: slot.echoCost,
            sub_stats: activeStats,
            total_er: totalERNum,
          })
          return { idx, r }
        })
      )
      setSlots(prev => {
        const next = [...prev]
        for (const { idx, r } of results) next[idx] = { ...next[idx], scoreResult: r }
        return next
      })
    } catch {
      toast.error('Tính điểm thất bại')
    } finally {
      setCalcLoading(false)
    }
  }, [selectedChar, gameData, totalER, slots])

  // Derive set score from current slot results (used for saving)
  const scoredSlots = slots.filter(s => s.scoreResult && s.scoreResult.tier_label !== 'Not Applicable')
  const currentSetScore = scoredSlots.length > 0
    ? scoredSlots.reduce((s, sl) => s + sl.scoreResult!.score_percent, 0) / scoredSlots.length
    : undefined

  const handleSave = async () => {
    if (!saveName.trim()) { toast.warning('Nhập tên cho set'); return }
    setSaveLoading(true)
    try {
      const totalERNum = parseFloat(totalER) || undefined

      // find-or-create each filled slot → get echo IDs
      const echoIdMap = new Map<number, string>()
      await Promise.all(
        slots.map(async (slot, idx) => {
          if (!slot.echoName || !slot.subStats.some(s => s.value > 0)) return
          const echo = await findOrCreateEcho({
            character_id: selectedChar?.id,
            echo_name: slot.echoName,
            echo_cost: slot.echoCost,
            main_stat_type: slot.mainStatType,
            main_stat_value: slot.mainStatValue,
            sub_stats: slot.subStats.filter(s => s.value > 0),
            total_er: totalERNum,
            score: slot.scoreResult?.score,
            score_percent: slot.scoreResult?.score_percent,
            tier: slot.scoreResult?.tier,
          })
          echoIdMap.set(idx, echo.id)
        })
      )

      const slotsData = slots.map((slot, idx) => ({
        echo_id: echoIdMap.get(idx) ?? null,
        echo_name: slot.echoName,
        echo_cost: slot.echoCost,
        sub_stats: slot.subStats.filter(s => s.value > 0),
        score: slot.scoreResult?.score ?? null,
        score_percent: slot.scoreResult?.score_percent ?? null,
        tier: slot.scoreResult?.tier ?? null,
        tier_label: slot.scoreResult?.tier_label ?? null,
      }))

      await saveEchoSet({
        name: saveName.trim(),
        character_id: selectedChar?.id,
        character_name: selectedChar?.name,
        total_er: totalERNum,
        slots: slotsData,
        set_score: currentSetScore,
        set_tier: currentSetScore !== undefined
          ? (currentSetScore >= 88 ? 'S' : currentSetScore >= 66 ? 'A' : currentSetScore >= 50 ? 'B' : currentSetScore >= 35 ? 'C' : 'D')
          : undefined,
      })
      toast.success(`Đã lưu set "${saveName.trim()}"`)
      setSaveName('')
      setShowSaveInput(false)
      qc.invalidateQueries({ queryKey: ['echo-sets'] })
      qc.invalidateQueries({ queryKey: ['echoes'] })
    } catch {
      toast.error('Lưu thất bại')
    } finally {
      setSaveLoading(false)
    }
  }

  const handleLoadSet = (saved: SavedEchoSet) => {
    // Find character object
    const char = characters.find(c => c.name === saved.character_name) ?? null
    setSelectedChar(char)
    setTotalER(saved.total_er?.toString() ?? '100')

    // Build 5 slots — pad with empty if saved has fewer
    const charWeightsMap = char && gameData ? gameData.character_weights : {}
    const loaded: SlotState[] = Array.from({ length: 5 }, (_, i) => {
      const s = saved.slots[i]
      if (!s) return emptySlot(char?.name, charWeightsMap)
      const subStats = s.sub_stats.length > 0
        ? s.sub_stats
        : (char ? defaultSubStatsForChar(char.name, charWeightsMap) : [])
      return {
        echoName: s.echo_name,
        echoCost: s.echo_cost,
        mainStatType: null,
        mainStatValue: null,
        subStats,
        imageUrl: null,
        loading: false,
        scoreResult: s.score_percent != null ? {
          score: s.score ?? 0,
          score_percent: s.score_percent,
          tier: s.tier ?? 'D',
          tier_label: s.tier_label ?? null,
          breakdown: {},
          max_possible: 0,
          character_name: saved.character_name,
        } : null,
      }
    })
    setSlots(loaded)
    setShowLoadPanel(false)
    toast.success(`Đã load set "${saved.name}"`)
  }

  const handleDeleteSet = async (id: string, name: string) => {
    try {
      await deleteEchoSet(id)
      toast.success(`Đã xoá "${name}"`)
      qc.invalidateQueries({ queryKey: ['echo-sets'] })
    } catch {
      toast.error('Xoá thất bại')
    }
  }

  const processFile = useCallback(async (idx: number, file: File) => {
    const imageUrl = URL.createObjectURL(file)
    updateSlot(idx, { imageUrl, loading: true, scoreResult: null })
    const toastId = toast.loading(`Echo ${idx + 1}: đang đọc...`)

    try {
      const result: OcrResult = await extractEchoStats(file)
      toast.success(`Echo ${idx + 1}: đọc thành công!`, { id: toastId })

      const rolls = subStatRolls
      const ocrMap = new Map(result.sub_stats.map(s => [s.type, s.value]))

      // Merge OCR into pre-populated slots
      const baseStats = selectedChar && gameData
        ? defaultSubStatsForChar(selectedChar.name, gameData.character_weights)
        : []

      let merged: SubStat[]
      if (baseStats.length > 0) {
        merged = baseStats.map(s => {
          const raw = ocrMap.get(s.type)
          if (raw === undefined) return { ...s, value: 0 }
          const r = rolls[s.type]
          return { ...s, value: r ? snapToRoll(raw, r) : raw }
        })
        for (const ocrStat of result.sub_stats) {
          if (!merged.some(s => s.type === ocrStat.type)) {
            const r = rolls[ocrStat.type]
            merged.push({ type: ocrStat.type, value: r ? snapToRoll(ocrStat.value, r) : ocrStat.value })
          }
        }
      } else {
        merged = result.sub_stats.map(s => {
          const r = rolls[s.type]
          return { ...s, value: r ? snapToRoll(s.value, r) : s.value }
        })
      }

      updateSlot(idx, {
        echoName: result.echo_name,
        echoCost: result.echo_cost ?? 4,
        mainStatType: result.main_stat_type ?? null,
        mainStatValue: result.main_stat_value ?? null,
        subStats: merged,
        loading: false,
      })
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'OCR thất bại', { id: toastId })
      updateSlot(idx, { loading: false })
    }
  }, [selectedChar, gameData, subStatRolls, updateSlot])

  // Global paste → pasteTarget slot
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!selectedChar) return
      const items = Array.from(e.clipboardData?.items ?? [])
      const imgItem = items.find(it => it.type.startsWith('image/'))
      if (!imgItem) return
      const file = imgItem.getAsFile()
      if (!file) return
      processFile(pasteTarget, file)
      // Advance to next slot (wrap around)
      setPasteTarget((pasteTarget + 1) % 5)
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [selectedChar, pasteTarget, processFile])

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top bar */}
      <div className="card flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-48">
          <label className="text-xs text-ww-muted block mb-1">Resonator</label>
          <select
            className="select w-full"
            value={selectedChar?.id ?? ''}
            onChange={e => handleCharacterChange(characters.find(c => c.id === e.target.value) ?? null)}
          >
            <option value="">— Chọn Resonator trước —</option>
            {characters.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.element} · {c.role})</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <div className="w-40">
            <label className="text-xs text-ww-muted block mb-1">Total ER% of build</label>
            <input
              type="text"
              inputMode="decimal"
              className="input w-full"
              value={totalER}
              onChange={e => setTotalER(e.target.value)}
              placeholder="100"
            />
          </div>
          {selectedChar && gameData?.character_er[selectedChar.name] && (
            <ErInfo er={gameData.character_er[selectedChar.name]} totalER={totalER} />
          )}
        </div>
        <div className="flex items-end gap-2 flex-wrap self-end">
          {/* Load saved sets */}
          <button
            onClick={() => setShowLoadPanel(v => !v)}
            className="btn-secondary flex items-center gap-2"
          >
            <FolderOpen className="w-4 h-4" />
            Load Set
          </button>

          {selectedChar && (
            <>
              <button
                onClick={handleCalculateAll}
                disabled={calcLoading}
                className="btn-primary flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${calcLoading ? 'animate-spin' : ''}`} />
                {calcLoading ? 'Đang tính...' : 'Tính Score'}
              </button>

              {/* Save */}
              {showSaveInput ? (
                <div className="flex items-center gap-2">
                  <input
                    className="input w-40"
                    placeholder="Tên set..."
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                    autoFocus
                  />
                  <button
                    onClick={handleSave}
                    disabled={saveLoading}
                    className="btn-primary flex items-center gap-1"
                  >
                    <Save className="w-4 h-4" />
                    {saveLoading ? '...' : 'Lưu'}
                  </button>
                  <button onClick={() => setShowSaveInput(false)} className="btn-secondary px-2">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSaveInput(true)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Lưu Set
                </button>
              )}

              <p className="text-xs text-ww-muted self-center">
                Paste (Ctrl+V) → ô tiếp theo
              </p>
            </>
          )}
        </div>
      </div>

      {/* Load panel */}
      {showLoadPanel && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-ww-accent flex items-center gap-2">
              <FolderOpen className="w-4 h-4" /> Sets đã lưu
            </h3>
            <button onClick={() => setShowLoadPanel(false)} className="text-ww-muted hover:text-ww-text">
              <X className="w-4 h-4" />
            </button>
          </div>
          {savedSets.length === 0 ? (
            <p className="text-ww-muted text-sm text-center py-4">Chưa có set nào được lưu</p>
          ) : (
            <div className="space-y-2">
              {savedSets.map(s => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-ww-bg hover:bg-ww-border/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-ww-text truncate">{s.name}</p>
                    <p className="text-xs text-ww-muted">
                      {s.character_name ?? 'Unknown'} · ER {s.total_er ?? '?'}%
                      {s.set_score != null && ` · ${s.set_score.toFixed(3)} (${s.set_tier})`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleLoadSet(s)}
                    className="btn-primary text-xs px-3 py-1.5 shrink-0"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => handleDeleteSet(s.id, s.name)}
                    className="text-ww-muted hover:text-red-400 transition-colors p-1 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5 echo slots */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {slots.map((slot, idx) => (
          <EchoSlot
            key={idx}
            index={idx}
            slot={slot}
            charWeights={charWeights}
            isPasteTarget={selectedChar !== null && idx === pasteTarget}
            onSelectTarget={() => setPasteTarget(idx)}
            onFile={file => processFile(idx, file)}
            onClear={() => updateSlot(idx, emptySlot(selectedChar?.name, gameData?.character_weights))}
          />
        ))}
      </div>

      {/* Set summary */}
      <SetSummary slots={slots} charName={selectedChar?.name ?? null} />

      {!selectedChar && (
        <div className="card text-center py-12">
          <p className="text-ww-muted">Chọn Resonator để bắt đầu nhập echo set</p>
        </div>
      )}
    </div>
  )
}
