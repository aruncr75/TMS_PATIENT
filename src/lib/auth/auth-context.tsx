import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  getAccessToken,
  setAccessToken,
  setRefreshToken,
  clearTokens,
  hydrateSession,
} from '@/lib/api/client'
import { logout as logoutApi } from '@/lib/api/auth'
import { unregisterForPush } from '@/lib/notifications/registration'
import { purgePersistedQueryCache } from '@/lib/query/persister'
import { decodeJwtSub } from '@/lib/auth/jwt'
import type { TokenPair } from '@/types/api'

interface AuthContextValue {
  isAuthenticated: boolean
  patientId: string | null
  /** True while the initial session-restore (refresh) is in flight on app start. */
  bootstrapping: boolean
  login: (tokens: TokenPair) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Authentication is gated on token presence, not on a successful JWT decode —
  // `patientId` is best-effort display data derived from the `sub` claim.
  const [authenticated, setAuthenticated] = useState(false)
  const [patientId, setPatientId] = useState<string | null>(null)
  const [bootstrapping, setBootstrapping] = useState(true)
  const queryClient = useQueryClient()

  // Single source of truth for wiping a session's cached PHI — the in-memory query
  // cache AND its persisted IndexedDB copy — so one patient's data can't surface for
  // the next account on a shared device. Clearing in-memory FIRST is what makes this
  // race-free: any persist write the cache subscription still fires now serializes an
  // empty cache, and idb-keyval runs set/del in call order, so this del lands after
  // (and thus wins over) any write already queued with the prior session's data.
  const resetSessionCache = useCallback(async () => {
    queryClient.clear()
    await purgePersistedQueryCache()
  }, [queryClient])

  // Restore session from the stored refresh token once on app start.
  // `hydrateSession` dedupes concurrent calls internally, so StrictMode's
  // double-mount cannot trigger a refresh-token-reuse family revocation.
  useEffect(() => {
    let cancelled = false
    hydrateSession()
      .then((ok) => {
        if (cancelled || !ok) return
        const token = getAccessToken()
        setAuthenticated(true)
        setPatientId(token ? decodeJwtSub(token) : null)
      })
      .finally(() => {
        if (!cancelled) setBootstrapping(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(
    (tokens: TokenPair) => {
      // Start every session from a clean cache so a previous account's persisted PHI
      // (e.g. after a forced logout that bypassed the graceful purge) can't surface
      // for the new patient on a shared device.
      void resetSessionCache()
      setAccessToken(tokens.accessToken)
      setRefreshToken(tokens.refreshToken)
      setAuthenticated(true)
      setPatientId(decodeJwtSub(tokens.accessToken))
    },
    [resetSessionCache],
  )

  const logout = useCallback(async () => {
    // Unregister this device's push token first — DELETE /me/devices needs the
    // bearer token, so it must run before clearTokens(). Best-effort: never block
    // logout on it.
    try {
      await unregisterForPush()
    } catch {
      // ignore
    }
    await logoutApi() // best-effort server-side revoke
    clearTokens()
    setAuthenticated(false)
    setPatientId(null)
    // Drop cached PHI (memory + persisted IndexedDB) so one patient's data can't
    // surface for the next account on a shared device.
    await resetSessionCache()
  }, [resetSessionCache])

  return (
    <AuthContext.Provider
      value={{ isAuthenticated: authenticated, patientId, bootstrapping, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
