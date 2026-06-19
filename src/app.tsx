import { Routes, Route, Navigate, Link } from 'react-router-dom'
import LoginPage from '@/pages/auth/login'
import VerifyOtpPage from '@/pages/auth/verify-otp'
import ProfileViewPage from '@/pages/profile/view'
import ProfileEditPage from '@/pages/profile/edit'
import DependentsPage from '@/pages/profile/dependents'
import AddDependentPage from '@/pages/profile/add-dependent'
import EditDependentPage from '@/pages/profile/edit-dependent'
import { AuthGuard } from '@/lib/auth/auth-guard'
import { AppShell } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/layout/page-header'

function PlaceholderPage({ label }: { label: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-lg font-semibold text-brand-700">{label}</p>
      <p className="mt-1 text-sm text-gray-400">Coming in the roadmap phase</p>
    </div>
  )
}

// Minimal home: the bottom-tab nav (AppShell) now handles navigation. Profile,
// including logout, lives on the Profile tab.
function HomePage() {
  return (
    <div>
      <PageHeader title="Home" back={false} />
      <div className="space-y-4 p-4">
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-brand-700">Welcome back</p>
          <p className="mt-1 text-sm text-gray-500">Book a visit or manage your appointments.</p>
        </div>
        <Link
          to="/book"
          className="block rounded-2xl bg-brand-600 p-5 text-center font-semibold text-white hover:bg-brand-700"
        >
          Book an appointment
        </Link>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify" element={<VerifyOtpPage />} />

      {/* Everything below requires an authenticated session and shares the app shell */}
      <Route element={<AuthGuard />}>
        <Route element={<AppShell />}>
          {/* Home */}
          <Route path="/" element={<HomePage />} />

          {/* Profile */}
          <Route path="/profile" element={<ProfileViewPage />} />
          <Route path="/profile/edit" element={<ProfileEditPage />} />
          <Route path="/profile/dependents" element={<DependentsPage />} />
          <Route path="/profile/dependents/add" element={<AddDependentPage />} />
          <Route path="/profile/dependents/:id/edit" element={<EditDependentPage />} />

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
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
