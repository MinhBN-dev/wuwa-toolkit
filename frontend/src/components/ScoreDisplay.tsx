import { TrendingUp } from 'lucide-react'
import type { ScoreResponse } from '../types/echo'
import { getTierLabel, getTierClass, getBarColor, TIER_THRESHOLDS } from '../utils/tier'

interface Props {
  score: ScoreResponse
}

export default function ScoreDisplay({ score }: Props) {
  const isNA = score.tier_label === 'Not Applicable'
  const label = score.tier_label && score.tier_label !== 'Not Applicable'
    ? score.tier_label
    : getTierLabel(score.score_percent)
  const tierClass = getTierClass(label)
  const sortedBreakdown = Object.entries(score.breakdown).sort(([, a], [, b]) => b - a)

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-ww-accent" />
        <h3 className="font-semibold text-sm uppercase tracking-wider text-ww-accent">Score Result</h3>
        {score.character_name && (
          <span className="text-xs text-ww-muted">for {score.character_name}</span>
        )}
      </div>

      {isNA && (
        <div className="text-center py-4 text-ww-muted text-sm">
          <p className="font-semibold text-base text-ww-text">Not Applicable</p>
          <p className="mt-1">Score analysis is not available for support characters.</p>
        </div>
      )}

      {!isNA && (
        <div className="flex items-center gap-6">
          <div className={`w-24 h-24 rounded-xl border-2 flex items-center justify-center shrink-0 ${tierClass}`}>
            <span className="text-xs font-black text-center leading-tight px-2">{label}</span>
          </div>

          <div className="flex-1">
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black text-ww-text">{score.score_percent.toFixed(3)}</span>
              <span className="text-ww-muted text-lg mb-1">/ 100</span>
            </div>
            <div className="w-full h-3 bg-ww-border rounded-full overflow-hidden mt-2">
              <div
                className={`h-full rounded-full transition-all ${getBarColor(score.score_percent)}`}
                style={{ width: `${score.score_percent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-ww-muted mt-1">
              <span>Raw: {score.score.toFixed(3)}</span>
              <span>EP: {score.max_possible.toFixed(3)}</span>
            </div>
          </div>
        </div>
      )}

      {!isNA && sortedBreakdown.length > 0 && (
        <div>
          <p className="text-xs text-ww-muted uppercase tracking-wider mb-2">Stat Contributions</p>
          <div className="space-y-2">
            {sortedBreakdown.map(([stat, contrib]) => {
              const pct = (contrib / score.max_possible) * 100
              return (
                <div key={stat} className="flex items-center gap-2">
                  <span className="text-xs text-ww-text w-36 shrink-0">{stat}</span>
                  <div className="flex-1 h-2 bg-ww-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-ww-accent/70 rounded-full"
                      style={{ width: `${Math.min(pct * 4, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-ww-muted w-12 text-right">{contrib.toFixed(3)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!isNA && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-ww-border">
          {TIER_THRESHOLDS.map(([, lbl]) => (
            <div
              key={lbl}
              className={`flex-1 min-w-0 text-center py-1 px-1 rounded text-[10px] font-bold border whitespace-nowrap ${
                getTierClass(lbl)
              } ${lbl === label ? 'opacity-100' : 'opacity-25'}`}
            >
              {lbl}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
