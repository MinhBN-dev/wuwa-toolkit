import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCharacters } from '../services/api'
import type { Character } from '../types/echo'
import {
  getBaseName,
  getCharacterIcon,
  loadBuildStatuses,
  saveBuildStatus,
  BUILD_STATUS_META,
  BUILD_STATUS_CYCLE,
  type BuildStatus,
} from '../utils/character'

const ELEMENT_COLORS: Record<string, string> = {
  Glacio:  'text-sky-300  border-sky-500/40  bg-sky-500/10',
  Fusion:  'text-orange-300 border-orange-500/40 bg-orange-500/10',
  Electro: 'text-purple-300 border-purple-500/40 bg-purple-500/10',
  Aero:    'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  Spectro: 'text-yellow-200 border-yellow-400/40 bg-yellow-400/10',
  Havoc:   'text-rose-300  border-rose-500/40  bg-rose-500/10',
}

/** Deduplicate characters by base name, keeping the first entry per base name. */
function deduplicateByBase(characters: Character[]): Character[] {
  const seen = new Set<string>()
  return characters.filter(c => {
    const base = getBaseName(c.name)
    if (seen.has(base)) return false
    seen.add(base)
    return true
  })
}

const FILTER_ELEMENTS = ['All', 'Glacio', 'Fusion', 'Electro', 'Aero', 'Spectro', 'Havoc']
const FILTER_STATUSES: Array<{ value: BuildStatus | 'all'; label: string }> = [
  { value: 'all',      label: 'All' },
  { value: 'built',    label: 'Built' },
  { value: 'building', label: 'Building' },
  { value: 'not_built', label: 'Not Built' },
]

export default function CharactersPage() {
  const { data: characters = [] } = useQuery({
    queryKey: ['characters'],
    queryFn: getCharacters,
  })

  const [statuses, setStatuses] = useState<Record<string, BuildStatus>>(loadBuildStatuses)
  const [filterElement, setFilterElement] = useState('All')
  const [filterStatus, setFilterStatus] = useState<BuildStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  // Keep statuses in sync with localStorage when another tab changes it
  useEffect(() => {
    const handler = () => setStatuses(loadBuildStatuses())
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const unique = deduplicateByBase(characters)

  const filtered = unique.filter(c => {
    const base = getBaseName(c.name)
    if (filterElement !== 'All' && c.element !== filterElement) return false
    if (filterStatus !== 'all' && (statuses[base] ?? 'not_built') !== filterStatus) return false
    if (search && !base.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const cycleStatus = (baseName: string) => {
    const current = statuses[baseName] ?? 'not_built'
    const next = BUILD_STATUS_CYCLE[(BUILD_STATUS_CYCLE.indexOf(current) + 1) % BUILD_STATUS_CYCLE.length]
    saveBuildStatus(baseName, next)
    setStatuses(prev => ({ ...prev, [baseName]: next }))
  }

  // Summary counts
  const builtCount    = unique.filter(c => (statuses[getBaseName(c.name)] ?? 'not_built') === 'built').length
  const buildingCount = unique.filter(c => (statuses[getBaseName(c.name)] ?? 'not_built') === 'building').length

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {/* Header + summary */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-ww-text">
          Characters
          <span className="text-ww-muted text-sm font-normal ml-2">({unique.length} total)</span>
        </h2>
        <div className="flex gap-3 text-sm">
          <span className="text-tier-B font-medium">{builtCount} Built</span>
          <span className="text-yellow-400 font-medium">{buildingCount} Building</span>
          <span className="text-ww-muted">{unique.length - builtCount - buildingCount} Not Built</span>
        </div>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap gap-3 items-center">
        {/* Search */}
        <input
          className="input flex-1 min-w-40"
          placeholder="Search character..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* Element filter */}
        <div className="flex flex-wrap gap-1">
          {FILTER_ELEMENTS.map(el => (
            <button
              key={el}
              onClick={() => setFilterElement(el)}
              className={`px-2 h-7 rounded text-xs font-semibold border transition-all ${
                filterElement === el
                  ? el === 'All'
                    ? 'bg-ww-accent/20 border-ww-accent text-ww-accent'
                    : ELEMENT_COLORS[el]
                  : 'border-ww-border text-ww-muted hover:border-ww-accent/50'
              }`}
            >
              {el}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1">
          {FILTER_STATUSES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilterStatus(value)}
              className={`px-2 h-7 rounded text-xs font-semibold border transition-all ${
                filterStatus === value
                  ? value === 'all'
                    ? 'bg-ww-accent/20 border-ww-accent text-ww-accent'
                    : value === 'built'
                      ? 'bg-tier-B/20 border-tier-B text-tier-B'
                      : value === 'building'
                        ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                        : 'bg-ww-border/40 border-ww-border text-ww-muted'
                  : 'border-ww-border text-ww-muted hover:border-ww-accent/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-ww-muted">No characters match the filter.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {filtered.map(c => {
            const base = getBaseName(c.name)
            const status = statuses[base] ?? 'not_built'
            const meta = BUILD_STATUS_META[status]
            const elColor = ELEMENT_COLORS[c.element] ?? 'text-ww-muted border-ww-border'

            return (
              <div
                key={base}
                className="card p-3 flex flex-col items-center gap-2 cursor-pointer hover:border-ww-accent/50 transition-all select-none"
                onClick={() => cycleStatus(base)}
                title={`Click to cycle status — current: ${meta.label}`}
              >
                {/* Icon */}
                <div className={`w-16 h-16 rounded-full overflow-hidden border-2 ${meta.color} transition-all`}>
                  <img
                    src={getCharacterIcon(c.name)}
                    alt={base}
                    className="w-full h-full object-cover"
                    onError={e => {
                      // Fallback: colored circle with initial
                      const t = e.currentTarget
                      t.style.display = 'none'
                      t.parentElement!.classList.add('flex', 'items-center', 'justify-center', 'bg-ww-border', 'text-ww-muted', 'text-lg', 'font-bold')
                      t.parentElement!.textContent = base[0]
                    }}
                  />
                </div>

                {/* Name */}
                <span className="text-xs font-medium text-ww-text text-center leading-tight line-clamp-2">
                  {base}
                </span>

                {/* Element badge */}
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${elColor}`}>
                  {c.element}
                </span>

                {/* Build status badge */}
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${meta.color}`}>
                  {meta.label}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-ww-muted text-center">
        Click a character card to cycle build status · Status saved in browser
      </p>
    </div>
  )
}
