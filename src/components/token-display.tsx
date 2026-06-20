interface TokenDisplayProps {
  value: number | null
  label?: string
  /** Highlight the patient's own token (vs the muted now-serving board number). */
  emphasis?: boolean
}

// Reusable large token-number block — the visual anchor of the queue tracker.
export function TokenDisplay({ value, label, emphasis = false }: TokenDisplayProps) {
  return (
    <div className="text-center">
      {label && <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>}
      <p
        className={`mt-1 font-bold tabular-nums ${
          emphasis ? 'text-6xl text-brand-700' : 'text-5xl text-gray-900'
        }`}
      >
        {value ?? '—'}
      </p>
    </div>
  )
}
