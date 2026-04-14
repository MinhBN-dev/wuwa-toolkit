import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, RefreshCw, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import EchoUploader from '../components/EchoUploader'
import StatsEditor from '../components/StatsEditor'
import ScoreDisplay from '../components/ScoreDisplay'
import ErInfo from '../components/ErInfo'
import { getCharacters, getGameData, calculateScore, createEcho } from '../services/api'
import type { OcrResult, ScoreResponse, SubStat, Character } from '../types/echo'

interface EchoInfo {
  echo_name: string
  echo_cost: number
}

const DEFAULT_ECHO_INFO: EchoInfo = { echo_name: '', echo_cost: 4 }

/** Build the full sub-stat slot list for a character — ALL stats with weight > 0, sorted by weight desc */
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

/** Snap an OCR value to the nearest valid roll value for that stat type */
function snapToRoll(value: number, rolls: number[]): number {
  if (!rolls.length) return value
  return rolls.reduce((best, r) => Math.abs(r - value) < Math.abs(best - value) ? r : best)
}

export default function HomePage() {
  const qc = useQueryClient()
  const [echoInfo, setEchoInfo] = useState<EchoInfo>(DEFAULT_ECHO_INFO)
  const [subStats, setSubStats] = useState<SubStat[]>([])
  const [selectedChar, setSelectedChar] = useState<Character | null>(null)
  const [totalER, setTotalER] = useState<string>('100')
  const [scoreResult, setScoreResult] = useState<ScoreResponse | null>(null)

  const { data: characters = [] } = useQuery({
    queryKey: ['characters'],
    queryFn: getCharacters,
  })

  const { data: gameData } = useQuery({
    queryKey: ['game-data'],
    queryFn: getGameData,
  })

  const scoreMut = useMutation({
    mutationFn: calculateScore,
    onSuccess: (data) => setScoreResult(data),
    onError: () => toast.error('Failed to calculate score'),
  })

  const saveMut = useMutation({
    mutationFn: createEcho,
    onSuccess: () => {
      toast.success('Echo saved!')
      qc.invalidateQueries({ queryKey: ['echoes'] })
    },
    onError: () => toast.error('Failed to save echo'),
  })

  const charWeights = selectedChar && gameData
    ? (gameData.character_weights[selectedChar.name] ?? null)
    : null

  const handleCharacterChange = (char: Character | null) => {
    setSelectedChar(char)
    setScoreResult(null)
    setSubStats(char && gameData ? defaultSubStatsForChar(char.name, gameData.character_weights) : [])
  }

  const handleExtracted = (result: OcrResult) => {
    setEchoInfo(prev => ({
      ...prev,
      echo_name: result.echo_name,
      echo_cost: result.echo_cost ?? prev.echo_cost,
    }))

    const rolls = gameData?.sub_stat_rolls ?? {}

    // Merge OCR values into pre-populated slots, snapping to nearest valid roll value
    if (subStats.length > 0) {
      const ocrMap = new Map(result.sub_stats.map(s => [s.type, s.value]))
      const merged = subStats.map(s => {
        const raw = ocrMap.get(s.type)
        if (raw === undefined) return { ...s, value: 0 }
        const statRolls = rolls[s.type]
        return { ...s, value: statRolls ? snapToRoll(raw, statRolls) : raw }
      })
      // Append any OCR stats not in the pre-populated list
      for (const ocrStat of result.sub_stats) {
        if (!merged.some(s => s.type === ocrStat.type)) {
          const statRolls = rolls[ocrStat.type]
          const snapped = statRolls ? snapToRoll(ocrStat.value, statRolls) : ocrStat.value
          merged.push({ type: ocrStat.type, value: snapped })
        }
      }
      setSubStats(merged)
    } else {
      const snapped = result.sub_stats.map(s => {
        const statRolls = rolls[s.type]
        return { ...s, value: statRolls ? snapToRoll(s.value, statRolls) : s.value }
      })
      setSubStats(snapped)
    }

    setScoreResult(null)
  }

  // Only score stats that have value AND are relevant to the character (have weight)
  const activeSubStats = subStats.filter(s =>
    s.value > 0 && (!charWeights || charWeights[s.type] !== undefined)
  )
  const totalERNum = parseFloat(totalER) || 100

  const handleCalculate = () => {
    if (activeSubStats.length === 0) {
      toast.warning('Chưa có sub-stat nào có giá trị')
      return
    }
    scoreMut.mutate({
      character_id: selectedChar?.id,
      character_name: selectedChar?.name,
      echo_cost: echoInfo.echo_cost,
      sub_stats: activeSubStats,
      total_er: totalERNum,
    })
  }

  const handleSave = () => {
    if (!echoInfo.echo_name.trim()) {
      toast.warning('Please enter an echo name')
      return
    }
    saveMut.mutate({
      character_id: selectedChar?.id,
      echo_name: echoInfo.echo_name,
      echo_cost: echoInfo.echo_cost,
      sub_stats: activeSubStats,
      total_er: totalERNum,
      score: scoreResult?.score,
      score_percent: scoreResult?.score_percent,
      tier: scoreResult?.tier,
    })
  }

  const handleReset = () => {
    setEchoInfo(DEFAULT_ECHO_INFO)
    setSubStats(selectedChar && gameData ? defaultSubStatsForChar(selectedChar.name, gameData.character_weights) : [])
    setScoreResult(null)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: Character selector + Upload */}
        <div className="space-y-4">
          <div className="card space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-ww-accent">Resonator</h3>
            <select
              className="select"
              value={selectedChar?.id ?? ''}
              onChange={e => handleCharacterChange(characters.find(c => c.id === e.target.value) ?? null)}
            >
              <option value="">— Chọn Resonator trước —</option>
              {characters.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.element} · {c.role})
                </option>
              ))}
            </select>

            {selectedChar && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-ww-muted block mb-1">Total ER% of build</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="input"
                    value={totalER}
                    onChange={e => setTotalER(e.target.value)}
                    placeholder="e.g. 132.0"
                  />
                </div>
                {gameData?.character_er[selectedChar.name] && (
                  <ErInfo er={gameData.character_er[selectedChar.name]} totalER={totalER} />
                )}
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="font-semibold text-ww-text mb-3">Upload Echo Screenshot</h2>
            <EchoUploader
              onExtracted={handleExtracted}
              blockedReason={!selectedChar ? 'Chọn Resonator trước để import echo' : undefined}
            />
          </div>
        </div>

        {/* Middle: Stats Editor */}
        <div>
          <StatsEditor
            echoInfo={echoInfo}
            subStats={subStats}
            charWeights={charWeights ?? undefined}
            subStatRolls={gameData?.sub_stat_rolls}
            onEchoInfoChange={setEchoInfo}
            onSubStatsChange={setSubStats}
          />
        </div>

        {/* Right: Score + Actions */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={handleCalculate}
              disabled={scoreMut.isPending || activeSubStats.length === 0 || !selectedChar}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${scoreMut.isPending ? 'animate-spin' : ''}`} />
              {scoreMut.isPending ? 'Calculating...' : 'Calculate Score'}
            </button>
            <button onClick={handleReset} className="btn-secondary px-3" title="Reset">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {scoreResult && <ScoreDisplay score={scoreResult} />}

          {scoreResult && (
            <button
              onClick={handleSave}
              disabled={saveMut.isPending}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saveMut.isPending ? 'Saving...' : 'Save Echo'}
            </button>
          )}

          {!scoreResult && (
            <div className="card text-center py-8">
              <p className="text-ww-muted text-sm">
                {!selectedChar
                  ? 'Chọn resonator, sau đó paste ảnh echo'
                  : 'Paste ảnh echo hoặc nhập thủ công,\nrồi nhấn "Calculate Score"'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
