import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './app'
import { AuthProvider } from '@/lib/auth/auth-context'
import { ToastProvider } from '@/components/ui/toast'
import { setClinicTimezone } from '@/lib/utils/date'
import '@/styles/globals.css'

// Single-clinic deployment: all server dates are UTC and displayed / queried in
// the clinic timezone. Availability is searched by clinic-local YYYY-MM-DD, so
// this must be set before any date is formatted (otherwise it falls back to the
// browser TZ and drifts a day for non-IST environments).
setClinicTimezone(import.meta.env.VITE_CLINIC_TZ ?? 'Asia/Kolkata')

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
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
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
