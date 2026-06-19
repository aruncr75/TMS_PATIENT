import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDependents } from '@/hooks/use-dependents'
import { formatDateOnly } from '@/lib/utils/date'
import { PageHeader } from '@/components/layout/page-header'
import { DependentPicker } from '@/components/dependent-picker'
import { Skeleton } from '@/components/ui/skeleton'

export default function DependentsPage() {
  const { data: dependents, isPending, isError } = useDependents()
  const [picked, setPicked] = useState<string | null>(null)

  return (
    <div>
      <PageHeader title="Dependents" />
      <div className="space-y-6 p-4">
        <Link
          to="/profile/dependents/add"
          className="block rounded-xl border-2 border-dashed border-brand-200 py-3 text-center text-sm font-semibold text-brand-700 hover:bg-brand-50"
        >
          + Add dependent
        </Link>

        {isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : isError || !dependents ? (
          <p className="text-sm text-status-cancelled">Couldn&apos;t load dependents.</p>
        ) : dependents.length === 0 ? (
          <p className="text-center text-sm text-gray-400">No dependents yet.</p>
        ) : (
          <ul className="space-y-3">
            {dependents.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="font-medium text-gray-900">{d.fullName}</p>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {[d.relationship, d.dateOfBirth ? formatDateOnly(d.dateOfBirth) : null]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </p>
                </div>
                <Link
                  to={`/profile/dependents/${d.id}/edit`}
                  className="text-sm font-medium text-brand-700 hover:underline"
                >
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* Preview of the picker reused in the Phase 3 booking flow. */}
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
            Booking preview
          </p>
          <DependentPicker value={picked} onChange={setPicked} />
          <p className="mt-2 text-xs text-gray-400">
            Used to choose who an appointment is for (Phase 3).
          </p>
        </section>
      </div>
    </div>
  )
}
