// TypeScript interfaces mirroring backend view shapes.
// Verified against backend/src/modules/* controllers and *.view.ts files.

// ── Auth ──────────────────────────────────────────────────────────────────────
// POST /auth/patient/otp/verify and POST /auth/refresh return this shape.
export interface TokenPair {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
}

// ── Identity ─────────────────────────────────────────────────────────────────
export interface ProfileView {
  id: string
  fullName: string | null
  phone: string
  phoneVerifiedAt: string | null
  createdAt: string
}

export interface DependentView {
  id: string
  fullName: string
  dateOfBirth: string | null
  relationship: string | null
  createdAt: string
}

// ── Doctors ───────────────────────────────────────────────────────────────────
// GET /doctors → DoctorCardView[]. Patient-facing booking directory: slim and
// PHI-free (no login email / status), mirrors backend toDoctorCardView.
export interface DoctorCardView {
  id: string
  displayName: string
  specialization: string | null
}

// ── Appointment FSM states ────────────────────────────────────────────────────
export type AppointmentStatus =
  | 'requested'
  | 'confirmed'
  | 'arrived'
  | 'checked_in_pending_ack'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'rescheduled'

// ── Appointments ─────────────────────────────────────────────────────────────
// Full PHI-gated read from GET /appointments/:id. Note: NO time field — only
// slotId. Resolve display times via SlotView (GET /doctors/:doctorId/slots).
// `reasonForVisit` is PHI-gated and may be null when redacted for the actor.
export interface AppointmentView {
  id: string
  patientProfileId: string
  dependentId: string | null
  doctorId: string
  slotId: string
  status: AppointmentStatus
  consultationType: string
  paymentStatus: string
  reasonForVisit: string | null
  rescheduleCount: number
  createdAt: string
  updatedAt: string
}

// PHI-free result of POST /appointments (confirm). Carries NO token number —
// token issuance happens at check-in.
export interface BookingConfirmationView {
  id: string
  status: string
  doctorId: string
  slotId: string
  dependentId: string | null
  consultationType: string
  paymentStatus: string
}

// POST /appointments/:id/cancel
export interface CancellationView {
  id: string
  status: string
  slotId: string
  feePercent: number
  feeWaived: boolean
}

// POST /appointments/:id/reschedule
export interface RescheduleView {
  id: string
  status: string
  slotId: string
  rescheduleCount: number
  fromAppointmentId: string
}

// ── Slots / Availability ──────────────────────────────────────────────────────
// GET /doctors/:doctorId/availability → SlotOption[] (PHI-free).
export interface SlotOption {
  slotId: string
  doctorId: string
  startAt: string
  endAt: string
}

// GET /doctors/:doctorId/slots → SlotView[]. Used in Phase 4 to resolve an
// appointment's display time by matching SlotView.id === AppointmentView.slotId.
export interface SlotView {
  id: string
  doctorId: string
  startAt: string
  endAt: string
  durationMinutes: number
  bufferMinutes: number
  requiredResourceId: string | null
  capacity: number
  status: 'open' | 'blocked'
}

// POST /appointments/holds → HoldResult. Holding never returns alternatives;
// last-slot-race alternatives surface on the confirm/reschedule error instead.
export interface HoldResult {
  holdId: string
  slotId: string
  expiresAt: string
}

// ── Check-in ─────────────────────────────────────────────────────────────────
export type TokenTier = 'emergency' | 'booked' | 'walk_in'

// POST /appointments/:id/check-in → CheckInView (queue.view.ts).
export interface CheckInView {
  appointmentId: string | null
  status: string
  queueEntryId: string
  tokenNumber: number
  tier: TokenTier
  doctorId: string
  serviceDate: string
}

// ── Queue ─────────────────────────────────────────────────────────────────────
export type QueueStatus =
  | 'waiting'
  | 'serving'
  | 'served'
  | 'skipped'
  | 'no_show'
  | 'removed'

// Public board entry — token numbers only, no PHI. ETA is per-entry.
export interface PublicQueueEntryView {
  tokenNumber: number
  tier: TokenTier
  status: QueueStatus
  position: number
  etaMinutes: number | null
}

// GET /doctors/:doctorId/queue and the WebSocket queue:update payload.
export interface QueueSnapshot {
  doctorId: string
  serviceDate: string
  seq: number
  nowServingToken: number | null
  entries: PublicQueueEntryView[]
}

// ── Waitlist ─────────────────────────────────────────────────────────────────
// Backend types `status` as a plain string; do not narrow to an invented union.
// status ∈ waiting | offered | accepted | expired | cancelled.
export interface WaitlistEntryView {
  id: string
  doctorId: string
  serviceDate: string
  status: string
  priorityScore: number
  offeredSlotId: string | null
  offerExpiresAt: string | null
  createdAt: string
}

// POST /doctors/:doctorId/waitlist body. NOTE the field-name split: the request
// sends `date` (a clinic-local YYYY-MM-DD), but the view above echoes it back as
// `serviceDate` — never send `serviceDate`. dependentId/consultationType are frozen
// here and flow straight through to the appointment created at accept.
export interface JoinWaitlistInput {
  date: string
  dependentId?: string
  consultationType?: 'free' | 'paid'
}

// ── Notifications / devices (Phase 7) ──────────────────────────────────────────
// POST /me/devices body. `platform` is an optional, non-authoritative hint; a web
// client always sends 'web'. Idempotent by token server-side (no idempotency key).
export type DevicePlatform = 'android' | 'ios' | 'web'

export interface RegisterDeviceInput {
  token: string
  platform?: DevicePlatform
}

// POST /me/devices → the device-token record id (ULID).
export interface DeviceRegistration {
  id: string
}

// PATCH /me/notification-preferences `{ optIn }` → `{ optIn }`. There is NO GET to
// read this back, so the client mirrors the choice locally (see use-notifications).
export interface NotificationPreference {
  optIn: boolean
}

// ── Error envelope ────────────────────────────────────────────────────────────
// Uniform backend error shape. Last-slot-race alternatives arrive here on a
// SLOT_UNAVAILABLE error from confirm/reschedule — never on HoldResult.
export interface ApiError {
  code: string
  message: string
  details?: {
    alternatives?: SlotOption[]
    [key: string]: unknown
  }
}
