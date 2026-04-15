/**
 * Maps a character name (from API/game_data) to its icon filename slug.
 * Icons live at /characters/{slug}.webp
 *
 * Standard rule: lowercase + spaces→hyphens, strip role suffix (anything in parens).
 * Exceptions: filenames that don't match this rule exactly.
 */

const SLUG_OVERRIDES: Record<string, string> = {
  'Ciaccona':      'ciaconna',     // double-c in game data, nn in file
  'Luuk Herssen':  'luuk-hersen',  // double-s in game data, single-s in file
}

/** Extract base character name — strips role suffix like "(DPS)", "(sup)", etc. */
export function getBaseName(name: string): string {
  return name.replace(/\s*\(.*\)$/, '').trim()
}

/** Convert base name to icon slug. */
export function getCharacterSlug(name: string): string {
  const base = getBaseName(name)
  if (SLUG_OVERRIDES[base]) return SLUG_OVERRIDES[base]
  return base.toLowerCase().replace(/\s+/g, '-')
}

/** Full URL for the character's icon (served as static asset). */
export function getCharacterIcon(name: string): string {
  return `/characters/${getCharacterSlug(name)}.webp`
}

// ── Build status ──────────────────────────────────────────────────────────────

export type BuildStatus = 'not_built' | 'building' | 'built'

const LS_KEY = 'character_build_status'

export function loadBuildStatuses(): Record<string, BuildStatus> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function saveBuildStatus(baseName: string, status: BuildStatus): void {
  const all = loadBuildStatuses()
  all[baseName] = status
  localStorage.setItem(LS_KEY, JSON.stringify(all))
}

export const BUILD_STATUS_META: Record<BuildStatus, { label: string; color: string }> = {
  not_built: { label: 'Not Built',  color: 'border-ww-border text-ww-muted' },
  building:  { label: 'Building',   color: 'border-yellow-500 text-yellow-400' },
  built:     { label: 'Built',      color: 'border-tier-B text-tier-B' },
}

export const BUILD_STATUS_CYCLE: BuildStatus[] = ['not_built', 'building', 'built']
