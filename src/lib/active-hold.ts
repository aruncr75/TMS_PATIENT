import type { HoldResult } from '@/types/api'
import { releaseHold } from './api/booking'

export const ACTIVE_HOLD_KEY = 'tms_active_hold'

export interface ActiveHold extends HoldResult {
  doctorId: string
  clinicDate: string
  patientId?: string | null
}

export function setActiveHold(hold: ActiveHold): void {
  sessionStorage.setItem(ACTIVE_HOLD_KEY, JSON.stringify(hold))
}

export function clearActiveHold(): void {
  const stored = sessionStorage.getItem(ACTIVE_HOLD_KEY)
  if (stored) {
    try {
      const hold = JSON.parse(stored) as ActiveHold
      // Fire-and-forget release to immediately free the backend slot
      void releaseHold(hold.slotId, hold.holdId).catch(() => {})
    } catch {}
  }
  sessionStorage.removeItem(ACTIVE_HOLD_KEY)
}

export function getActiveHold(): ActiveHold | null {
  const stored = sessionStorage.getItem(ACTIVE_HOLD_KEY)
  if (!stored) return null

  try {
    const hold = JSON.parse(stored) as ActiveHold
    // Check if expired
    if (new Date(hold.expiresAt) <= new Date()) {
      clearActiveHold()
      return null
    }
    return hold
  } catch {
    clearActiveHold()
    return null
  }
}
