export const TIER_THRESHOLDS: [number, string][] = [
  [99, 'Godly'],
  [88, 'Extreme'],
  [77, 'High Investment'],
  [66, 'Well Built'],
  [55, 'Decent'],
  [44, 'Base Level'],
  [0,  'Unbuilt'],
]

export function getTierLabel(score: number): string {
  for (const [threshold, label] of TIER_THRESHOLDS) {
    if (score >= threshold) return label
  }
  return 'Unbuilt'
}

export const TIER_LABEL_COLORS: Record<string, string> = {
  'Godly':           'text-tier-S border-tier-S bg-tier-S/10',
  'Extreme':         'text-tier-S border-tier-S bg-tier-S/10',
  'High Investment': 'text-tier-A border-tier-A bg-tier-A/10',
  'Well Built':      'text-tier-B border-tier-B bg-tier-B/10',
  'Decent':          'text-tier-B border-tier-B bg-tier-B/10',
  'Base Level':      'text-tier-C border-tier-C bg-tier-C/10',
  'Unbuilt':         'text-tier-D border-tier-D bg-tier-D/10',
}

export function getTierClass(label: string): string {
  return TIER_LABEL_COLORS[label] ?? TIER_LABEL_COLORS['Unbuilt']
}

/** Bar fill color based on score percent */
export function getBarColor(score: number): string {
  if (score >= 88) return 'bg-tier-S'
  if (score >= 66) return 'bg-tier-A'
  if (score >= 50) return 'bg-tier-B'
  if (score >= 35) return 'bg-tier-C'
  return 'bg-tier-D'
}
