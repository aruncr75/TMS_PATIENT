import { io, type Socket } from 'socket.io-client'
import type { BookingClientToServerEvents, BookingServerToClientEvents, SlotHoldUpdate } from '@/types/socket'

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3000'

export type BookingConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'error'

export interface BookingSocketHandlers {
  onSlotUpdate: (update: SlotHoldUpdate) => void
  onSnapshot: (updates: SlotHoldUpdate[]) => void
  onStatus: (status: BookingConnectionStatus) => void
  onError: (code: string) => void
  onReconnect?: () => void
}

export interface BookingSocketHandle {
  disconnect: () => void
}

export function createBookingSocket(
  doctorId: string,
  date: string,
  handlers: BookingSocketHandlers,
): BookingSocketHandle {
  const socket: Socket<BookingServerToClientEvents, BookingClientToServerEvents> = io(`${WS_URL}/booking`, {
    query: { doctorId, date },
    forceNew: true, // Requires fresh socket on date or doctorId change
  })

  handlers.onStatus('connecting')

  socket.on('connect', () => handlers.onStatus('live'))
  socket.on('slot:hold-update', (update) => handlers.onSlotUpdate(update))
  socket.on('slot:snapshot', (updates) => handlers.onSnapshot(updates))
  socket.on('slot:error', (err) => {
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
