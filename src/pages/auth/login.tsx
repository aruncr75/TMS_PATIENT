import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { requestOtp } from '@/lib/api/auth'
import { getApiError } from '@/lib/api/error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// E.164: a leading + and 7–15 digits. The backend enforces this too; we just
// avoid a guaranteed-400 round-trip.
const E164 = /^\+[1-9]\d{6,14}$/

export default function LoginPage() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmed = phone.trim()
    if (!E164.test(trimmed)) {
      setError('Enter your phone number in international format, e.g. +14155550123')
      return
    }

    setSubmitting(true)
    try {
      await requestOtp(trimmed)
      // Carry the phone forward — verify requires { phone, code }.
      navigate('/verify', { state: { phone: trimmed } })
    } catch (err) {
      // Do NOT auto-retry: OTP requests are rate-limited 3/min; just surface it.
      setError(getApiError(err).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg"
        noValidate
      >
        <h1 className="text-2xl font-bold text-gray-900">Sign in</h1>
        <p className="mt-1 text-sm text-gray-500">
          We&apos;ll text a one-time code to your phone.
        </p>

        <div className="mt-6">
          <Input
            label="Phone number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+14155550123"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={error}
            disabled={submitting}
            autoFocus
          />
        </div>

        <Button type="submit" fullWidth loading={submitting} className="mt-6">
          Send code
        </Button>
      </form>
    </div>
  )
}
