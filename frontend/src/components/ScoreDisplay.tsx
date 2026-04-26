import type { ScoreResponse } from '../types/echo'
import { getTierLabel, getTierClass, TIER_THRESHOLDS } from '../utils/tier'

interface Props {
  score: ScoreResponse
}

const TIER_COLOR: Record<string, string> = {
  Godly: '#ff9500',
  Extreme: '#ff9500',
  'High Investment': '#c084fc',
  'Well Built': '#60a5fa',
  Decent: '#60a5fa',
  'Base Level': '#4ade80',
  Unbuilt: '#94a3b8',
}

export default function ScoreDisplay({ score }: Props) {
  const isNA = score.tier_label === 'Not Applicable'
  const label = score.tier_label && score.tier_label !== 'Not Applicable'
    ? score.tier_label
    : getTierLabel(score.score_percent)
  const tierClass = getTierClass(label)
  const sortedBreakdown = Object.entries(score.breakdown).sort(([, a], [, b]) => b - a)
  const accent = TIER_COLOR[label] ?? '#67e8f9'
  const widthPct = Math.min(score.score_percent, 100)

  return (
    <div className="panel-tech p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="section-label">Score Result</h3>
        {score.character_name && (
          <span className="text-[11px] uppercase tracking-wider text-ww-muted font-display">
            {score.character_name}
          </span>
        )}
      </div>

      {isNA && (
        <div className="text-center py-6 text-ww-muted text-sm">
          <p className="font-display uppercase tracking-wider text-base text-ww-text">Not Applicable</p>
          <p className="mt-1">Score analysis is not available for support characters.</p>
        </div>
      )}

      {!isNA && (
        <>
          {/* Big number + tier badge */}
          <div className="flex items-center gap-5">
            <div
              className={`shrink-0 w-24 h-24 flex items-center justify-center rounded-md border-2 font-display font-bold uppercase text-center text-[11px] leading-tight px-2 tracking-wider ${tierClass}`}
              style={{ boxShadow: `0 0 20px ${accent}40, inset 0 0 0 1px ${accent}30` }}
            >
              {label}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-end gap-2">
                <span
                  className="readout text-5xl font-bold leading-none"
                  style={{ color: accent, textShadow: `0 0 18px ${accent}60` }}
                >
                  {score.score_percent.toFixed(2)}
                </span>
                <span className="text-ww-muted text-base mb-1 font-display">/ 100</span>
              </div>

              <div className="relative w-full h-2.5 bg-ww-bg-deep/80 rounded-full mt-3 overflow-hidden border border-ww-border">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${widthPct}%`,
                    background: `linear-gradient(90deg, ${accent}99, ${accent})`,
                    boxShadow: `0 0 12px ${accent}80`,
                  }}
                />
                {/* shimmer overlay */}
                <div className="absolute inset-0 shimmer-line opacity-40 pointer-events-none" />
              </div>

              <div className="flex justify-between text-[11px] text-ww-muted mt-1.5 font-display uppercase tracking-wider">
                <span>AV {score.score.toFixed(2)}</span>
                <span>EP {score.max_possible.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Stat contributions */}
          {sortedBreakdown.length > 0 && (
            <div className="pt-3 border-t border-dashed border-ww-border">
              <p className="section-label mb-2.5">Stat Contributions</p>
              <div className="space-y-1.5">
                {sortedBreakdown.map(([stat, contrib]) => {
                  const pct = (contrib / score.max_possible) * 100
                  return (
                    <div key={stat} className="flex items-center gap-2">
                      <span className="text-xs text-ww-text w-32 shrink-0 truncate">{stat}</span>
                      <div className="flex-1 h-1.5 bg-ww-bg-deep/70 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(pct * 4, 100)}%`,
                            background: `linear-gradient(90deg, ${accent}80, ${accent})`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-ww-muted w-12 text-right readout">{contrib.toFixed(2)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tier ladder */}
          <div className="flex flex-wrap gap-1 pt-3 border-t border-dashed border-ww-border">
            {TIER_THRESHOLDS.map(([, lbl]) => (
              <div
                key={lbl}
                className={`flex-1 min-w-0 text-center py-1 px-1 rounded-sm text-[9px] font-display font-bold uppercase tracking-wider border whitespace-nowrap transition-opacity ${
                  getTierClass(lbl)
                } ${lbl === label ? 'opacity-100' : 'opacity-25'}`}
              >
                {lbl}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
