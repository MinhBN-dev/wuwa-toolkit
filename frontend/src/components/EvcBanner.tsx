import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, X, ExternalLink } from 'lucide-react'
import { getEvcStatus, acknowledgeEvcUpdate } from '../services/api'

export default function EvcBanner() {
  const qc = useQueryClient()
  const [dismissed, setDismissed] = useState(false)

  const { data } = useQuery({
    queryKey: ['evc-status'],
    queryFn: getEvcStatus,
    // Check once per session — no auto-refetch
    staleTime: Infinity,
    retry: false,
  })

  const ack = useMutation({
    mutationFn: (date: string) => acknowledgeEvcUpdate(date),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['evc-status'] })
      setDismissed(true)
    },
  })

  if (!data?.has_update || dismissed) return null

  return (
    <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <span className="text-yellow-300 font-semibold text-sm">
            EVC đã cập nhật ({data.latest_date_display})
          </span>
          {data.latest_entries.length > 0 && (
            <ul className="mt-0.5 space-y-0.5">
              {data.latest_entries.map((e, i) => (
                <li key={i} className="text-xs text-yellow-200/80">· {e}</li>
              ))}
            </ul>
          )}
          <a
            href="https://www.echovaluecalc.com/logs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 mt-1 transition-colors"
          >
            Xem changelog đầy đủ <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <button
          onClick={() => data.latest_date && ack.mutate(data.latest_date)}
          className="text-yellow-400/60 hover:text-yellow-300 transition-colors shrink-0 flex items-center gap-1 text-xs"
          title="Đánh dấu đã xem"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
