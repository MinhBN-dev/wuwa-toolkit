import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Library } from 'lucide-react'
import { toast } from 'sonner'
import EchoCard from '../components/EchoCard'
import { getEchoes, getCharacters, deleteEcho } from '../services/api'
import { TIER_THRESHOLDS, getTierLabel, getTierClass } from '../utils/tier'

const TIER_LABELS = TIER_THRESHOLDS.map(([, label]) => label)

export default function SavedPage() {
  const qc = useQueryClient()
  const [selectedChar, setSelectedChar] = useState('')
  const [selectedTier, setSelectedTier] = useState('')
  const [search, setSearch] = useState('')

  const { data: echoData, isLoading } = useQuery({
    queryKey: ['echoes', selectedChar],
    queryFn: () => getEchoes({ character_id: selectedChar || undefined, limit: 200 }),
  })

  const { data: characters = [] } = useQuery({
    queryKey: ['characters'],
    queryFn: getCharacters,
  })

  const deleteMut = useMutation({
    mutationFn: deleteEcho,
    onSuccess: () => {
      toast.success('Echo deleted')
      qc.invalidateQueries({ queryKey: ['echoes'] })
    },
    onError: () => toast.error('Failed to delete'),
  })

  const filtered = (echoData?.echoes ?? []).filter(e => {
    if (selectedTier) {
      const echoTierLabel = e.score_percent != null ? getTierLabel(e.score_percent) : 'Unbuilt'
      if (echoTierLabel !== selectedTier) return false
    }
    if (search && !e.echo_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5 animate-fade-up">
      {/* Hero */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="section-label mb-1">Echo Archive</p>
          <h1 className="font-display font-bold text-3xl uppercase tracking-[0.15em] text-ww-text flex items-center gap-3">
            <Library className="w-7 h-7 text-ww-cyan" />
            <span>Saved <span className="text-ww-cyan text-glow-cyan">Echoes</span></span>
          </h1>
        </div>
        {echoData && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-ww-cyan/30 bg-ww-cyan/5">
            <span className="readout text-xl text-ww-cyan">{echoData.total}</span>
            <span className="font-display uppercase tracking-wider text-xs text-ww-muted">Total</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <section className="panel-tech p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-48">
          <Search className="w-4 h-4 text-ww-muted shrink-0" />
          <input
            className="input"
            placeholder="Search by echo name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select
          className="select w-52"
          value={selectedChar}
          onChange={e => setSelectedChar(e.target.value)}
        >
          <option value="">All Resonators</option>
          {characters.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <div className="flex flex-wrap gap-1">
          {TIER_LABELS.map(label => {
            const active = selectedTier === label
            const colorClass = active
              ? `${getTierClass(label)} shadow-glow-cyan`
              : 'border-ww-border text-ww-muted hover:border-ww-cyan/60 hover:text-ww-text'
            return (
              <button
                key={label}
                onClick={() => setSelectedTier(label === selectedTier ? '' : label)}
                className={`px-2.5 h-7 rounded text-[10px] font-display font-bold uppercase tracking-wider border transition-all whitespace-nowrap ${colorClass}`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </section>

      {/* Grid */}
      {isLoading ? (
        <div className="text-center py-16 text-ww-muted font-display uppercase tracking-wider">
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel-tech text-center py-16">
          <div className="mx-auto w-12 h-12 mb-3 rounded-md border border-ww-cyan/40 bg-ww-cyan/5 flex items-center justify-center text-ww-cyan animate-pulse-glow">
            ◆
          </div>
          <p className="font-display uppercase tracking-[0.18em] text-ww-text">No echoes saved</p>
          <p className="text-sm mt-1 text-ww-muted">Go to Analyze to score and save echoes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map(echo => (
            <EchoCard
              key={echo.id}
              echo={echo}
              onDelete={id => deleteMut.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
