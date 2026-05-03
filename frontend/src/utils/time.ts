/** Display timezone — fixed to UTC+7 (Vietnam / Asia/Ho_Chi_Minh). */
const DISPLAY_TZ = 'Asia/Ho_Chi_Minh'

const FMT_FULL = new Intl.DateTimeFormat('sv-SE', {
  timeZone: DISPLAY_TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
})

const FMT_DATE = new Intl.DateTimeFormat('sv-SE', {
  timeZone: DISPLAY_TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
})

/** Format a WuWa gacha pull time. The API returns naive timestamps in the
 *  game server timezone (Asia / UTC+8), which we shift to UTC+7 for display. */
export function formatGameTime(iso: string): string {
  if (!iso) return '—'
  // Tag as UTC+8; FastAPI sends ISO without trailing tz info for naive dates.
  const d = new Date(iso.replace(' ', 'T') + '+08:00')
  return FMT_FULL.format(d).replace(',', '').replace('T', ' ')
}

export function formatGameDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso.replace(' ', 'T') + '+08:00')
  return FMT_DATE.format(d)
}

/** Format a server-stored UTC timestamp (e.g. created_at) in UTC+7. */
export function formatLocalTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  // Naive → treat as UTC; tagged → respect tz.
  const hasTz = /[Z+-]\d{2}:?\d{2}$/.test(iso) || iso.endsWith('Z')
  const d = new Date(hasTz ? iso : iso.replace(' ', 'T') + 'Z')
  return FMT_FULL.format(d).replace(',', '').replace('T', ' ')
}
