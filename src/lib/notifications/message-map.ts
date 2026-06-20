import type { QueryKey } from '@tanstack/react-query'
import { appointmentsKey } from '@/hooks/use-appointments'
import { waitlistKey } from '@/hooks/use-waitlist'

// Foreground FCM copy + side-effects, keyed off the backend's ACTUAL `data.type`
// literals (verified against backend modules/notifications/notification-map.ts).
// NOTE: the ROADMAP's `booking.*`/`queue.*` names are fictional — do not use them.
// All payloads are data-only (no `notification` block), so the client builds its own
// title/body here for the foreground toast; the service worker keeps a parallel
// minimal copy for background notifications (it can't import this TS module).
//
// There is intentionally no `['queue']` invalidation: the live queue is Socket.IO
// driven (Phase 5), not a React Query, so queue/consultation messages only toast.

export type NotificationType =
  | 'appointment.confirmed'
  | 'appointment.reminder'
  | 'appointment.cancelled'
  | 'appointment.rescheduled'
  | 'appointment.checked_in'
  | 'consultation.now_serving'
  | 'doctor.running_late'
  | 'doctor.unavailable'
  | 'waitlist.offer'

// FCM data payloads are always string→string maps.
export type NotificationData = Record<string, string | undefined>

export interface NotificationCopy {
  title: string
  body: string
  /** In-app route to open on notification click. */
  route: string
  /** Query keys to invalidate when this arrives in the foreground. */
  invalidate: readonly QueryKey[]
  /** Surface more prominently (success styling) — time-critical messages. */
  urgent: boolean
}

export function describeNotification(data: NotificationData): NotificationCopy | null {
  const doctor = data.doctorName ?? 'your doctor'
  const token = data.tokenNumber

  switch (data.type) {
    case 'appointment.confirmed':
      return {
        title: 'Appointment confirmed',
        body: `Your appointment with ${doctor} is confirmed.`,
        route: '/appointments',
        invalidate: [appointmentsKey],
        urgent: false,
      }
    case 'appointment.reminder':
      return {
        title: 'Appointment reminder',
        body: `Reminder: your upcoming visit with ${doctor}.`,
        route: '/appointments',
        invalidate: [appointmentsKey],
        urgent: false,
      }
    case 'appointment.cancelled':
      return {
        title: 'Appointment cancelled',
        body: `Your appointment with ${doctor} was cancelled.`,
        route: '/appointments',
        invalidate: [appointmentsKey],
        urgent: false,
      }
    case 'appointment.rescheduled':
      return {
        title: 'Appointment rescheduled',
        body: `Your appointment with ${doctor} was rescheduled.`,
        route: '/appointments',
        invalidate: [appointmentsKey],
        urgent: false,
      }
    case 'appointment.checked_in':
      return {
        title: 'Checked in',
        body: token ? `You're checked in — your token is ${token}.` : `You're checked in.`,
        route: '/queue',
        invalidate: [],
        urgent: false,
      }
    case 'consultation.now_serving':
      return {
        title: "You're being called",
        body: token
          ? `Token ${token} — please proceed to ${doctor} now.`
          : `Please proceed to ${doctor} now.`,
        route: '/queue',
        invalidate: [],
        urgent: true,
      }
    case 'doctor.running_late':
      return {
        title: 'Doctor running late',
        body: data.delayMinutes
          ? `${doctor} is running about ${data.delayMinutes} min late.`
          : `${doctor} is running late.`,
        route: '/queue',
        invalidate: [],
        urgent: false,
      }
    case 'doctor.unavailable':
      return {
        title: 'Appointment affected',
        body: data.date
          ? `${doctor} is unavailable on ${data.date}.`
          : `${doctor} is unavailable.`,
        route: '/appointments',
        invalidate: [appointmentsKey],
        urgent: false,
      }
    case 'waitlist.offer':
      return {
        title: 'A slot just opened up',
        body: `A slot with ${doctor} is available — accept before it lapses.`,
        route: '/waitlist',
        invalidate: [waitlistKey],
        urgent: true,
      }
    default:
      return null
  }
}
