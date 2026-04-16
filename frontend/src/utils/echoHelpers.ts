import type { SubStat } from '../types/echo'

/** Snap a raw OCR value to the nearest valid roll value for that stat. */
export function snapToRoll(value: number, rolls: number[]): number {
  if (!rolls.length) return value
  return rolls.reduce((best, r) =>
    Math.abs(r - value) < Math.abs(best - value) ? r : best
  )
}

/**
 * Build a pre-populated sub-stat list for a character,
 * sorted by weight descending, all values initialised to 0.
 */
export function defaultSubStatsForChar(
  charName: string,
  charWeights: Record<string, Record<string, number>>,
): SubStat[] {
  const weights = charWeights[charName] ?? {}
  return Object.entries(weights)
    .filter(([, w]) => w > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([type]) => ({ type, value: 0 }))
}
