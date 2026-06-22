import { api } from '@/lib/api/client'
import type { DependentView, ProfileView } from '@/types/api'

// All /me calls use the authenticated `api` instance (401 → refresh → retry is
// handled centrally there). Ownership is enforced server-side from the token, so
// no patient/dependent id is ever sent for the self routes.

// ── Profile ───────────────────────────────────────────────────────────────────
export interface UpdateProfileInput {
  fullName: string // required server-side, 1–200 chars
}

export async function getProfile(): Promise<ProfileView> {
  const { data } = await api.get<ProfileView>('/me/profile')
  return data
}

export async function updateProfile(input: UpdateProfileInput): Promise<ProfileView> {
  const { data } = await api.patch<ProfileView>('/me/profile', input)
  return data
}

// ── Phone change (OTP-gated, §14.6) ─────────────────────────────────────────────
// These live under /auth/* but are AUTHENTICATED (the actor is taken from the token,
// never the body), so they use the `api` instance — not `publicApi`. The OTP is sent
// to the NEW number; confirm swaps the phone after a version CAS server-side.
export async function requestPhoneChange(newPhone: string): Promise<{ status: string }> {
  const { data } = await api.post<{ status: string }>('/auth/patient/phone-change/request', {
    newPhone,
  })
  return data
}

export async function confirmPhoneChange(newPhone: string, code: string): Promise<void> {
  await api.post('/auth/patient/phone-change/confirm', { newPhone, code })
}

// ── Dependents ──────────────────────────────────────────────────────────────
export interface CreateDependentInput {
  fullName: string // required, 1–200
  dateOfBirth?: string // 'YYYY-MM-DD'
  relationship?: string // 1–60
}

// All fields optional; send only what changed.
export type UpdateDependentInput = Partial<CreateDependentInput>

export async function listDependents(): Promise<DependentView[]> {
  const { data } = await api.get<DependentView[]>('/me/dependents')
  return data
}

export async function getDependent(id: string): Promise<DependentView> {
  const { data } = await api.get<DependentView>(`/me/dependents/${id}`)
  return data
}

export async function createDependent(input: CreateDependentInput): Promise<DependentView> {
  const { data } = await api.post<DependentView>('/me/dependents', input)
  return data
}

export async function updateDependent(
  id: string,
  input: UpdateDependentInput,
): Promise<DependentView> {
  const { data } = await api.patch<DependentView>(`/me/dependents/${id}`, input)
  return data
}
