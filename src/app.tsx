import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import LoginPage from '@/pages/auth/login'
import VerifyOtpPage from '@/pages/auth/verify-otp'
import { AuthGuard } from '@/lib/auth/auth-guard'
import { useAuth } from '@/lib/auth/auth-context'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'

function PlaceholderPage({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50">
      <div className="rounded-xl bg-white p-8 shadow text-center">
        <p className="text-brand-700 font-semibold text-lg">{label}</p>
        <p className="text-gray-400 text-sm mt-1">Coming in the roadmap phase</p>
      </div>
    </div>
  )
}

// Phase 1 home: minimal shell with a working logout so the auth flow is
// end-to-end testable. Real home content lands in Phase 2.
function HomePage() {
  const { logout, patientId } = useAuth()
  const { show } = useToast()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    show('Signed out', 'success')
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-brand-50 px-4">
      <div className="rounded-2xl bg-white p-8 text-center shadow-lg">
        <p className="text-lg font-semibold text-brand-700">You&apos;re signed in</p>
        <p className="mt-1 break-all text-sm text-gray-400">Patient ID: {patientId}</p>
      </div>
      <Button variant="secondary" onClick={handleLogout}>
        Log out
      </Button>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify" element={<VerifyOtpPage />} />

      {/* Everything below requires an authenticated session */}
      <Route element={<AuthGuard />}>
        {/* Home */}
        <Route path="/" element={<HomePage />} />

        {/* Profile */}
        <Route path="/profile" element={<PlaceholderPage label="Profile — Phase 2" />} />
        <Route path="/profile/edit" element={<PlaceholderPage label="Edit Profile — Phase 2" />} />
        <Route path="/profile/dependents" element={<PlaceholderPage label="Dependents — Phase 2" />} />
        <Route path="/profile/dependents/add" element={<PlaceholderPage label="Add Dependent — Phase 2" />} />

        {/* Booking */}
        <Route path="/book" element={<PlaceholderPage label="Select Doctor — Phase 3" />} />
        <Route path="/book/:doctorId/slots" element={<PlaceholderPage label="Slot Picker — Phase 3" />} />
        <Route path="/book/:doctorId/confirm" element={<PlaceholderPage label="Booking Confirm — Phase 3" />} />
        <Route path="/book/success" element={<PlaceholderPage label="Booking Success — Phase 3" />} />

        {/* Appointments */}
        <Route path="/appointments" element={<PlaceholderPage label="My Appointments — Phase 4" />} />
        <Route path="/appointments/:id" element={<PlaceholderPage label="Appointment Detail — Phase 4" />} />
        <Route path="/appointments/:id/cancel" element={<PlaceholderPage label="Cancel — Phase 4" />} />
        <Route path="/appointments/:id/reschedule" element={<PlaceholderPage label="Reschedule — Phase 4" />} />

        {/* Queue */}
        <Route path="/appointments/:id/checkin" element={<PlaceholderPage label="Check In — Phase 5" />} />
        <Route path="/queue" element={<PlaceholderPage label="Queue Tracker — Phase 5" />} />

        {/* Waitlist */}
        <Route path="/waitlist" element={<PlaceholderPage label="Waitlist — Phase 6" />} />
        <Route path="/waitlist/:id/accept" element={<PlaceholderPage label="Accept Slot — Phase 6" />} />

        {/* Notifications */}
        <Route path="/notifications" element={<PlaceholderPage label="Notification Settings — Phase 7" />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
