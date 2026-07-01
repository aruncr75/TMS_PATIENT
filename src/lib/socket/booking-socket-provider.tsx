import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { getActiveHold } from '@/lib/active-hold'
import { createBookingSocket, type BookingConnectionStatus } from './booking-socket'

interface SlotHoldState {
  heldCount: number
  bookedCount: number
  capacity: number
  version: number
}

interface BookingSocketContextValue {
  status: BookingConnectionStatus
  isHeldByOthers: (slotId: string, selectedSlotId?: string) => boolean
  getSlotState: (slotId: string) => SlotHoldState | undefined
}

const BookingSocketContext = createContext<BookingSocketContextValue | null>(null)

export function useBookingSocket() {
  const ctx = useContext(BookingSocketContext)
  if (!ctx) throw new Error('useBookingSocket must be used within BookingSocketProvider')
  return ctx
}

export function BookingSocketProvider({
  doctorId,
  date,
  children,
}: {
  doctorId: string
  date: string
  children: React.ReactNode
}) {
  const [status, setStatus] = useState<BookingConnectionStatus>('connecting')
  // We use state to trigger re-renders, but keep the map immutable for React reactivity.
  const [holdMap, setHoldMap] = useState<Record<string, SlotHoldState>>({})

  // Track versions to discard out-of-order events
  const versionsRef = useRef<Record<string, number>>({})

  useEffect(() => {
    if (!doctorId || !date) return

    let mounted = true

    const socket = createBookingSocket(doctorId, date, {
      onStatus: (s) => mounted && setStatus(s),
      onError: (code) => console.error('Booking socket error:', code),
      onSnapshot: (updates) => {
        if (!mounted) return
        setHoldMap((prev) => {
          const next = { ...prev }
          for (const u of updates) {
            // Overwrite state completely from snapshot (which is the source of truth)
            next[u.slotId] = {
              heldCount: u.heldCount,
              bookedCount: u.bookedCount,
              capacity: u.capacity,
              version: u.version,
            }
            versionsRef.current[u.slotId] = u.version
          }
          return next
        })
      },
      onSlotUpdate: (u) => {
        if (!mounted) return
        
        // Version guard
        const lastVersion = versionsRef.current[u.slotId] ?? 0
        if (u.version <= lastVersion) return
        versionsRef.current[u.slotId] = u.version

        setHoldMap((prev) => ({
          ...prev,
          [u.slotId]: {
            heldCount: u.heldCount,
            bookedCount: u.bookedCount,
            capacity: u.capacity,
            version: u.version,
          },
        }))
      },
    })

    return () => {
      mounted = false
      socket.disconnect()
    }
  }, [doctorId, date])

  const isHeldByOthers = (slotId: string, selectedSlotId?: string) => {
    if (slotId === selectedSlotId) return false // Handled by selected styling
    const state = holdMap[slotId]
    if (!state) return false
    
    const remaining = state.capacity - state.bookedCount
    
    // Strict evaluation order:
    // 1. If it's literally sold out, lock it immediately regardless of holds.
    if (remaining <= 0) return true
    
    // 2. If we are currently holding this slot (locally verified), don't lock us out of our own hold.
    const activeHold = getActiveHold()
    if (
      activeHold &&
      activeHold.slotId === slotId &&
      activeHold.doctorId === doctorId &&
      activeHold.clinicDate === date
    ) {
      return false
    }
    
    // 3. Otherwise, apply standard lock if other people's holds consume the remaining capacity.
    return state.heldCount >= remaining
  }

  const getSlotState = (slotId: string) => holdMap[slotId]

  return (
    <BookingSocketContext.Provider value={{ status, isHeldByOthers, getSlotState }}>
      {children}
    </BookingSocketContext.Provider>
  )
}
