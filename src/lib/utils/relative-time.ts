// Coarse "N min ago" labels for staleness indicators (offline appointments list,
// reconnecting queue tracker). Minute resolution is intentional — these are "saved
// data, as of …" hints, not precise timestamps.
export function relativeMinutesLabel(ts: number | null | undefined, now: number = Date.now()): string {
  if (ts == null) return ''
  const mins = Math.max(0, Math.floor((now - ts) / 60_000))
  if (mins === 0) return 'just now'
  if (mins === 1) return '1 min ago'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs === 1) return '1 hr ago'
  if (hrs < 24) return `${hrs} hr ago`
  const days = Math.floor(hrs / 24)
  return days === 1 ? '1 day ago' : `${days} days ago`
}
