import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { getQueueSnapshot } from '@/lib/api/checkin'
import { createQueueSocket, type QueueConnectionStatus } from './queue-socket'
import type { QueueSnapshot } from '@/types/api'

interface QueueSocketContextValue {
  snapshot: QueueSnapshot | null
  status: QueueConnectionStatus
  errorCode: string | null
}

const QueueSocketContext = createContext<QueueSocketContextValue | null>(null)

// Owns the live-queue connection for ONE doctor. Scoped to the queue screen (not
// global): the socket exists only while the patient is watching, which matches the
// roadmap's "works as long as the tab is open; no background push" (background
// delivery is Phase 7 / FCM).
export function QueueSocketProvider({ doctorId, children }: { doctorId: string; children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<QueueSnapshot | null>(null)
  const [status, setStatus] = useState<QueueConnectionStatus>('connecting')
  const [errorCode, setErrorCode] = useState<string | null>(null)

  // Single seq authority (§17.4): both live pushes and REST seeds funnel through
  // `applySnapshot`, so a slower REST response can never clobber a newer live frame.
  const lastSeqRef = useRef(-1)

  useEffect(() => {
    let active = true
    // seq spaces are per-doctor — reset the baseline when the doctor changes.
    lastSeqRef.current = -1
    setSnapshot(null)
    setStatus('connecting')
    setErrorCode(null)

    const applySnapshot = (next: QueueSnapshot) => {
      if (!active || next.seq < lastSeqRef.current) return
      lastSeqRef.current = next.seq
      setSnapshot(next)
    }

    // Cold start: REST seed for an instant first paint, before the socket handshake.
    void getQueueSnapshot(doctorId)
      .then(applySnapshot)
      .catch(() => {
        /* the socket's connect-time push will seed shortly */
      })

    const handle = createQueueSocket(doctorId, {
      onSnapshot: applySnapshot,
      onStatus: (s) => {
        if (active) setStatus(s)
      },
      onError: (code) => {
        if (active) setErrorCode(code)
      },
      onReconnect: () => {
        void getQueueSnapshot(doctorId).then(applySnapshot).catch(() => {})
      },
    })

    return () => {
      active = false
      handle.disconnect()
    }
  }, [doctorId])

  return (
    <QueueSocketContext.Provider value={{ snapshot, status, errorCode }}>
      {children}
    </QueueSocketContext.Provider>
  )
}

export function useQueueSocket(): QueueSocketContextValue {
  const ctx = useContext(QueueSocketContext)
  if (!ctx) throw new Error('useQueueSocket must be used within a QueueSocketProvider')
  return ctx
}
