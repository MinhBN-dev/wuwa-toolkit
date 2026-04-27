import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, X, Users } from 'lucide-react'
import { getCharacters, getCharacterProfiles, upsertCharacterProfile, bulkUpsertCharacterProfiles } from '../services/api'
import type { Character } from '../types/echo'
import {
  getBaseName,
  getCharacterIcon,
  loadBuildStatuses,
  loadNotes,
  BUILD_STATUS_META,
  BUILD_STATUS_CYCLE,
  type BuildStatus,
} from '../utils/character'

const ELEMENT_COLOR: Record<string, string> = {
  Glacio:  '#7dd3fc',
  Fusion:  '#f97316',
  Electro: '#a855f7',
  Aero:    '#34d399',
  Spectro: '#facc15',
  Havoc:   '#e879f9',
}

const STATUS_COLOR: Record<BuildStatus, string> = {
  built:     '#60a5fa',
  building:  '#facc15',
  not_built: '#475569',
}

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
  const queryClient = useQueryClient()
  const syncedRef = useRef(false)

  const { data: characters = [] } = useQuery({
    queryKey: ['characters'],
    queryFn: getCharacters,
  })

  const { data: serverProfiles = {}, isSuccess: profilesLoaded } = useQuery({
    queryKey: ['character-profiles'],
    queryFn: getCharacterProfiles,
  })

  const statuses: Record<string, BuildStatus> = {}
  const notes: Record<string, string> = {}
  for (const [name, p] of Object.entries(serverProfiles)) {
    statuses[name] = (p.build_status as BuildStatus) ?? 'not_built'
    if (p.notes) notes[name] = p.notes
  }

  useEffect(() => {
    if (!profilesLoaded || syncedRef.current) return
    syncedRef.current = true

    const serverHasData = Object.keys(serverProfiles).length > 0
    if (serverHasData) return

    const lsStatuses = loadBuildStatuses()
    const lsNotes = loadNotes()

    const allNames = new Set([...Object.keys(lsStatuses), ...Object.keys(lsNotes)])
    if (allNames.size === 0) return

    const bulk: Record<string, { build_status: string; notes?: string | null }> = {}
    for (const name of allNames) {
      const status = lsStatuses[name] ?? 'not_built'
      const note = lsNotes[name] ?? null
      if (status !== 'not_built' || note) {
        bulk[name] = { build_status: status, notes: note }
      }
    }

    if (Object.keys(bulk).length > 0) {
      bulkUpsertCharacterProfiles(bulk).then(() => {
        queryClient.invalidateQueries({ queryKey: ['character-profiles'] })
      })
    }
  }, [profilesLoaded, serverProfiles, queryClient])

  const upsertMutation = useMutation({
    mutationFn: ({ name, build_status, notes }: { name: string; build_status: string; notes?: string | null }) =>
      upsertCharacterProfile(name, { build_status, notes }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['character-profiles'] }),
  })

  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [draftNote, setDraftNote] = useState('')
  const [filterElement, setFilterElement] = useState('All')
  const [filterStatus, setFilterStatus] = useState<BuildStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  const unique = deduplicateByBase(characters)

  const filtered = unique.filter(c => {
    const base = getBaseName(c.name)
    if (filterElement !== 'All' && c.element !== filterElement) return false
    if (filterStatus !== 'all' && (statuses[base] ?? 'not_built') !== filterStatus) return false
    if (search && !base.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const cycleStatus = (baseName: string) => {
    const current = (statuses[baseName] ?? 'not_built') as BuildStatus
    const next = BUILD_STATUS_CYCLE[(BUILD_STATUS_CYCLE.indexOf(current) + 1) % BUILD_STATUS_CYCLE.length]
    upsertMutation.mutate({ name: baseName, build_status: next, notes: notes[baseName] ?? null })
  }

  const openNote = (e: React.MouseEvent, baseName: string) => {
    e.stopPropagation()
    setDraftNote(notes[baseName] ?? '')
    setEditingNote(baseName)
  }

  const commitNote = (baseName: string) => {
    const trimmed = draftNote.trim()
    upsertMutation.mutate({
      name: baseName,
      build_status: statuses[baseName] ?? 'not_built',
      notes: trimmed || null,
    })
    setEditingNote(null)
  }

  const builtCount    = unique.filter(c => (statuses[getBaseName(c.name)] ?? 'not_built') === 'built').length
  const buildingCount = unique.filter(c => (statuses[getBaseName(c.name)] ?? 'not_built') === 'building').length
  const notBuiltCount = unique.length - builtCount - buildingCount

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5 animate-fade-up">
      {/* Hero */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="section-label mb-1">Resonator Roster</p>
          <h1 className="font-display font-bold text-3xl uppercase tracking-[0.15em] text-ww-text flex items-center gap-3">
            <Users className="w-7 h-7 text-ww-cyan" />
            <span>Resonator <span className="text-ww-cyan text-glow-cyan">Index</span></span>
          </h1>
          <p className="text-ww-muted text-sm mt-1">Track build status and personal notes per resonator.</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Stat label="Total" value={unique.length} color="#67e8f9" />
          <Stat label="Built" value={builtCount} color="#60a5fa" />
          <Stat label="Building" value={buildingCount} color="#facc15" />
          <Stat label="Pending" value={notBuiltCount} color="#8b949e" />
        </div>
      </div>

      {/* Filters */}
      <section className="panel-tech p-4 flex flex-wrap gap-3 items-center">
        <input
          className="input flex-1 min-w-40"
          placeholder="Search resonator…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <div className="flex flex-wrap gap-1">
          {FILTER_ELEMENTS.map(el => {
            const active = filterElement === el
            const color = el === 'All' ? '#e8a045' : (ELEMENT_COLOR[el] ?? '#67e8f9')
            return (
              <button
                key={el}
                onClick={() => setFilterElement(el)}
                className="px-2.5 h-7 rounded text-[10px] font-display font-bold uppercase tracking-wider border transition-all whitespace-nowrap"
                style={
                  active
                    ? { color, background: `${color}15`, borderColor: `${color}66`, boxShadow: `0 0 10px ${color}50` }
                    : { color: '#8b949e', borderColor: '#2a3142' }
                }
              >
                {el}
              </button>
            )
          })}
        </div>

        <div className="flex gap-1">
          {FILTER_STATUSES.map(({ value, label }) => {
            const active = filterStatus === value
            const color =
              value === 'all' ? '#e8a045' :
              value === 'built' ? STATUS_COLOR.built :
              value === 'building' ? STATUS_COLOR.building :
              STATUS_COLOR.not_built
            return (
              <button
                key={value}
                onClick={() => setFilterStatus(value)}
                className="px-2.5 h-7 rounded text-[10px] font-display font-bold uppercase tracking-wider border transition-all"
                style={
                  active
                    ? { color, background: `${color}15`, borderColor: `${color}66`, boxShadow: `0 0 10px ${color}50` }
                    : { color: '#8b949e', borderColor: '#2a3142' }
                }
              >
                {label}
              </button>
            )
          })}
        </div>
      </section>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="panel-tech text-center py-16 text-ww-muted font-display uppercase tracking-wider">
          No resonators match the filter.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {filtered.map(c => {
            const base = getBaseName(c.name)
            const status = (statuses[base] ?? 'not_built') as BuildStatus
            const meta = BUILD_STATUS_META[status]
            const elColor = ELEMENT_COLOR[c.element] ?? '#67e8f9'
            const stColor = STATUS_COLOR[status]
            const note = notes[base] ?? ''
            const isEditing = editingNote === base

            return (
              <div
                key={base}
                className="panel-tech p-3 flex flex-col items-center gap-2 transition-all hover:-translate-y-0.5 group"
                style={{
                  boxShadow: status === 'built'
                    ? `0 4px 16px rgba(96,165,250,0.15)`
                    : status === 'building'
                      ? `0 4px 16px rgba(250,204,21,0.12)`
                      : '0 4px 12px rgba(0,0,0,0.25)',
                }}
              >
                {/* Portrait with element ring */}
                <div className="relative">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(${elColor} 0deg, ${elColor}55 120deg, transparent 240deg, ${elColor} 360deg)`,
                      padding: '2px',
                      filter: 'blur(0.5px)',
                    }}
                  />
                  <div
                    className="relative w-16 h-16 rounded-full overflow-hidden cursor-pointer select-none transition-transform group-hover:scale-105"
                    style={{ border: `2px solid ${stColor}`, boxShadow: `inset 0 0 0 1px rgba(0,0,0,0.5), 0 0 12px ${stColor}40` }}
                    onClick={() => cycleStatus(base)}
                    title={`Click to cycle: ${meta.label}`}
                  >
                    <img
                      src={getCharacterIcon(c.name)}
                      alt={base}
                      className="w-full h-full object-cover"
                      onError={e => {
                        const t = e.currentTarget
                        t.style.display = 'none'
                        t.parentElement!.classList.add('flex', 'items-center', 'justify-center', 'bg-ww-bg-deep', 'text-ww-cyan', 'text-lg', 'font-bold', 'font-display')
                        t.parentElement!.textContent = base[0]
                      }}
                    />
                  </div>
                </div>

                {/* Name */}
                <span className="font-display text-xs font-medium text-ww-text text-center leading-tight line-clamp-2 select-none tracking-wide">
                  {base}
                </span>

                {/* Element + status badges */}
                <span
                  className="text-[10px] font-display uppercase tracking-wider px-1.5 py-0.5 rounded border leading-none"
                  style={{ color: elColor, borderColor: `${elColor}55`, background: `${elColor}10` }}
                >
                  {c.element}
                </span>
                <span
                  className="text-[10px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border leading-none cursor-pointer select-none"
                  style={{ color: stColor, borderColor: `${stColor}66`, background: `${stColor}15` }}
                  onClick={() => cycleStatus(base)}
                >
                  {meta.label}
                </span>

                {/* Note */}
                {isEditing ? (
                  <div className="w-full" onClick={e => e.stopPropagation()}>
                    <textarea
                      autoFocus
                      rows={3}
                      className="input w-full text-[11px] resize-none"
                      placeholder="Notes…"
                      value={draftNote}
                      onChange={e => setDraftNote(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Escape') setEditingNote(null)
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitNote(base) }
                      }}
                    />
                    <div className="flex gap-1 mt-1">
                      <button
                        className="btn-primary flex-1 text-[10px] py-0.5 px-2"
                        onClick={() => commitNote(base)}
                      >Save</button>
                      <button
                        className="btn-icon p-1"
                        onClick={e => { e.stopPropagation(); setEditingNote(null) }}
                      ><X className="w-3 h-3" /></button>
                    </div>
                  </div>
                ) : (
                  <button
                    className={`w-full flex items-start gap-1 text-left rounded px-1.5 py-1 text-[10px] leading-snug border transition-all ${
                      note
                        ? 'border-ww-cyan/30 text-ww-muted hover:border-ww-cyan/60 hover:text-ww-text'
                        : 'border-dashed border-ww-border text-ww-border hover:border-ww-cyan/40 hover:text-ww-muted'
                    }`}
                    onClick={e => openNote(e, base)}
                    title="Add / edit note"
                  >
                    <Pencil className="w-2.5 h-2.5 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{note || 'Add note…'}</span>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[10px] text-ww-muted/60 text-center font-display uppercase tracking-[0.18em]">
        Click portrait or status badge to cycle · Click note area to edit · Server-synced
      </p>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-md border"
      style={{ borderColor: `${color}40`, background: `${color}08` }}
    >
      <span className="readout text-lg" style={{ color }}>{value}</span>
      <span className="font-display uppercase tracking-wider text-[10px] text-ww-muted">{label}</span>
    </div>
  )
}
