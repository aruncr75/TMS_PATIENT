import { useId } from 'react'
import { useDependents } from '@/hooks/use-dependents'

interface DependentPickerProps {
  /** Selected dependent id, or `null` for "Myself". */
  value: string | null
  onChange: (dependentId: string | null) => void
  label?: string
  disabled?: boolean
}

// Controlled picker of "Myself" + the patient's dependents. Reads the shared
// `['dependents']` query, so a newly added dependent appears here by construction.
// Built in Phase 2; wired into the booking-confirm step in Phase 3.
export function DependentPicker({
  value,
  onChange,
  label = 'Booking for',
  disabled,
}: DependentPickerProps) {
  const { data: dependents, isPending } = useDependents()
  const id = useId()

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
        disabled={disabled || isPending}
        className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 disabled:opacity-60"
      >
        <option value="">Myself</option>
        {dependents?.map((d) => (
          <option key={d.id} value={d.id}>
            {d.fullName}
          </option>
        ))}
      </select>
    </div>
  )
}
