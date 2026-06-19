import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'

export const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Interceptor-free instance for public auth routes (otp request/verify, logout).
// These must NOT pass through the 401-refresh interceptor below: during login
// there is no refresh token, so a wrong-OTP 401 would otherwise be mistaken for
// an expired access token and hard-redirect to /login instead of surfacing the
// error. `performRefresh` likewise hits the API outside the interceptor.
export const publicApi = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor: attach access token ──────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken()
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

// ── Response interceptor: 401 → refresh → retry ──────────────────────────────
let refreshPromise: Promise<string> | null = null

api.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    const err = error as { config?: AxiosRequestConfig & { _retried?: boolean }; response?: { status?: number } }
    const status = err.response?.status
    const config = err.config

    if (status === 401 && config && !config._retried) {
      config._retried = true

      try {
        if (!refreshPromise) {
          refreshPromise = performRefresh().finally(() => {
            refreshPromise = null
          })
        }
        const newAccessToken = await refreshPromise
        if (config.headers) {
          (config.headers as Record<string, string>)['Authorization'] = `Bearer ${newAccessToken}`
        }
        return api(config)
      } catch {
        clearTokens()
        window.location.replace('/login')
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  },
)

// ── Token storage (access: memory; refresh: localStorage) ────────────────────
let _accessToken: string | null = null

export function getAccessToken() { return _accessToken }
export function setAccessToken(token: string) { _accessToken = token }

export function getRefreshToken() { return localStorage.getItem('refresh_token') }
export function setRefreshToken(token: string) { localStorage.setItem('refresh_token', token) }

export function clearTokens() {
  _accessToken = null
  localStorage.removeItem('refresh_token')
}

async function performRefresh(): Promise<string> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) throw new Error('No refresh token')

  const { data } = await publicApi.post<{ accessToken: string; refreshToken: string }>(
    '/auth/refresh',
    { refreshToken },
  )

  setAccessToken(data.accessToken)
  setRefreshToken(data.refreshToken)
  return data.accessToken
}

// ── Initialise session from stored refresh token on app start ─────────────────
// Refresh tokens are single-use + rotated; presenting an already-rotated token
// revokes the whole family. React StrictMode double-invokes the mount effect,
// so concurrent calls must share ONE in-flight refresh rather than each
// presenting the same stored token.
let hydratePromise: Promise<boolean> | null = null

export function hydrateSession(): Promise<boolean> {
  if (hydratePromise) return hydratePromise
  hydratePromise = (async () => {
    const refreshToken = getRefreshToken()
    if (!refreshToken) return false
    try {
      await performRefresh()
      return true
    } catch {
      clearTokens()
      return false
    }
  })().finally(() => {
    hydratePromise = null
  })
  return hydratePromise
}
