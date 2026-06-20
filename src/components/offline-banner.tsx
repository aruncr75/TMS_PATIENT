import { useOnline } from '@/hooks/use-online'

// App-wide connectivity indicator. Renders only when the browser reports offline.
// The service-worker precache keeps the shell rendering with no blank screen; cached
// React Query data keeps showing last-known lists with their own staleness labels.
export function OfflineBanner() {
  const online = useOnline()
  if (online) return null

  return (
    <div
      role="status"
      className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white"
    >
      You're offline — showing saved data
    </div>
  )
}
