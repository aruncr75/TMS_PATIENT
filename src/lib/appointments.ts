import type { AppointmentStatus } from '@/types/api'

// Active statuses still hold a slot; terminal ones don't. Grouping is status-driven
// (not time-driven) so it stays correct even when a slot is outside the resolved
// window. Resolved time is used only for ordering within a group.
const ACTIVE_STATUSES: AppointmentStatus[] = [
  'requested',
  'confirmed',
  'arrived',
  'checked_in_pending_ack',
  'checked_in',
  'in_progress',
]

export function isUpcoming(status: AppointmentStatus): boolean {
  return ACTIVE_STATUSES.includes(status)
}

export function canCancel(status: AppointmentStatus): boolean {
  return status === 'confirmed' || status === 'arrived' || status === 'checked_in'
}

export function canReschedule(status: AppointmentStatus): boolean {
  return status === 'confirmed'
}

export function canArrive(status: AppointmentStatus): boolean {
  return status === 'confirmed'
}

export function canCheckIn(status: AppointmentStatus): boolean {
  return status === 'confirmed' || status === 'arrived'
}

// Patient-facing reschedule limit. No patient-readable clinic-config endpoint
// exists, so this mirrors the backend value via env (default 3, matching the
// seed); the backend enforces the real limit (RESCHEDULE_LIMIT_REACHED).
export const RESCHEDULE_LIMIT = Number(import.meta.env.VITE_RESCHEDULE_LIMIT) || 3
