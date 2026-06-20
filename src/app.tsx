import { Routes, Route, Navigate, Link } from 'react-router-dom'
import LoginPage from '@/pages/auth/login'
import VerifyOtpPage from '@/pages/auth/verify-otp'
import ProfileViewPage from '@/pages/profile/view'
import ProfileEditPage from '@/pages/profile/edit'
import DependentsPage from '@/pages/profile/dependents'
import AddDependentPage from '@/pages/profile/add-dependent'
import EditDependentPage from '@/pages/profile/edit-dependent'
import DoctorSelectPage from '@/pages/booking/doctor-select'
import SlotPickerPage from '@/pages/booking/slot-picker'
import BookingConfirmPage from '@/pages/booking/booking-confirm'
import BookingSuccessPage from '@/pages/booking/booking-success'
import AppointmentsListPage from '@/pages/appointments/list'
import AppointmentDetailPage from '@/pages/appointments/detail'
import CancelAppointmentPage from '@/pages/appointments/cancel'
import ReschedulePage from '@/pages/appointments/reschedule'
import CheckInPage from '@/pages/queue/checkin'
import QueueTrackPage from '@/pages/queue/track'
import WaitlistListPage from '@/pages/waitlist/list'
import WaitlistAcceptPage from '@/pages/waitlist/accept'
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
        <Link
          to="/waitlist"
          className="block rounded-2xl bg-white p-5 text-center font-semibold text-brand-700 shadow-sm hover:bg-brand-50"
        >
          My waitlist
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
          <Route path="/book" element={<DoctorSelectPage />} />
          <Route path="/book/:doctorId/slots" element={<SlotPickerPage />} />
          <Route path="/book/:doctorId/confirm" element={<BookingConfirmPage />} />
          <Route path="/book/success" element={<BookingSuccessPage />} />

          {/* Appointments */}
          <Route path="/appointments" element={<AppointmentsListPage />} />
          <Route path="/appointments/:id" element={<AppointmentDetailPage />} />
          <Route path="/appointments/:id/cancel" element={<CancelAppointmentPage />} />
          <Route path="/appointments/:id/reschedule" element={<ReschedulePage />} />

          {/* Queue */}
          <Route path="/appointments/:id/checkin" element={<CheckInPage />} />
          <Route path="/queue" element={<QueueTrackPage />} />

          {/* Waitlist */}
          <Route path="/waitlist" element={<WaitlistListPage />} />
          <Route path="/waitlist/:id/accept" element={<WaitlistAcceptPage />} />

          {/* Notifications */}
          <Route path="/notifications" element={<PlaceholderPage label="Notification Settings — Phase 7" />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
