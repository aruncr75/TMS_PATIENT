import type { QueueSnapshot } from './api'

// Socket.IO event payload types for the /queue namespace.
// The gateway emits `client.emit('queue:update', snapshot)` — the payload IS the
// QueueSnapshot directly (not wrapped). See backend queue.gateway.ts.

export interface ServerToClientEvents {
  'queue:update': (snapshot: QueueSnapshot) => void
  // Emitted as { code: 'DOCTOR_ID_REQUIRED' } when the connection lacks ?doctorId=,
  // followed immediately by a disconnect.
  'queue:error': (err: { code: string }) => void
}

// No client→server events on the queue namespace in v1.
export type ClientToServerEvents = Record<string, never>
