// Pulse placeholder for first-fetch loading states. Pass Tailwind size/shape
// classes via `className` (e.g. "h-4 w-32").
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-md bg-gray-200 ${className}`}
    />
  )
}
