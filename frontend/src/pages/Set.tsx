import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload, Loader2, X, RefreshCw, Save, FolderOpen, Trash2, Crosshair, Layers, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { getCharacters, getGameData, extractEchoStats, calculateSetScore, findOrCreateEcho, saveEchoSet, getEchoSets, deleteEchoSet } from '../services/api'
import type { Character, SubStat, ScoreResponse, OcrResult, SavedEchoSet } from '../types/echo'
import { getTierLabel, getTierClass, TIER_THRESHOLDS } from '../utils/tier'
import ErInfo from '../components/ErInfo'
import StatsEditor from '../components/StatsEditor'
import { snapToRoll, defaultSubStatsForChar } from '../utils/echoHelpers'

const TIER_COLOR: Record<string, string> = {
  Godly: '#ff9500',
  Extreme: '#ff9500',
  'High Investment': '#c084fc',
  'Well Built': '#60a5fa',
  Decent: '#60a5fa',
  'Base Level': '#4ade80',
  Unbuilt: '#94a3b8',
}

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

interface SlotProps {
  index: number
  slot: SlotState
  charWeights: Record<string, number> | null
  isPasteTarget: boolean
  onSelectTarget: () => void
  onFile: (file: File) => void
  onClear: () => void
  onEdit: () => void
}

function EchoSlot({ index, slot, charWeights, isPasteTarget, onSelectTarget, onFile, onClear, onEdit }: SlotProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('image/')) onFile(file)
  }, [onFile])

  const filledStats = slot.subStats.filter(s =>
    s.value > 0 && (!charWeights || charWeights[s.type] !== undefined)
  )

  const tierLabel = slot.scoreResult ? getTierLabel(slot.scoreResult.score_percent) : null
  const tierColor = tierLabel ? TIER_COLOR[tierLabel] ?? '#67e8f9' : null

  return (
    <div
      className="panel-tech p-4 flex flex-col gap-3 transition-all"
      style={isPasteTarget ? { boxShadow: `0 0 0 1px rgba(232,160,69,0.6), 0 0 20px rgba(232,160,69,0.25)` } : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onSelectTarget}
          title="Set as paste target"
          className={`flex items-center gap-1.5 text-[11px] font-display font-bold uppercase tracking-[0.15em] transition-colors ${
            isPasteTarget ? 'text-ww-accent' : 'text-ww-muted hover:text-ww-cyan'
          }`}
        >
          <Crosshair className="w-3.5 h-3.5" />
          Slot {index + 1}
        </button>
        <div className="flex items-center gap-2">
          {slot.scoreResult && tierColor && (
            <span
              className="readout text-[10px] font-display font-bold uppercase tracking-wider px-2 py-0.5 rounded border leading-none"
              style={{ color: tierColor, borderColor: `${tierColor}66`, background: `${tierColor}15` }}
            >
              {slot.scoreResult.score_percent.toFixed(1)}
            </span>
          )}
          <button
            onClick={onEdit}
            title="Enter / edit sub-stats manually"
            className="text-ww-muted hover:text-ww-cyan transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {(slot.imageUrl || slot.subStats.some(s => s.value > 0)) && (
            <button onClick={onClear} className="text-ww-muted hover:text-red-400 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Upload zone / preview */}
      {slot.imageUrl ? (
        <div className="relative rounded-md overflow-hidden border border-ww-border-glow">
          <img src={slot.imageUrl} alt="" className="w-full object-contain bg-black/30 max-h-32" />
          {slot.loading && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-ww-cyan animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <div
          className={`dropzone-frame ${isPasteTarget ? 'dropzone-active' : ''} p-4 text-center cursor-pointer`}
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
          <Upload className={`w-5 h-5 mx-auto mb-1 ${isPasteTarget ? 'text-ww-accent' : 'text-ww-cyan'}`} />
          <p className="text-[10px] font-display uppercase tracking-wider text-ww-muted">
            {isPasteTarget ? 'Paste (Ctrl+V) or click' : 'Click to upload'}
          </p>
        </div>
      )}

      {/* Echo name */}
      {slot.echoName && (
        <p className="font-display text-xs font-semibold text-ww-text truncate tracking-wide">{slot.echoName}</p>
      )}

      {/* Sub-stats */}
      {filledStats.length > 0 && (
        <div className="space-y-1">
          {filledStats.map((s, i) => {
            const weight = charWeights?.[s.type]
            const wColor =
              weight === undefined ? '#8b949e' :
              weight >= 0.9 ? '#facc15' :
              weight >= 0.4 ? '#4ade80' :
                              '#8b949e'
            return (
              <div key={i} className="flex items-center justify-between text-[11px]">
                <span className="text-ww-muted truncate">{s.type}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {weight !== undefined && (
                    <span className="readout text-[10px] px-1 rounded" style={{ color: wColor }}>
                      ×{weight.toFixed(2)}
                    </span>
                  )}
                  <span className="readout text-ww-text">{s.value}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Score bar */}
      {slot.scoreResult && tierColor && (
        <div className="pt-2 border-t border-dashed border-ww-border">
          <div className="w-full h-1 bg-ww-bg-deep/70 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(slot.scoreResult.score_percent, 100)}%`,
                background: `linear-gradient(90deg, ${tierColor}99, ${tierColor})`,
                boxShadow: `0 0 6px ${tierColor}`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function SetSummary({ slots, charName }: { slots: SlotState[]; charName: string | null }) {
  const scored = slots.filter(s => s.scoreResult && s.scoreResult.tier_label !== 'Not Applicable')
  if (scored.length === 0) return null

  const totalAV = scored.reduce((s, sl) => s + sl.scoreResult!.score, 0)
  const totalEP = scored.reduce((s, sl) => s + sl.scoreResult!.max_possible, 0)
  const setScore = scored.reduce((s, sl) => s + sl.scoreResult!.score_percent, 0) / scored.length
  const tierLabel = getTierLabel(setScore)
  const tierClass = getTierClass(tierLabel)
  const accent = TIER_COLOR[tierLabel] ?? '#67e8f9'
  const widthPct = Math.min(setScore, 100)

  const breakdown: Record<string, number> = {}
  for (const sl of scored) {
    for (const [stat, val] of Object.entries(sl.scoreResult!.breakdown)) {
      breakdown[stat] = (breakdown[stat] ?? 0) + val
    }
  }
  const sortedBreakdown = Object.entries(breakdown).sort(([, a], [, b]) => b - a).filter(([, v]) => v > 0)

  return (
    <div className="panel-tech p-5 space-y-4 animate-count-in">
      <div className="flex items-center justify-between">
        <h3 className="section-label">Aggregate Set Score</h3>
        <div className="flex items-center gap-3">
          {charName && <span className="text-[11px] uppercase tracking-wider font-display text-ww-muted">{charName}</span>}
          <span className="text-[11px] uppercase tracking-wider font-display text-ww-muted">{scored.length}/5 echoes</span>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <div
          className={`shrink-0 w-24 h-24 flex items-center justify-center rounded-md border-2 font-display font-bold uppercase text-center text-[11px] leading-tight px-2 tracking-wider ${tierClass}`}
          style={{ boxShadow: `0 0 20px ${accent}40, inset 0 0 0 1px ${accent}30` }}
        >
          {tierLabel}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-end gap-2">
            <span
              className="readout text-5xl font-bold leading-none"
              style={{ color: accent, textShadow: `0 0 18px ${accent}60` }}
            >
              {setScore.toFixed(2)}
            </span>
            <span className="text-ww-muted text-base mb-1 font-display">/ 100</span>
          </div>
          <div className="relative w-full h-2.5 bg-ww-bg-deep/80 rounded-full mt-3 overflow-hidden border border-ww-border">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${widthPct}%`,
                background: `linear-gradient(90deg, ${accent}99, ${accent})`,
                boxShadow: `0 0 12px ${accent}80`,
              }}
            />
            <div className="absolute inset-0 shimmer-line opacity-40 pointer-events-none" />
          </div>
          <div className="flex justify-between text-[11px] text-ww-muted mt-1.5 font-display uppercase tracking-wider">
            <span>Σ AV {totalAV.toFixed(2)}</span>
            <span>Σ EP {totalEP.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {sortedBreakdown.length > 0 && (
        <div className="pt-3 border-t border-dashed border-ww-border">
          <p className="section-label mb-2.5">Combined Contributions</p>
          <div className="space-y-1.5">
            {sortedBreakdown.map(([stat, contrib]) => {
              const pct = totalEP > 0 ? (contrib / totalEP) * 100 : 0
              return (
                <div key={stat} className="flex items-center gap-2">
                  <span className="text-xs text-ww-text w-32 shrink-0 truncate">{stat}</span>
                  <div className="flex-1 h-1.5 bg-ww-bg-deep/70 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(pct * 4, 100)}%`,
                        background: `linear-gradient(90deg, ${accent}80, ${accent})`,
                      }}
                    />
                  </div>
                  <span className="readout text-xs text-ww-muted w-12 text-right">{contrib.toFixed(2)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1 pt-3 border-t border-dashed border-ww-border">
        {TIER_THRESHOLDS.map(([, lbl]) => (
          <div
            key={lbl}
            className={`flex-1 min-w-0 text-center py-1 px-1 rounded-sm text-[9px] font-display font-bold uppercase tracking-wider border whitespace-nowrap transition-opacity ${
              getTierClass(lbl)
            } ${lbl === tierLabel ? 'opacity-100' : 'opacity-25'}`}
          >
            {lbl}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SetPage() {
  const [selectedChar, setSelectedChar] = useState<Character | null>(null)
  const [totalER, setTotalER] = useState('100')
  const [slots, setSlots] = useState<SlotState[]>(() => Array.from({ length: 5 }, () => emptySlot()))
  const [calcLoading, setCalcLoading] = useState(false)
  const [pasteTarget, setPasteTarget] = useState<number>(0)
  const [editingSlot, setEditingSlot] = useState<number | null>(null)
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
    const totalERNum = parseFloat(totalER) || 100
    const hasData = slots.some(slot => slot.subStats.some(s => s.value > 0))

    if (!hasData) {
      toast.warning('No echo has data yet')
      return
    }

    setCalcLoading(true)
    try {
      const r = await calculateSetScore({
        character_name: selectedChar?.name,
        echoes: slots.map(slot => ({
          echo_name: slot.echoName || 'Echo',
          sub_stats: slot.subStats.filter(s => s.value > 0),
        })),
        total_er: totalERNum,
      })

      setSlots(prev => prev.map((slot, idx) => {
        const result = r.echoes[idx]
        if (!result || !slot.subStats.some(s => s.value > 0)) return slot
        return {
          ...slot,
          scoreResult: {
            score: result.score,
            score_percent: result.score_percent,
            tier: result.tier,
            tier_label: result.tier_label ?? null,
            breakdown: result.breakdown,
            max_possible: result.max_possible,
            character_name: r.character_name,
          },
        }
      }))
    } catch {
      toast.error('Calculation failed')
    } finally {
      setCalcLoading(false)
    }
  }, [selectedChar, totalER, slots])

  const scoredSlots = slots.filter(s => s.scoreResult && s.scoreResult.tier_label !== 'Not Applicable')
  const currentSetScore = scoredSlots.length > 0
    ? scoredSlots.reduce((s, sl) => s + sl.scoreResult!.score_percent, 0) / scoredSlots.length
    : undefined

  const handleSave = async () => {
    if (!saveName.trim()) { toast.warning('Enter a set name'); return }
    setSaveLoading(true)
    try {
      const totalERNum = parseFloat(totalER) || undefined

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
        set_tier: currentSetScore !== undefined ? getTierLabel(currentSetScore) : undefined,
      })
      toast.success(`Saved set "${saveName.trim()}"`)
      setSaveName('')
      setShowSaveInput(false)
      qc.invalidateQueries({ queryKey: ['echo-sets'] })
      qc.invalidateQueries({ queryKey: ['echoes'] })
    } catch {
      toast.error('Save failed')
    } finally {
      setSaveLoading(false)
    }
  }

  const handleLoadSet = (saved: SavedEchoSet) => {
    const char = characters.find(c => c.name === saved.character_name) ?? null
    setSelectedChar(char)
    setTotalER(saved.total_er?.toString() ?? '100')

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
          tier: s.tier ?? 'Unbuilt',
          tier_label: s.tier_label ?? null,
          breakdown: {},
          max_possible: 0,
          character_name: saved.character_name,
        } : null,
      }
    })
    setSlots(loaded)
    setShowLoadPanel(false)
    toast.success(`Loaded set "${saved.name}"`)
  }

  const handleDeleteSet = async (id: string, name: string) => {
    try {
      await deleteEchoSet(id)
      toast.success(`Deleted "${name}"`)
      qc.invalidateQueries({ queryKey: ['echo-sets'] })
    } catch {
      toast.error('Delete failed')
    }
  }

  const processFile = useCallback(async (idx: number, file: File) => {
    const imageUrl = URL.createObjectURL(file)
    updateSlot(idx, { imageUrl, loading: true, scoreResult: null })
    const toastId = toast.loading(`Slot ${idx + 1}: reading…`)

    try {
      const result: OcrResult = await extractEchoStats(file)
      toast.success(`Slot ${idx + 1}: extracted!`, { id: toastId })

      const rolls = subStatRolls
      const ocrMap = new Map(result.sub_stats.map(s => [s.type, s.value]))

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
      toast.error(detail ?? 'OCR failed', { id: toastId })
      updateSlot(idx, { loading: false })
    }
  }, [selectedChar, gameData, subStatRolls, updateSlot])

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!selectedChar) return
      const items = Array.from(e.clipboardData?.items ?? [])
      const imgItem = items.find(it => it.type.startsWith('image/'))
      if (!imgItem) return
      const file = imgItem.getAsFile()
      if (!file) return
      processFile(pasteTarget, file)
      setPasteTarget((pasteTarget + 1) % 5)
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [selectedChar, pasteTarget, processFile])

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5 animate-fade-up">
      {/* Hero */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="section-label mb-1">Full Set Calibration</p>
          <h1 className="font-display font-bold text-3xl uppercase tracking-[0.15em] text-ww-text flex items-center gap-3">
            <Layers className="w-7 h-7 text-ww-cyan" />
            <span>5-Echo <span className="text-ww-cyan text-glow-cyan">Set</span></span>
          </h1>
          <p className="text-ww-muted text-sm mt-1">EVC full-mode scoring — ER budget shared across all 5 slots.</p>
        </div>
      </div>

      {/* Top control bar */}
      <section className="panel-tech p-4 flex flex-wrap gap-x-4 gap-y-3 items-end">
        <div className="flex-1 min-w-52">
          <label className="block text-[11px] uppercase tracking-[0.2em] text-ww-muted mb-1.5 font-display">
            Resonator
          </label>
          <select
            className="select w-full"
            value={selectedChar?.id ?? ''}
            onChange={e => handleCharacterChange(characters.find(c => c.id === e.target.value) ?? null)}
          >
            <option value="">— Select Resonator —</option>
            {characters.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.element} · {c.role})</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div>
            <label className="block text-[11px] uppercase tracking-[0.2em] text-ww-muted mb-1.5 font-display">
              Total ER%
            </label>
            <input
              type="text"
              inputMode="decimal"
              className="input readout w-24 text-base"
              value={totalER}
              onChange={e => setTotalER(e.target.value)}
              placeholder="100"
            />
          </div>
          {selectedChar && gameData?.character_er[selectedChar.name] && (
            <div className="pt-5">
              <ErInfo er={gameData.character_er[selectedChar.name]} totalER={totalER} />
            </div>
          )}
        </div>

        <div className="hidden sm:block h-10 w-px bg-ww-border-glow shrink-0 self-end mb-1" />

        <div className="flex items-center gap-2 flex-wrap self-end">
          <button
            onClick={() => setShowLoadPanel(v => !v)}
            className="btn-secondary flex items-center gap-2"
          >
            <FolderOpen className="w-4 h-4" />
            Load
          </button>

          {selectedChar && (
            <>
              <button
                onClick={handleCalculateAll}
                disabled={calcLoading}
                className="btn-primary flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${calcLoading ? 'animate-spin' : ''}`} />
                {calcLoading ? 'Scoring' : 'Score All'}
              </button>

              {showSaveInput ? (
                <div className="flex items-center gap-2">
                  <input
                    className="input w-40"
                    placeholder="Set name…"
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
                    {saveLoading ? '…' : 'Save'}
                  </button>
                  <button onClick={() => setShowSaveInput(false)} className="btn-icon">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSaveInput(true)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Set
                </button>
              )}
            </>
          )}
        </div>

        {selectedChar && (
          <p className="w-full text-[10px] font-display uppercase tracking-wider text-ww-muted/50 text-right -mt-1">
            <kbd className="bg-ww-border-glow text-ww-muted rounded px-1.5 py-0.5 font-mono text-[10px]">Ctrl+V</kbd>
            {' '}paste advances target slot
          </p>
        )}
      </section>

      {/* Load panel */}
      {showLoadPanel && (
        <section className="panel-tech p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="section-label flex items-center gap-2">
              <FolderOpen className="w-4 h-4" /> Saved Sets
              <span className="text-ww-muted ml-2 normal-case tracking-normal">({savedSets.length})</span>
            </h3>
            <button onClick={() => setShowLoadPanel(false)} className="text-ww-muted hover:text-ww-cyan">
              <X className="w-4 h-4" />
            </button>
          </div>

          {savedSets.length === 0 ? (
            <p className="text-ww-muted text-sm text-center py-4 font-display uppercase tracking-wider">
              No saved sets yet
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
              {savedSets.map(s => {
                const setColor = s.set_score != null ? TIER_COLOR[getTierLabel(s.set_score)] ?? '#67e8f9' : '#94a3b8'
                return (
                  <div
                    key={s.id}
                    className="flex flex-col gap-2 p-3 rounded-md bg-ww-bg-deep/60 border border-ww-border hover:border-ww-cyan/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="font-display font-semibold text-sm text-ww-text truncate leading-tight tracking-wide">{s.name}</p>
                        <p className="text-[11px] text-ww-muted truncate mt-0.5 font-display uppercase tracking-wider">
                          {s.character_name ?? 'Unknown'} · ER {s.total_er ?? '?'}%
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteSet(s.id, s.name)}
                        className="text-ww-muted/40 hover:text-red-400 transition-colors p-0.5 shrink-0 mt-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-auto">
                      {s.set_score != null ? (
                        <span
                          className="readout text-[10px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border leading-none"
                          style={{ color: setColor, borderColor: `${setColor}66`, background: `${setColor}15` }}
                        >
                          {s.set_tier} · {s.set_score.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-ww-muted/50 font-display uppercase tracking-wider">unscored</span>
                      )}
                      <button
                        onClick={() => handleLoadSet(s)}
                        className="btn-primary text-[10px] px-3 py-1 leading-none shrink-0"
                      >
                        Load
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* Set summary */}
      <SetSummary slots={slots} charName={selectedChar?.name ?? null} />

      {/* 5 echo slots */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
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
            onEdit={() => setEditingSlot(idx)}
          />
        ))}
      </div>

      {!selectedChar && (
        <div className="panel-tech text-center py-12">
          <div className="mx-auto w-12 h-12 mb-3 rounded-md border border-ww-cyan/40 bg-ww-cyan/5 flex items-center justify-center text-ww-cyan animate-pulse-glow">
            ◆
          </div>
          <p className="text-ww-muted font-display uppercase tracking-[0.15em]">Select a Resonator to begin set calibration</p>
        </div>
      )}

      {/* Manual sub-stat entry dialog — for when OCR can't read a screenshot */}
      {editingSlot !== null && selectedChar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setEditingSlot(null)}
        >
          <div
            className="w-full max-w-md max-h-[90vh] overflow-y-auto space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="panel-tech p-4 flex items-center justify-between">
              <h3 className="section-label flex items-center gap-2">
                <Pencil className="w-4 h-4" /> Slot {editingSlot + 1} · Manual Entry
              </h3>
              <button onClick={() => setEditingSlot(null)} className="text-ww-muted hover:text-ww-cyan">
                <X className="w-4 h-4" />
              </button>
            </div>

            <StatsEditor
              echoInfo={{ echo_name: slots[editingSlot].echoName, echo_cost: slots[editingSlot].echoCost }}
              subStats={slots[editingSlot].subStats}
              charWeights={charWeights ?? undefined}
              subStatRolls={subStatRolls}
              onEchoInfoChange={info =>
                updateSlot(editingSlot, { echoName: info.echo_name, echoCost: info.echo_cost, scoreResult: null })
              }
              onSubStatsChange={stats => updateSlot(editingSlot, { subStats: stats, scoreResult: null })}
            />

            <button onClick={() => setEditingSlot(null)} className="btn-primary w-full">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
