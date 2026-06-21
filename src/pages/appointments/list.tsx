import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAppointments } from '@/hooks/use-appointments'
import { useResolvedSlots } from '@/hooks/use-slots'
import { useDoctors } from '@/hooks/use-doctors'
import { useOnline } from '@/hooks/use-online'
import { useNow } from '@/hooks/use-now'
import { isUpcoming } from '@/lib/appointments'
import { relativeMinutesLabel } from '@/lib/utils/relative-time'
import { PageHeader } from '@/components/layout/page-header'
import { AppointmentCard } from '@/components/appointment-card'
import { StaleBanner } from '@/components/ui/stale-banner'
import { Skeleton } from '@/components/ui/skeleton'
import type { AppointmentView } from '@/types/api'

export default function AppointmentsListPage() {
  const { data: appointments, isPending, isError, dataUpdatedAt } = useAppointments()
  const { data: doctors } = useDoctors()
  const { slotMap, resolveSlot } = useResolvedSlots(appointments)
  const online = useOnline()
  // Tick while offline so the "as of N min ago" age advances without a refetch.
  const now = useNow(30_000, !online)

  const doctorNames = useMemo(() => {
    const m = new Map<string, string>()
    for (const d of doctors ?? []) m.set(d.id, d.displayName)
    return m
  }, [doctors])

  const { upcoming, past } = useMemo(() => {
    const sortTime = (a: AppointmentView) =>
      new Date(resolveSlot(a.slotId)?.startAt ?? a.createdAt).getTime()
    const up: AppointmentView[] = []
    const pa: AppointmentView[] = []
    for (const a of appointments ?? []) (isUpcoming(a.status) ? up : pa).push(a)
    up.sort((a, b) => sortTime(a) - sortTime(b)) // soonest first
    pa.sort((a, b) => sortTime(b) - sortTime(a)) // most recent first
    return { upcoming: up, past: pa }
    // resolveSlot identity changes each render; slotMap is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments, slotMap])

  return (
    <div>
      <PageHeader title="My Appointments" back={false} />
      <div className="space-y-6 p-4">
        {!online && dataUpdatedAt > 0 && (
          <StaleBanner>Showing saved data — as of {relativeMinutesLabel(dataUpdatedAt, now)}</StaleBanner>
        )}
        {isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : isError ? (
          <p className="py-8 text-center text-sm text-status-cancelled" role="alert">
            Couldn't load your appointments. Please try again.
          </p>
        ) : (appointments?.length ?? 0) === 0 ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
            <div>
              <p className="text-lg font-semibold text-gray-900">No appointments yet</p>
              <p className="mt-1 text-sm text-gray-500">Book a visit to see it here.</p>
            </div>
            <Link
              to="/book"
              className="rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700"
            >
              Book an appointment
            </Link>
          </div>
        ) : (
          <>
            <Section title="Upcoming" empty="No upcoming appointments.">
              {upcoming.map((a) => (
                <AppointmentCard
                  key={a.id}
                  appointment={a}
                  slot={resolveSlot(a.slotId)}
                  doctorName={doctorNames.get(a.doctorId)}
                />
              ))}
            </Section>
            {past.length > 0 && (
              <Section title="Past">
                {past.map((a) => (
                  <AppointmentCard
                    key={a.id}
                    appointment={a}
                    slot={resolveSlot(a.slotId)}
                    doctorName={doctorNames.get(a.doctorId)}
                  />
                ))}
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Section({
  title,
  empty,
  children,
}: {
  title: string
  empty?: string
  children: ReactNode
}) {
  const items = Array.isArray(children) ? children : [children]
  const isEmpty = items.flat().filter(Boolean).length === 0
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      {isEmpty && empty ? <p className="text-sm text-gray-400">{empty}</p> : children}
    </section>
  )
}
