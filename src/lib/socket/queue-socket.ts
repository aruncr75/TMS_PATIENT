import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@/types/socket'
import type { QueueSnapshot } from '@/types/api'

function getWsUrl(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    if (import.meta.env.VITE_API_URL) {
      try {
        const url = new URL(import.meta.env.VITE_API_URL, window.location.origin)
        return url.origin
      } catch {}
    }
    return `${protocol}//${hostname}:3000`
  }
  return 'http://localhost:3000'
}

const WS_URL = getWsUrl()

export type QueueConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'error'

export interface QueueSocketHandlers {
  /** A fresh snapshot arrived (initial replay on connect, or any change). The seq
   *  guard lives in the provider so REST seeds and live pushes share one authority. */
  onSnapshot: (snapshot: QueueSnapshot) => void
  onStatus: (status: QueueConnectionStatus) => void
  /** A `queue:error` (e.g. DOCTOR_ID_REQUIRED); the server disconnects right after. */
  onError: (code: string) => void
  /** Manager reconnected — the gateway re-pushes on connect, but signal so the caller
   *  can REST-seed immediately to bridge any gap before live resumes. */
  onReconnect?: () => void
}

export interface QueueSocketHandle {
  disconnect: () => void
}

// Open the public `/queue` namespace for one doctor. The gateway REQUIRES a
// `?doctorId=` query (else it emits `queue:error { DOCTOR_ID_REQUIRED }` and
// disconnects). No JWT is required on this channel. The server pushes a full
// QueueSnapshot on connect and on every change — the payload IS the snapshot.
export function createQueueSocket(doctorId: string, handlers: QueueSocketHandlers): QueueSocketHandle {
  // `forceNew`: doctorId lives in the query, not the URL, and Socket.IO multiplexes
  // (caches) the Manager by URL. Without this, switching doctors would reuse the
  // cached socket with the OLD ?doctorId — and our teardown (full disconnect) assumes
  // one socket per doctor. forceNew gives each doctorId its own connection + clean
  // disposal (also avoids a dev StrictMode remount sharing a torn-down manager).
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(`${WS_URL}/queue`, {
    query: { doctorId },
    forceNew: true,
  })

  handlers.onStatus('connecting')

  socket.on('connect', () => handlers.onStatus('live'))
  socket.on('queue:update', (snapshot) => handlers.onSnapshot(snapshot))
  socket.on('queue:error', (err) => {
    handlers.onStatus('error')
    handlers.onError(err.code)
  })
  socket.on('disconnect', () => handlers.onStatus('reconnecting'))
  socket.on('connect_error', () => handlers.onStatus('reconnecting'))
  socket.io.on('reconnect', () => {
    handlers.onStatus('live')
    handlers.onReconnect?.()
  })

  return {
    disconnect: () => {
      socket.io.off('reconnect')
      socket.removeAllListeners()
      socket.disconnect()
    },
  }
}
