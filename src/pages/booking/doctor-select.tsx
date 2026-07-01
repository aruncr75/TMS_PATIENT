import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearActiveHold } from '@/lib/active-hold'
import { useDoctors } from '@/hooks/use-doctors'
import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'

export default function DoctorSelectPage() {
  const { data: doctors, isPending, isError } = useDoctors()
  const navigate = useNavigate()

  useEffect(() => {
    // If the user returns to the directory, they've abandoned the booking flow
    clearActiveHold()
  }, [])

  return (
    <div>
      <PageHeader title="Choose a doctor" />
      <div className="space-y-3 p-4">
        {isPending && (
          <>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </>
        )}

        {isError && (
          <p className="py-8 text-center text-sm text-status-cancelled" role="alert">
            Couldn't load doctors. Please try again.
          </p>
        )}

        {doctors?.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500">No doctors available right now.</p>
        )}

        {doctors?.map((doctor) => (
          <button
            key={doctor.id}
            type="button"
            onClick={() => navigate(`/book/${doctor.id}/slots`)}
            className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <span>
              <span className="block text-base font-semibold text-gray-900">{doctor.displayName}</span>
              {doctor.specialization && (
                <span className="mt-0.5 block text-sm text-gray-500">{doctor.specialization}</span>
              )}
            </span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 shrink-0 text-gray-400"
              aria-hidden
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}
