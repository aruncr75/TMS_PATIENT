import { api } from '@/lib/api/client'
import type { AppointmentView, SlotView } from '@/types/api'

// Appointment reads (Phase 4). All use the authenticated `api` instance
// (401 → refresh → retry is handled there).

// ── List ──────────────────────────────────────────────────────────────────────
export async function listAppointments(): Promise<AppointmentView[]> {
  const { data } = await api.get<AppointmentView[]>('/appointments')
  return data
}

// ── Get one ───────────────────────────────────────────────────────────────────
export async function getAppointment(id: string): Promise<AppointmentView> {
  const { data } = await api.get<AppointmentView>(`/appointments/${id}`)
  return data
}

// ── Doctor slots ──────────────────────────────────────────────────────────────
// AppointmentView carries no time field — only `slotId`. Resolve display times by
// matching against a doctor's SlotView[]. The endpoint defaults to today-only, so
// callers pass a clinic-local `from`/`to` window (YYYY-MM-DD) to cover their span.
export async function getDoctorSlots(
  doctorId: string,
  range?: { from: string; to: string },
): Promise<SlotView[]> {
  const { data } = await api.get<SlotView[]>(`/doctors/${doctorId}/slots`, {
    params: range,
  })
  return data
}
