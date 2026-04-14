import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import EchoCard from '../components/EchoCard'
import { getEchoes, getCharacters, deleteEcho } from '../services/api'

const TIERS = ['S', 'A', 'B', 'C', 'D']

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
    if (selectedTier && e.tier !== selectedTier) return false
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

        <div className="flex gap-1">
          {TIERS.map(t => (
            <button
              key={t}
              onClick={() => setSelectedTier(t === selectedTier ? '' : t)}
              className={`w-8 h-8 rounded text-xs font-bold border transition-all ${
                selectedTier === t
                  ? t === 'S' ? 'bg-tier-S/20 border-tier-S text-tier-S' :
                    t === 'A' ? 'bg-tier-A/20 border-tier-A text-tier-A' :
                    t === 'B' ? 'bg-tier-B/20 border-tier-B text-tier-B' :
                    t === 'C' ? 'bg-tier-C/20 border-tier-C text-tier-C' :
                    'bg-tier-D/20 border-tier-D text-tier-D'
                  : 'border-ww-border text-ww-muted hover:border-ww-accent/50'
              }`}
            >
              {t}
            </button>
          ))}
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
