import { Routes, Route, Navigate } from 'react-router-dom'

// Phase 1 — Auth (implemented in Phase 1)
// import LoginPage from '@/pages/auth/login'
// import VerifyOtpPage from '@/pages/auth/verify-otp'

// Phase 1 — Home shell placeholder
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

export default function App() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/login" element={<PlaceholderPage label="Login — Phase 1" />} />
      <Route path="/verify" element={<PlaceholderPage label="Verify OTP — Phase 1" />} />

      {/* Home */}
      <Route path="/" element={<PlaceholderPage label="Home — Phase 1" />} />

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

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
