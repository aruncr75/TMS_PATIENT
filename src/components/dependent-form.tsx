import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { todayInClinicTz } from '@/lib/utils/date'

export interface DependentFormValues {
  fullName: string
  dateOfBirth: string // 'YYYY-MM-DD' or '' when unset
  relationship: string // '' when unset
}

interface DependentFormProps {
  initial?: Partial<DependentFormValues>
  submitting: boolean
  error?: string | null
  submitLabel: string
  onSubmit: (values: DependentFormValues) => void
}

// Common relationships. The backend stores a free string (1–60), so this is a
// convenience list, not a hard constraint.
const RELATIONSHIPS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Other'] as const

export function DependentForm({
  initial,
  submitting,
  error,
  submitLabel,
  onSubmit,
}: DependentFormProps) {
  const [fullName, setFullName] = useState(initial?.fullName ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(initial?.dateOfBirth ?? '')
  const [relationship, setRelationship] = useState(initial?.relationship ?? '')
  const [nameError, setNameError] = useState<string | null>(null)
  const relId = useId()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = fullName.trim()
    if (!trimmed) {
      setNameError('Name is required.')
      return
    }
    setNameError(null)
    onSubmit({ fullName: trimmed, dateOfBirth, relationship })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <Input
        label="Full name"
        value={fullName}
        onChange={(e) => {
          setFullName(e.target.value)
          if (nameError) setNameError(null)
        }}
        error={nameError}
        disabled={submitting}
        autoComplete="name"
        autoFocus
      />

      <Input
        label="Date of birth"
        type="date"
        value={dateOfBirth}
        max={todayInClinicTz()}
        onChange={(e) => setDateOfBirth(e.target.value)}
        disabled={submitting}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={relId} className="text-sm font-medium text-gray-700">
          Relationship
        </label>
        <select
          id={relId}
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
          disabled={submitting}
          className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
        >
          <option value="">Not specified</option>
          {RELATIONSHIPS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-sm text-status-cancelled" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" fullWidth loading={submitting} className="mt-1">
        {submitLabel}
      </Button>
    </form>
  )
}
