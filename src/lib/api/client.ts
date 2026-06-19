import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

export const api = axios.create({
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

  const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
    `${BASE_URL}/auth/refresh`,
    { refreshToken },
  )

  setAccessToken(data.accessToken)
  setRefreshToken(data.refreshToken)
  return data.accessToken
}

// ── Initialise session from stored refresh token on app start ─────────────────
export async function hydrateSession(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false
  try {
    await performRefresh()
    return true
  } catch {
    clearTokens()
    return false
  }
}
