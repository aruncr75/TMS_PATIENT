import type { AppointmentStatus } from '@/types/api'

// Active statuses still hold a slot; terminal ones don't. Grouping is status-driven
// (not time-driven) so it stays correct even when a slot is outside the resolved
// window. Resolved time is used only for ordering within a group.
const ACTIVE_STATUSES: AppointmentStatus[] = ['requested', 'confirmed', 'checked_in', 'in_progress']

export function isUpcoming(status: AppointmentStatus): boolean {
  return ACTIVE_STATUSES.includes(status)
}

// FSM gates (mirrors backend appointment-fsm): only confirmed/checked_in cancel;
// only confirmed reschedules. The backend is the true gate — these just shape UI.
export function canCancel(status: AppointmentStatus): boolean {
  return status === 'confirmed' || status === 'checked_in'
}

export function canReschedule(status: AppointmentStatus): boolean {
  return status === 'confirmed'
}

// Check-in is offered from `confirmed` (mirrors backend appointment-fsm check_in:
// confirmed → checked_in). The backend still owns the real gate, including the
// check-in window (§16.5) — this only shapes the UI's primary action.
export function canCheckIn(status: AppointmentStatus): boolean {
  return status === 'confirmed'
}

// Patient-facing reschedule limit. No patient-readable clinic-config endpoint
// exists, so this mirrors the backend value via env (default 3, matching the
// seed); the backend enforces the real limit (RESCHEDULE_LIMIT_REACHED).
export const RESCHEDULE_LIMIT = Number(import.meta.env.VITE_RESCHEDULE_LIMIT) || 3
