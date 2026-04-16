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

// Bar fill color — must stay in sync with TIER_LABEL_COLORS keys
const TIER_BAR_COLOR: Record<string, string> = {
  'Godly':           'bg-tier-S',
  'Extreme':         'bg-tier-S',
  'High Investment': 'bg-tier-A',
  'Well Built':      'bg-tier-B',
  'Decent':          'bg-tier-B',
  'Base Level':      'bg-tier-C',
  'Unbuilt':         'bg-tier-D',
  'Not Applicable':  'bg-ww-border',
}

/** Bar fill color derived from tier label (consistent with border/text colors) */
export function getBarColor(score: number): string {
  return TIER_BAR_COLOR[getTierLabel(score)] ?? 'bg-tier-D'
}
