import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile, useUpdateProfile } from '@/hooks/use-profile'
import { getApiError } from '@/lib/api/error'
import { useToast } from '@/components/ui/toast'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

export default function ProfileEditPage() {
  const { data: profile, isPending } = useProfile()
  const update = useUpdateProfile()
  const { show } = useToast()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [initialised, setInitialised] = useState(false)

  // Prefill once, when the profile first arrives (fullName may be null).
  useEffect(() => {
    if (profile && !initialised) {
      setFullName(profile.fullName ?? '')
      setInitialised(true)
    }
  }, [profile, initialised])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = fullName.trim()
    if (!trimmed) {
      setError('Name is required.')
      return
    }
    update.mutate(
      { fullName: trimmed },
      {
        onSuccess: () => {
          show('Profile updated', 'success')
          navigate(-1)
        },
        onError: (err) => setError(getApiError(err).message),
      },
    )
  }

  return (
    <div>
      <PageHeader title="Edit profile" />
      <div className="p-4">
        {isPending ? (
          <Skeleton className="h-12 w-full" />
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <Input
              label="Full name"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value)
                if (error) setError(null)
              }}
              error={error}
              disabled={update.isPending}
              autoComplete="name"
              autoFocus
            />
            <Button type="submit" fullWidth loading={update.isPending}>
              Save
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
