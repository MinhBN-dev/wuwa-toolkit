import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, X, ExternalLink } from 'lucide-react'
import { getEvcStatus, acknowledgeEvcUpdate } from '../services/api'

const LS_KEY = 'evc_acknowledged_date'

function getLocalAck(): string | null {
  return localStorage.getItem(LS_KEY)
}

function setLocalAck(date: string) {
  localStorage.setItem(LS_KEY, date)
}

export default function EvcBanner() {
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['evc-status'],
    queryFn: getEvcStatus,
    staleTime: Infinity,
    retry: false,
  })

  const ack = useMutation({
    mutationFn: (date: string) => acknowledgeEvcUpdate(date),
    onSuccess: (_res, date) => {
      setLocalAck(date)
      qc.invalidateQueries({ queryKey: ['evc-status'] })
    },
  })

  if (!data?.has_update) return null

  const localAck = getLocalAck()
  if (data.latest_date && localAck && localAck >= data.latest_date) return null

  return (
    <div className="relative border-b border-yellow-500/20 bg-yellow-500/[0.06] backdrop-blur-md">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-400/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-yellow-400/30 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <span className="font-display uppercase tracking-[0.18em] text-yellow-300 font-semibold text-xs">
            EVC update · {data.latest_date_display}
          </span>
          {data.latest_entries.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {data.latest_entries.map((e, i) => (
                <li key={i} className="text-xs text-yellow-100/80">· {e}</li>
              ))}
            </ul>
          )}
          <a
            href="https://www.echovaluecalc.com/logs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider font-display text-yellow-400 hover:text-yellow-200 mt-1 transition-colors"
          >
            View full changelog <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <button
          onClick={() => data.latest_date && ack.mutate(data.latest_date)}
          className="text-yellow-400/60 hover:text-yellow-200 transition-colors shrink-0"
          title="Mark as seen"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
