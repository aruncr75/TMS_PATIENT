import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { QueueSocketProvider } from '@/lib/socket/socket-provider'
import { useQueue } from '@/hooks/use-queue'
import { useMyToken } from '@/hooks/use-my-token'
import { useNow } from '@/hooks/use-now'
import { clearCheckInSession, readAllCheckInSessions, readCheckInSession, type CheckInSession } from '@/hooks/use-checkin'
import { PageHeader } from '@/components/layout/page-header'
import { TokenDisplay } from '@/components/token-display'
import { StaleBanner } from '@/components/ui/stale-banner'
import { relativeMinutesLabel } from '@/lib/utils/relative-time'

// Live queue tracker. Reads stored check-in sessions (set at check-in) and, if
// present, opens a doctor-scoped socket to follow the public board.
export default function QueueTrackPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const targetApptId = searchParams.get('appointmentId')

  const [allSessions, setAllSessions] = useState<Record<string, CheckInSession>>(readAllCheckInSessions)
  const sessionList = Object.values(allSessions)

  const [selectedKey, setSelectedKey] = useState<string | null>(() => {
    if (targetApptId && allSessions[targetApptId]) return targetApptId
    const initial = readCheckInSession()
    return initial ? (initial.appointmentId ?? initial.queueEntryId) : null
  })

  useEffect(() => {
    if (targetApptId && allSessions[targetApptId]) {
      setSelectedKey(targetApptId)
    }
  }, [targetApptId, allSessions])

  const activeSession = selectedKey ? (allSessions[selectedKey] ?? readCheckInSession()) : readCheckInSession()

  const handleStale = useCallback(() => {
    if (activeSession) {
      const key = activeSession.appointmentId ?? activeSession.queueEntryId
      clearCheckInSession(key)
    } else {
      clearCheckInSession()
    }
    const updated = readAllCheckInSessions()
    setAllSessions(updated)
    const remaining = Object.values(updated)
    setSelectedKey(remaining.length > 0 ? (remaining[remaining.length - 1].appointmentId ?? remaining[remaining.length - 1].queueEntryId) : null)
  }, [activeSession])

  const activeKey = activeSession ? (activeSession.appointmentId ?? activeSession.queueEntryId) : null

  return (
    <div>
      <PageHeader title="Live queue" back={false} />
      {sessionList.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-4 pt-3 pb-1">
          {sessionList.map((s) => {
            const k = s.appointmentId ?? s.queueEntryId
            const isSelected = k === activeKey
            return (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setSelectedKey(k)
                  if (s.appointmentId) {
                    setSearchParams({ appointmentId: s.appointmentId })
                  } else {
                    setSearchParams({})
                  }
                }}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isSelected
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Token #{s.tokenNumber}
              </button>
            )
          })}
        </div>
      )}
      {activeSession ? (
        <QueueSocketProvider key={activeSession.doctorId + activeKey} doctorId={activeSession.doctorId}>
          <QueueTracker session={activeSession} onStale={handleStale} />
        </QueueSocketProvider>
      ) : (
        <NotCheckedIn />
      )}
    </div>
  )
}

function QueueTracker({ session, onStale }: { session: CheckInSession; onStale: () => void }) {
  const { snapshot, status, lastUpdatedAt } = useQueue()
  const me = useMyToken(snapshot, session)

  // While disconnected we keep showing the last snapshot — tick every 30 s so the
  // "as of N min ago" age advances without a live update.
  const disconnected = status === 'reconnecting' || status === 'error'
  const now = useNow(30_000, disconnected)

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
      {disconnected && (
        <StaleBanner>
          {status === 'error' ? 'Connection problem — retrying…' : 'Reconnecting…'}
          {lastUpdatedAt != null && ` · Showing position as of ${relativeMinutesLabel(lastUpdatedAt, now)}`}
        </StaleBanner>
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
