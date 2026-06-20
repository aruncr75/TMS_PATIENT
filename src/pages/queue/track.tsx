import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { QueueSocketProvider } from '@/lib/socket/socket-provider'
import { useQueue } from '@/hooks/use-queue'
import { useMyToken } from '@/hooks/use-my-token'
import { clearCheckInSession, readCheckInSession, type CheckInSession } from '@/hooks/use-checkin'
import { PageHeader } from '@/components/layout/page-header'
import { TokenDisplay } from '@/components/token-display'

// Live queue tracker. Reads the stored check-in session (set at check-in) and, if
// present, opens a doctor-scoped socket to follow the public board.
export default function QueueTrackPage() {
  // Lazy initializer keeps the session object identity stable across renders.
  const [session, setSession] = useState<CheckInSession | null>(readCheckInSession)

  const handleStale = useCallback(() => {
    clearCheckInSession()
    setSession(null)
  }, [])

  return (
    <div>
      <PageHeader title="Live queue" back={false} />
      {session ? (
        <QueueSocketProvider doctorId={session.doctorId}>
          <QueueTracker session={session} onStale={handleStale} />
        </QueueSocketProvider>
      ) : (
        <NotCheckedIn />
      )}
    </div>
  )
}

function QueueTracker({ session, onStale }: { session: CheckInSession; onStale: () => void }) {
  const { snapshot, status } = useQueue()
  const me = useMyToken(snapshot, session)

  // Stale board (different day/doctor) → drop the session and fall back to the
  // not-checked-in view rather than tracking a stranger's token.
  useEffect(() => {
    if (me?.isStale) onStale()
  }, [me?.isStale, onStale])

  // Haptic once per transition into "you're next" then "your turn" (guarded so a
  // re-render with the same standing doesn't buzz again).
  const prevPhase = useRef<'none' | 'next' | 'serving'>('none')
  useEffect(() => {
    const phase = me?.isServing ? 'serving' : me?.isNext ? 'next' : 'none'
    if (phase !== 'none' && phase !== prevPhase.current) navigator.vibrate?.([100, 50, 100])
    prevPhase.current = phase
  }, [me?.isServing, me?.isNext])

  if (!me || me.isStale) return null

  const connecting = !snapshot

  return (
    <div className="space-y-5 p-4">
      {(status === 'reconnecting' || status === 'error') && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-center text-sm text-amber-700" role="status">
          {status === 'error' ? 'Connection problem — retrying…' : 'Reconnecting…'}
        </p>
      )}

      {me.isServing ? (
        <Alert tone="now">It's your turn — please proceed to the doctor.</Alert>
      ) : me.isNext ? (
        <Alert tone="next">You're next. Please be ready.</Alert>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <TokenDisplay value={snapshot?.nowServingToken ?? null} label="Now serving" />
      </div>

      <div className="rounded-2xl bg-brand-50 p-6 shadow-sm">
        <TokenDisplay value={me.tokenNumber} label="Your token" emphasis />
        <div className="mt-4 border-t border-brand-100 pt-4">
          {connecting ? (
            <p className="text-center text-sm text-gray-500">Connecting to the live queue…</p>
          ) : me.isDone ? (
            <p className="text-center text-sm text-gray-600">You've been seen. Thanks for visiting.</p>
          ) : me.isServing ? (
            <p className="text-center text-sm font-medium text-status-in-progress">Now being served</p>
          ) : (
            <dl className="flex justify-center gap-10 text-center">
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">Position</dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{me.position ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">Est. wait</dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
                  {me.etaMinutes != null ? `${me.etaMinutes} min` : '—'}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </div>

      <Link
        to="/appointments"
        className="block rounded-xl px-4 py-3 text-center text-base font-semibold text-brand-700 hover:bg-brand-50"
      >
        Back to appointments
      </Link>
    </div>
  )
}

function Alert({ tone, children }: { tone: 'next' | 'now'; children: ReactNode }) {
  const styles =
    tone === 'now'
      ? 'bg-status-in-progress/10 text-status-in-progress'
      : 'bg-status-confirmed/10 text-status-confirmed'
  return (
    <div className={`rounded-2xl px-4 py-3 text-center text-base font-semibold ${styles}`} role="status">
      {children}
    </div>
  )
}

function NotCheckedIn() {
  return (
    <div className="space-y-5 p-4">
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
        <p className="text-lg font-semibold text-brand-700">No active check-in</p>
        <p className="mt-1 text-sm text-gray-500">
          Check in to an appointment to track your place in the live queue.
        </p>
      </div>
      <Link
        to="/appointments"
        className="block rounded-2xl bg-brand-600 p-4 text-center font-semibold text-white hover:bg-brand-700"
      >
        Go to my appointments
      </Link>
    </div>
  )
}
