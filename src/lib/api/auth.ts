import { publicApi, getRefreshToken } from '@/lib/api/client'
import type { TokenPair } from '@/types/api'

// All auth calls use the interceptor-free `publicApi` instance: these routes are
// public and a 401 here (e.g. AUTH_OTP_INVALID) is a real error to surface, not
// an expired-access-token signal for the refresh interceptor to chase.

export async function requestOtp(phone: string): Promise<{ status: string }> {
  const { data } = await publicApi.post<{ status: string }>('/auth/patient/otp/request', { phone })
  return data
}

export async function verifyOtp(phone: string, code: string): Promise<TokenPair> {
  const { data } = await publicApi.post<TokenPair>('/auth/patient/otp/verify', { phone, code })
  return data
}

export async function refresh(refreshToken: string): Promise<TokenPair> {
  const { data } = await publicApi.post<TokenPair>('/auth/refresh', { refreshToken })
  return data
}

// Best-effort: revoke the refresh token server-side. Callers clear local state
// regardless of the outcome, so a failure here is swallowed.
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return
  try {
    await publicApi.post('/auth/logout', { refreshToken })
  } catch {
    // ignore — local tokens are cleared by the caller anyway
  }
}
