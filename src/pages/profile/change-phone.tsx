import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRequestPhoneChange, useConfirmPhoneChange } from '@/hooks/use-phone-change'
import { getApiError } from '@/lib/api/error'
import { useToast } from '@/components/ui/toast'
import { PageHeader } from '@/components/layout/page-header'
import { OtpInput } from '@/components/otp-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// E.164: a leading + and 7–15 digits. The backend enforces this too; we just avoid a
// guaranteed-400 round-trip (mirrors login.tsx).
const E164 = /^\+[1-9]\d{6,14}$/
const CODE_LENGTH = 6

// OTP-gated phone change (§14.6): step 1 sends a code to the NEW number; step 2 confirms
// it. Mirrors the public login→verify flow, but authenticated and inside the profile area.
export default function ChangePhonePage() {
  const navigate = useNavigate()
  const { show } = useToast()
  const request = useRequestPhoneChange()
  const confirm = useConfirmPhoneChange()

  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [newPhone, setNewPhone] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submitPhone = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const trimmed = newPhone.trim()
    if (!E164.test(trimmed)) {
      setError('Enter the new number in international format, e.g. +14155550123')
      return
    }
    setNewPhone(trimmed)
    request.mutate(trimmed, {
      onSuccess: () => setStep('code'),
      // Don't auto-retry: OTP requests are rate-limited 3/min — just surface it.
      onError: (err) => setError(getApiError(err).message),
    })
  }

  const submitCode = (value: string) => {
    if (value.length !== CODE_LENGTH || confirm.isPending) return
    setError(null)
    confirm.mutate(
      { newPhone, code: value },
      {
        onSuccess: () => {
          show('Phone number updated', 'success')
          navigate('/profile', { replace: true })
        },
        onError: (err) => {
          // A wrong/expired code returns 401 AUTH_OTP_INVALID — surface it inline.
          setError(getApiError(err).message)
          setCode('')
        },
      },
    )
  }

  return (
    <div>
      <PageHeader title="Change phone number" />
      <div className="p-4">
        {step === 'phone' ? (
          <form onSubmit={submitPhone} className="flex flex-col gap-5" noValidate>
            <p className="text-sm text-gray-500">
              We&apos;ll text a one-time code to the new number to confirm it&apos;s yours.
            </p>
            <Input
              label="New phone number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+14155550123"
              value={newPhone}
              onChange={(e) => {
                setNewPhone(e.target.value)
                if (error) setError(null)
              }}
              error={error}
              disabled={request.isPending}
              autoFocus
            />
            <Button type="submit" fullWidth loading={request.isPending}>
              Send code
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-gray-500">
              Enter the code sent to{' '}
              <span className="font-medium text-gray-700">{newPhone}</span>.
            </p>
            <OtpInput
              value={code}
              onChange={(v) => {
                setCode(v)
                if (error) setError(null)
              }}
              length={CODE_LENGTH}
              disabled={confirm.isPending}
              autoFocus
              onComplete={(v) => submitCode(v)}
            />
            {error && (
              <p className="text-center text-sm text-status-cancelled" role="alert">
                {error}
              </p>
            )}
            <Button
              fullWidth
              loading={confirm.isPending}
              disabled={code.length !== CODE_LENGTH}
              onClick={() => submitCode(code)}
            >
              Confirm
            </Button>
            <button
              type="button"
              onClick={() => {
                setStep('phone')
                setCode('')
                setError(null)
              }}
              className="w-full text-center text-sm font-medium text-brand-700 hover:underline"
            >
              Use a different number
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
