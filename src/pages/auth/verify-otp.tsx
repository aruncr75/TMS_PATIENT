import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { verifyOtp } from '@/lib/api/auth'
import { getApiError } from '@/lib/api/error'
import { useAuth } from '@/lib/auth/auth-context'
import { OtpInput } from '@/components/otp-input'
import { Button } from '@/components/ui/button'

const CODE_LENGTH = 6

export default function VerifyOtpPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const phone = (location.state as { phone?: string } | null)?.phone

  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Reached without a phone (deep link / refresh) — restart the flow.
  if (!phone) return <Navigate to="/login" replace />

  const submit = async (value: string) => {
    if (value.length !== CODE_LENGTH || submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const tokens = await verifyOtp(phone, value)
      login(tokens)
      navigate('/', { replace: true })
    } catch (err) {
      // A wrong/expired code returns 401 — surfaced here, no redirect, no crash.
      setError(getApiError(err).message)
      setCode('')
      setSubmitting(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void submit(code)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-gray-900">Enter code</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sent to <span className="font-medium text-gray-700">{phone}</span>
        </p>

        <div className="mt-6">
          <OtpInput
            value={code}
            onChange={(v) => {
              setCode(v)
              if (error) setError(null)
            }}
            length={CODE_LENGTH}
            disabled={submitting}
            autoFocus
            onComplete={(v) => void submit(v)}
          />
          {error && (
            <p className="mt-3 text-center text-sm text-status-cancelled" role="alert">
              {error}
            </p>
          )}
        </div>

        <Button
          type="submit"
          fullWidth
          loading={submitting}
          disabled={code.length !== CODE_LENGTH}
          className="mt-6"
        >
          Verify
        </Button>

        <button
          type="button"
          onClick={() => navigate('/login', { replace: true })}
          className="mt-4 w-full text-center text-sm font-medium text-brand-700 hover:underline"
        >
          Use a different number
        </button>
      </form>
    </div>
  )
}
