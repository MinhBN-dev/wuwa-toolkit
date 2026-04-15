import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import EchoCard from '../components/EchoCard'
import { getEchoes, getCharacters, deleteEcho } from '../services/api'
import { TIER_THRESHOLDS, getTierLabel, getTierClass } from '../utils/tier'

// All 7 EVC tier labels in descending order
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
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ww-text">
          Saved Echoes
          {echoData && <span className="text-ww-muted text-sm font-normal ml-2">({echoData.total} total)</span>}
        </h2>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-48">
          <Search className="w-4 h-4 text-ww-muted shrink-0" />
          <input
            className="input"
            placeholder="Search by echo name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select
          className="select w-52"
          value={selectedChar}
          onChange={e => setSelectedChar(e.target.value)}
        >
          <option value="">All Characters</option>
          {characters.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <div className="flex flex-wrap gap-1">
          {TIER_LABELS.map(label => {
            const active = selectedTier === label
            const colorClass = active ? getTierClass(label) : 'border-ww-border text-ww-muted hover:border-ww-accent/50'
            return (
              <button
                key={label}
                onClick={() => setSelectedTier(label === selectedTier ? '' : label)}
                className={`px-2 h-7 rounded text-xs font-semibold border transition-all whitespace-nowrap ${colorClass}`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="text-center py-16 text-ww-muted">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-ww-muted">
          <p className="text-lg">No echoes saved yet</p>
          <p className="text-sm mt-1">Go to the Analyze tab to score and save echoes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
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
