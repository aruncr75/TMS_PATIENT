import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import App from './app'
import { AuthProvider } from '@/lib/auth/auth-context'
import { ToastProvider } from '@/components/ui/toast'
import { setClinicTimezone } from '@/lib/utils/date'
import { queryPersister } from '@/lib/query/persister'
import '@/styles/globals.css'

// Bump to invalidate every persisted cache after a query-shape change (Phase 8).
const CACHE_BUSTER = 'v1'
const DAY_MS = 24 * 60 * 60 * 1000

// Single-clinic deployment: all server dates are UTC and displayed / queried in
// the clinic timezone. Availability is searched by clinic-local YYYY-MM-DD, so
// this must be set before any date is formatted (otherwise it falls back to the
// browser TZ and drifts a day for non-IST environments).
setClinicTimezone(import.meta.env.VITE_CLINIC_TZ ?? 'Asia/Kolkata')

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Keep cached queries for a day so the IndexedDB persister can restore them
      // when the patient reopens the app offline (must be ≥ the persist maxAge below).
      gcTime: DAY_MS,
      retry: (failureCount, error: unknown) => {
        const status = (error as { response?: { status?: number } })?.response?.status
        if (status && status >= 400 && status < 500 && status !== 401) return false
        return failureCount < 2
      },
    },
  },
})

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: DAY_MS,
        buster: CACHE_BUSTER,
        // Only persist completed (successful) queries — never errors or in-flight
        // state — so a cold offline reload restores real data, not failure shells.
        // Never persist mutations: the default dehydrates *paused* (offline) ones,
        // which would write request-body PHI to IndexedDB and, with no
        // resumePausedMutations on restore, silently strand them.
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => query.state.status === 'success',
          shouldDehydrateMutation: () => false,
        },
      }}
    >
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </PersistQueryClientProvider>
  </StrictMode>,
)
