import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sparkles, AlertTriangle, ExternalLink } from 'lucide-react'
import { getBuffs } from '../services/api'
import type { BuffCharacter, BuffEntry } from '../types/echo'
import { getCharacterIcon } from '../utils/character'

const ELEMENT_COLOR: Record<string, string> = {
  Glacio:  '#7dd3fc',
  Fusion:  '#f97316',
  Electro: '#a855f7',
  Aero:    '#34d399',
  Spectro: '#facc15',
  Havoc:   '#e879f9',
}

const TARGET_LABEL: Record<string, string> = {
  team:  'Toàn đội',
  next:  'Nhân vật vào sân',
  enemy: 'Debuff địch',
  self:  'Bản thân',
}

/** Cột hẹp → rút gọn tên phạm vi cho vừa; tên đầy đủ vẫn nằm trong tooltip. */
const SCOPE_SHORT: Record<string, string> = {
  'All-Type': 'All',
  'All-Attribute': 'All-Attr',
  'Resonance Skill': 'Res. Skill',
  'Resonance Liberation': 'Res. Lib',
  'Basic Attack': 'Basic Atk',
  'Heavy Attack': 'Heavy Atk',
  'Coordinated Attack': 'Coord. Atk',
  'Spectro Frazzle': 'Frazzle',
  'Aero Erosion': 'Erosion',
  'Negative Status': 'Neg. Status',
  'Resonance Energy': 'Res. Energy',
  'Crowd Control': 'CC',
}

/** Chiều rộng tối thiểu của 1 cột nhân vật (px) — ít nhân vật thì cột tự giãn ra. */
const COL_MIN = 94
const LABEL_COL = 140

const LS_KEY = 'buff_table_prefs'

type Prefs = {
  hidden: string[]
  /** character name → resonance chain level; 0 / missing = không dùng trấn */
  rc: Record<string, number>
  hideEmpty: boolean
}

function loadPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')
    return {
      hidden: Array.isArray(raw.hidden) ? raw.hidden : [],
      rc: typeof raw.rc === 'object' && raw.rc ? raw.rc : {},
      hideEmpty: raw.hideEmpty !== false,
    }
  } catch {
    return { hidden: [], rc: {}, hideEmpty: true }
  }
}

/** Bảng luôn ở S0: chỉ lấy kit gốc (`seq === 0`). Tick "Trấn" thêm toàn bộ stat của
 *  vũ khí trấn ở R1 (gồm cả stat riêng của người cầm). Buff cung mệnh (`seq > 0`)
 *  KHÔNG vào bảng — chỉ hiển thị tham khảo ở panel chi tiết. */
function activeEntries(char: BuffCharacter, weaponOn: boolean): BuffEntry[] {
  const kit = char.buffs.filter(b => b.seq === 0)
  if (!weaponOn || !char.weapon) return kit
  return [...kit, ...char.weapon.buffs]
}

/** Entry đến từ vũ khí trấn (để gắn badge R1 trên UI). */
function isWeaponEntry(char: BuffCharacter, e: BuffEntry): boolean {
  return !!char.weapon && char.weapon.buffs.includes(e)
}

/** Sum of a cell's numeric entries. An entry flagged `replaces` supersedes the base
 *  value of the same category instead of stacking on top of it. */
function cellTotal(entries: BuffEntry[]): number | null {
  const numeric = entries.filter(e => e.value != null)
  if (numeric.length === 0) return null
  const replacer = numeric.filter(e => e.replaces).sort((a, b) => b.seq - a.seq)[0]
  if (!replacer) return numeric.reduce((sum, e) => sum + (e.value ?? 0), 0)
  return numeric
    .filter(e => !e.replaces && e.seq !== 0)
    .reduce((sum, e) => sum + (e.value ?? 0), replacer.value ?? 0)
}

/** Buffs only add up within the same scope — 20% Glacio and 25% Resonance Skill are
 *  two different multipliers, so each `applies_to` gets its own subtotal in the cell. */
function groupByScope(entries: BuffEntry[]): [string, BuffEntry[]][] {
  // Khoá gồm cả `target`: stat vũ khí cho riêng người cầm không được cộng chung
  // với buff cho cả đội, dù cùng một loại (ví dụ ATK% self vs ATK% team).
  const map = new Map<string, BuffEntry[]>()
  for (const e of entries) {
    const key = `${e.target}|${e.applies_to}`
    const list = map.get(key)
    if (list) list.push(e)
    else map.set(key, [e])
  }
  return [...map.entries()]
}

function formatValue(v: number, unit: string): string {
  const n = Number.isInteger(v) ? v.toString() : v.toFixed(1)
  return unit ? `${n}${unit}` : n
}

function entryTooltip(e: BuffEntry): string {
  const parts = [
    e.source,
    TARGET_LABEL[e.target] ?? e.target,
    e.duration != null ? `${e.duration}s` : 'thường trực / theo vùng',
  ]
  if (e.condition) parts.push(e.condition)
  if (e.confidence !== 'high') parts.push(`độ tin cậy: ${e.confidence}`)
  return parts.filter(Boolean).join(' · ')
}

export default function BuffsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['buffs'],
    queryFn: getBuffs,
    staleTime: Infinity,
  })

  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const [detailChar, setDetailChar] = useState<string | null>(null)

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(prefs))
  }, [prefs])

  const characters = data?.characters ?? []
  const categories = data?.categories ?? []
  const groupOrder = data?.group_order ?? []

  const hidden = useMemo(() => new Set(prefs.hidden), [prefs.hidden])
  const visible = characters.filter(c => !hidden.has(c.name))

  const toggleChar = (name: string) =>
    setPrefs(p => ({
      ...p,
      hidden: p.hidden.includes(name) ? p.hidden.filter(n => n !== name) : [...p.hidden, name],
    }))

  const setRc = (name: string, level: number) =>
    setPrefs(p => ({ ...p, rc: { ...p.rc, [name]: level } }))

  // cell index: [category key][character name] → entries active right now
  const cells = useMemo(() => {
    const map: Record<string, Record<string, BuffEntry[]>> = {}
    for (const cat of categories) map[cat.key] = {}
    for (const c of visible) {
      const active = activeEntries(c, (prefs.rc[c.name] ?? 0) > 0)
      for (const e of active) {
        if (!map[e.cat]) map[e.cat] = {}
        ;(map[e.cat][c.name] ??= []).push(e)
      }
    }
    return map
  }, [categories, visible, prefs.rc])

  const rowHasData = (catKey: string) =>
    visible.some(c => (cells[catKey]?.[c.name]?.length ?? 0) > 0)

  // Thanh cuộn ngang phụ đặt TRÊN bảng, đồng bộ 2 chiều với vùng cuộn thật.
  const topScrollRef = useRef<HTMLDivElement>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const [scrollWidth, setScrollWidth] = useState(0)
  const [overflowing, setOverflowing] = useState(false)
  const syncing = useRef(false)

  useEffect(() => {
    const el = tableScrollRef.current
    if (!el) return
    const update = () => {
      setScrollWidth(el.scrollWidth)
      setOverflowing(el.scrollWidth > el.clientWidth + 1)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [visible.length, categories.length, prefs.hideEmpty, isLoading])

  const mirrorScroll = useCallback((from: HTMLDivElement | null, to: HTMLDivElement | null) => {
    if (!from || !to || syncing.current) return
    syncing.current = true
    to.scrollLeft = from.scrollLeft
    requestAnimationFrame(() => { syncing.current = false })
  }, [])

  const tableMinWidth = LABEL_COL + visible.length * COL_MIN

  const lowConfidenceCount = visible.reduce(
    (n, c) => n + activeEntries(c, (prefs.rc[c.name] ?? 0) > 0).filter(e => e.confidence === 'low').length,
    0,
  )

  const detail = characters.find(c => c.name === detailChar) ?? null

  return (
    <div className="max-w-[1880px] mx-auto px-3 py-4 space-y-3 animate-fade-up">
      {/* Hero */}
      <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-1">
        <h1 className="font-display font-bold text-2xl uppercase tracking-[0.15em] text-ww-text flex items-center gap-2.5">
          <Sparkles className="w-6 h-6 text-ww-cyan" />
          <span>Team <span className="text-ww-cyan text-glow-cyan">Buffs</span></span>
        </h1>
        <p className="text-slate-300 text-xs flex-1 min-w-[300px]">
          Mọi nhân vật tính ở <span className="text-ww-text">S0</span> (không cung mệnh). Tick <span className="text-ww-accent">Trấn</span> = cộng toàn bộ stat vũ khí trấn ở <span className="text-ww-accent">R1</span> → cột thành <span className="text-ww-accent">S0R1</span>.
        </p>

        <div className="flex gap-1.5 flex-wrap">
          <Stat label="Buffer" value={characters.length} color="#67e8f9" />
          <Stat label="Đang hiện" value={visible.length} color="#e8a045" />
          <Stat label="Cần xác nhận" value={lowConfidenceCount} color="#f87171" />
        </div>
      </div>

      {/* Controls */}
      <section className="panel-tech px-4 py-2.5 space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="section-label font-vn mb-0">Hiển thị nhân vật</p>
          <button className="btn-secondary font-vn inline-flex items-center justify-center h-7 py-0 px-4 text-[11px] leading-none" onClick={() => setPrefs(p => ({ ...p, hidden: [] }))}>
            Chọn tất cả
          </button>
          <button
            className="btn-secondary font-vn inline-flex items-center justify-center h-7 py-0 px-4 text-[11px] leading-none"
            onClick={() => setPrefs(p => ({ ...p, hidden: characters.map(c => c.name) }))}
          >
            Bỏ chọn hết
          </button>
          <label className="flex items-center gap-1.5 ml-auto cursor-pointer select-none">
            <input
              type="checkbox"
              className="accent-ww-cyan w-3.5 h-3.5"
              checked={prefs.hideEmpty}
              onChange={e => setPrefs(p => ({ ...p, hideEmpty: e.target.checked }))}
            />
            <span className="text-[11px] font-display uppercase tracking-wider text-slate-300 font-vn">Ẩn dòng trống</span>
          </label>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {characters.map(c => {
            const active = !hidden.has(c.name)
            const color = ELEMENT_COLOR[c.element ?? ''] ?? '#67e8f9'
            return (
              <button
                key={c.name}
                onClick={() => toggleChar(c.name)}
                className="flex items-center gap-1 pl-1 pr-2 h-7 rounded border transition-all"
                style={
                  active
                    ? { color, background: `${color}15`, borderColor: `${color}66`, boxShadow: `0 0 10px ${color}40` }
                    : { color: '#8b949e', borderColor: '#2a3142', opacity: 0.6 }
                }
              >
                <img
                  src={getCharacterIcon(c.name)}
                  alt=""
                  className="w-5 h-5 rounded-full object-cover"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
                />
                <span className="text-[10px] font-display font-bold uppercase tracking-wider whitespace-nowrap">
                  {c.name}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Matrix */}
      {isLoading ? (
        <div className="panel-tech p-10 text-center text-slate-300 font-vn uppercase tracking-widest text-sm">
          Đang tải…
        </div>
      ) : visible.length === 0 ? (
        <div className="panel-tech p-10 text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full border border-ww-cyan/40 flex items-center justify-center text-ww-cyan text-xl animate-pulse-glow">◆</div>
          <p className="text-slate-300 text-sm">Chưa chọn nhân vật nào để hiển thị.</p>
        </div>
      ) : (
        <section className="panel-tech p-0">
          {/* Thanh cuộn ngang phụ ở TRÊN bảng — chỉ hiện khi bảng thực sự tràn */}
          {overflowing && (
            <div
              ref={topScrollRef}
              onScroll={() => mirrorScroll(topScrollRef.current, tableScrollRef.current)}
              className="overflow-x-auto overflow-y-hidden border-b border-ww-border/60 h-4"
            >
              <div style={{ width: scrollWidth || tableMinWidth, height: 1 }} />
            </div>
          )}

          <div
            ref={tableScrollRef}
            onScroll={() => mirrorScroll(tableScrollRef.current, topScrollRef.current)}
            className="overflow-x-auto"
          >
            <table className="border-collapse w-full table-fixed" style={{ minWidth: tableMinWidth }}>
              <colgroup>
                <col style={{ width: LABEL_COL }} />
                {visible.map(c => <col key={c.name} />)}
              </colgroup>
              <thead>
                <tr className="bg-ww-surface">
                  <th className="sticky left-0 z-20 bg-ww-surface border-b border-ww-border px-2 py-2 text-left align-bottom">
                    <span className="section-label font-vn mb-0">Loại buff</span>
                  </th>
                  {visible.map(c => {
                    const color = ELEMENT_COLOR[c.element ?? ''] ?? '#67e8f9'
                    const level = prefs.rc[c.name] ?? 0
                    return (
                      <th
                        key={c.name}
                        className="border-b border-l border-ww-border px-1.5 py-2 align-top"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <img
                            src={getCharacterIcon(c.name)}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover border-2"
                            style={{ borderColor: `${color}88`, boxShadow: `0 0 10px ${color}44` }}
                            onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
                          />
                          <button
                            onClick={() => setDetailChar(detailChar === c.name ? null : c.name)}
                            className="font-display text-[11px] font-bold uppercase tracking-tight leading-tight text-center hover:text-glow-cyan transition-colors"
                            style={{ color }}
                            title="Xem chi tiết kit"
                          >
                            {c.name}
                          </button>
                          <div className="flex items-center gap-1">
                            <label
                              className={`flex items-center gap-1 select-none ${
                                c.weapon ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                              }`}
                              title={
                                c.weapon
                                  ? `Vũ khí trấn: ${c.weapon.name} (${c.weapon.type}) — bật để tính R1`
                                  : 'Nhân vật này không có vũ khí trấn'
                              }
                            >
                              <input
                                type="checkbox"
                                className="accent-ww-accent w-3 h-3"
                                disabled={!c.weapon}
                                checked={level > 0}
                                onChange={e => setRc(c.name, e.target.checked ? 1 : 0)}
                              />
                              <span className="text-[10px] font-display uppercase tracking-tight text-slate-300 font-vn">Trấn</span>
                            </label>
                            <span
                              className={`text-[10px] font-display font-bold tracking-wider ${
                                level > 0 ? 'text-ww-accent' : 'text-slate-400'
                              }`}
                            >
                              {c.weapon ? (level > 0 ? 'S0R1' : 'S0R0') : 'S0'}
                            </span>
                          </div>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>

              <tbody>
                {groupOrder.map(group => {
                  const rows = categories.filter(
                    cat => cat.group === group && (!prefs.hideEmpty || rowHasData(cat.key)),
                  )
                  if (rows.length === 0) return null
                  return (
                    <Fragment key={group}>
                      <tr>
                        <td
                          colSpan={visible.length + 1}
                          className="sticky left-0 bg-ww-surface-2/70 border-y border-ww-border px-2 py-0.5"
                        >
                          <span className="section-label mb-0">{group}</span>
                        </td>
                      </tr>
                      {rows.map(cat => (
                        <tr key={cat.key} className="hover:bg-ww-surface-2/40 transition-colors">
                          <th className="sticky left-0 z-10 bg-ww-surface border-b border-ww-border px-2 py-1 text-left font-display text-[13px] uppercase tracking-tight leading-tight text-ww-text font-semibold">
                            {cat.label}
                          </th>
                          {visible.map(c => {
                            const entries = cells[cat.key]?.[c.name] ?? []
                            return (
                              <td
                                key={c.name}
                                className="border-b border-l border-ww-border px-1.5 py-1 align-top text-center"
                              >
                                {entries.length === 0 ? (
                                  <span className="text-ww-muted/70">—</span>
                                ) : (
                                  <div className="space-y-1">
                                    {groupByScope(entries).map(([key, scoped]) => {
                                      const scope = key.split('|')[1]
                                      const isSelf = key.startsWith('self|')
                                      const total = cellTotal(scoped)
                                      const hasLow = scoped.some(e => e.confidence === 'low')
                                      return (
                                        <div key={key}>
                                          {total != null && (
                                            <div
                                              className={`readout text-lg font-bold leading-tight ${
                                                isSelf ? 'text-slate-400' : 'text-ww-accent'
                                              }`}
                                            >
                                              {formatValue(total, cat.unit)}
                                              {hasLow && (
                                                <span className="text-red-400 text-xs align-super ml-0.5" title="Nguồn chưa chắc chắn — cần xác nhận">?</span>
                                              )}
                                            </div>
                                          )}
                                          <div className="flex flex-wrap gap-x-1 justify-center leading-tight">
                                            {scoped.map((e, i) => {
                                              const fromWeapon = isWeaponEntry(c, e)
                                              const marks = (
                                                <>
                                                  {fromWeapon && <span className="text-ww-purple font-bold" title="Từ vũ khí trấn R1"> R1</span>}
                                                  {e.target === 'self' && <span className="text-slate-500" title="Chỉ cho người cầm"> ◆</span>}
                                                  {e.target === 'next' && <span className="text-ww-cyan"> →</span>}
                                                  {e.target === 'enemy' && <span className="text-red-400"> ▼</span>}
                                                </>
                                              )
                                              const tip = `${e.value == null ? `${e.text} · ` : ''}${e.applies_to} · ${entryTooltip(e)}`
                                              // Entry chữ (heal / shield / mitigation): xuống dòng đầy đủ, không cắt.
                                              return e.value == null ? (
                                                <span
                                                  key={i}
                                                  title={tip}
                                                  className="block w-full text-[10px] leading-snug text-slate-100 font-vn break-words cursor-help"
                                                >
                                                  {e.text}
                                                  {marks}
                                                </span>
                                              ) : (
                                                <span
                                                  key={i}
                                                  title={tip}
                                                  className={`inline-flex items-center gap-0.5 text-[10px] font-display uppercase tracking-tight cursor-help ${
                                                    isSelf ? 'text-slate-500' : 'text-slate-300'
                                                  }`}
                                                >
                                                  {SCOPE_SHORT[scope] ?? scope}
                                                  {marks}
                                                </span>
                                              )
                                            })}
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Per-character detail */}
      {detail && (
        <section className="panel-tech p-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <img
              src={getCharacterIcon(detail.name)}
              alt=""
              className="w-10 h-10 rounded-full object-cover border-2"
              style={{ borderColor: `${ELEMENT_COLOR[detail.element ?? ''] ?? '#67e8f9'}88` }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
            />
            <div>
              <h2 className="font-display font-bold text-lg uppercase tracking-wider text-ww-text">{detail.name}</h2>
              <p className="text-[11px] text-slate-400">
                {detail.element} · {detail.role} · dữ liệu theo bản {detail.patch_verified}
              </p>
            </div>
            <button className="btn-secondary font-vn inline-flex items-center justify-center h-7 py-0 px-4 text-[11px] leading-none ml-auto" onClick={() => setDetailChar(null)}>
              Đóng
            </button>
          </div>

          {detail.notes && <p className="text-xs text-slate-300 leading-relaxed">{detail.notes}</p>}

          <p className="section-label font-vn mb-0">Kit — tính trong bảng (S0)</p>
          <div className="space-y-1.5">
            {detail.buffs.filter(e => e.seq === 0).map((e, i) => {
              const on = true
              const cat = categories.find(c => c.key === e.cat)
              return (
                <div
                  key={i}
                  className={`flex flex-wrap items-baseline gap-2 text-xs border-l-2 pl-2 py-1 ${
                    on ? 'border-ww-accent/70 text-ww-text' : 'border-ww-border text-ww-muted/60'
                  }`}
                >
                  <span className="font-display uppercase tracking-wider text-[10px] text-ww-cyan min-w-[130px]">
                    {cat?.label ?? e.cat}
                  </span>
                  <span className="readout font-bold">
                    {e.value != null ? formatValue(e.value, cat?.unit ?? '') : e.text}
                  </span>
                  <span className="text-[11px]">{e.applies_to}</span>
                  {e.seq > 0 && <span className="text-ww-accent font-display text-[10px] font-bold">R{e.seq}</span>}
                  <span className="text-[10px] text-slate-400">{entryTooltip(e)}</span>
                </div>
              )
            })}
          </div>

          {detail.weapon && (
            <>
              <p className="section-label font-vn mb-0">
                Vũ khí trấn R1 — {detail.weapon.name} ({detail.weapon.type})
                {(prefs.rc[detail.name] ?? 0) > 0 ? '' : ' — đang TẮT'}
              </p>
              <p className="text-[11px] text-slate-500">
                Stat nền (không tính vào bảng): Base ATK {detail.weapon.base_atk}
                {detail.weapon.main_stat &&
                  ` · ${detail.weapon.main_stat.stat} ${detail.weapon.main_stat.value}%`}
              </p>
              <div className="space-y-1.5">
                {detail.weapon.buffs.map((e, i) => {
                  const on = (prefs.rc[detail.name] ?? 0) > 0
                  const cat = categories.find(c => c.key === e.cat)
                  return (
                    <div
                      key={i}
                      className={`flex flex-wrap items-baseline gap-2 text-xs border-l-2 pl-2 py-1 ${
                        on ? 'border-ww-purple/70 text-ww-text' : 'border-ww-border text-ww-muted/60'
                      }`}
                    >
                      <span className="font-display uppercase tracking-wider text-[10px] text-ww-purple min-w-[130px]">
                        {cat?.label ?? e.cat}
                      </span>
                      <span className="readout font-bold">
                        {e.value != null ? formatValue(e.value, cat?.unit ?? '') : e.text}
                      </span>
                      <span className="text-[11px]">{e.applies_to}</span>
                      {e.target === 'self' && <span className="text-slate-500 text-[10px]">chỉ người cầm</span>}
                      <span className="text-[10px] text-slate-400">{entryTooltip(e)}</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {detail.buffs.some(e => e.seq > 0) && (
            <>
              <p className="section-label font-vn mb-0">Cung mệnh S1-S6 — tham khảo, KHÔNG tính trong bảng</p>
              <div className="space-y-1.5">
                {detail.buffs.filter(e => e.seq > 0).map((e, i) => {
                  const cat = categories.find(c => c.key === e.cat)
                  return (
                    <div
                      key={i}
                      className="flex flex-wrap items-baseline gap-2 text-xs border-l-2 border-ww-border pl-2 py-1 text-ww-muted/70"
                    >
                      <span className="font-display uppercase tracking-wider text-[10px] min-w-[130px]">
                        S{e.seq} · {cat?.label ?? e.cat}
                      </span>
                      <span className="readout font-bold">
                        {e.value != null ? formatValue(e.value, cat?.unit ?? '') : e.text}
                      </span>
                      <span className="text-[11px]">{e.applies_to}</span>
                      <span className="text-[10px]">{entryTooltip(e)}</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {detail.sources.length > 0 && (
            <div className="flex flex-wrap gap-3 pt-1">
              {[...detail.sources, ...(detail.weapon?.sources ?? [])].map(url => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-ww-cyan hover:text-glow-cyan"
                >
                  <ExternalLink className="w-3 h-3" /> {new URL(url).hostname.replace('www.', '')}
                </a>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Caveats */}
      <section className="panel-tech p-4 text-[11px] text-slate-300 leading-relaxed space-y-1">
        <p className="flex items-center gap-2 text-ww-accent font-display uppercase tracking-wider text-[11px]">
          <AlertTriangle className="w-3.5 h-3.5" /> Lưu ý khi đọc bảng
        </p>
        <p>• Bảng cộng dồn số học các buff cùng loại. Trong game, buff <b>cùng nguồn</b> không cộng dồn, và DMG Amplification với DMG Bonus nằm ở hai phần khác nhau của công thức sát thương — đừng gộp làm một.</p>
        <p>• <span className="text-ww-cyan">→</span> = chỉ cho nhân vật vào sân ngay sau Outro; <span className="text-red-400">▼</span> = debuff lên địch; còn lại là buff toàn đội. Rê chuột vào chip để xem nguồn, thời lượng và điều kiện.</p>
        <p>• Dấu <span className="text-red-400">?</span> = nguồn không nói rõ team hay cá nhân, cần xác nhận trong game.</p>
        <p>• Buff cá nhân của chính buffer không đưa vào bảng — xem phần ghi chú khi bấm vào tên nhân vật.</p>
        <p>• Mặc định là kit gốc ở <b>S0R0</b>: Outro / Intro / Inherent / Forte / Liberation, không cung mệnh, không vũ khí trấn. Tick Trấn → <b>S0R1</b>, thêm mọi stat của vũ khí trấn (badge <span className="text-ww-purple">R1</span>). Buff cung mệnh S1-S6 không vào bảng — bấm tên nhân vật để xem.</p>
        <p>• <span className="text-slate-500">◆</span> = stat chỉ cho người cầm (chủ yếu từ vũ khí trấn), in màu mờ và <b>không</b> cộng chung với buff toàn đội cùng loại. Echo main-stat và Sonata set vẫn chưa có trong bảng.</p>
      </section>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="px-2.5 py-1 rounded border flex items-center gap-1.5"
      style={{ borderColor: `${color}55`, background: `${color}12` }}
    >
      <span className="readout text-base font-bold leading-none" style={{ color }}>{value}</span>
      <span className="text-[9px] font-display uppercase tracking-[0.15em] text-slate-300 font-vn">{label}</span>
    </div>
  )
}
