import { Link, useNavigate } from 'react-router-dom'
import { useProfile } from '@/hooks/use-profile'
import { useAuth } from '@/lib/auth/auth-context'
import { useToast } from '@/components/ui/toast'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function ProfileViewPage() {
  const { data: profile, isPending, isError } = useProfile()
  const { logout } = useAuth()
  const { show } = useToast()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    show('Signed out', 'success')
    navigate('/login', { replace: true })
  }

  return (
    <div>
      <PageHeader title="Profile" back={false} />
      <div className="space-y-6 p-4">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          {isPending ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : isError || !profile ? (
            <p className="text-sm text-status-cancelled">Couldn&apos;t load your profile.</p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  {profile.fullName ? (
                    <p className="text-lg font-semibold text-gray-900">{profile.fullName}</p>
                  ) : (
                    <p className="text-base italic text-gray-400">Add your name</p>
                  )}
                  <p className="mt-1 text-sm text-gray-500">{profile.phone}</p>
                </div>
                {profile.phoneVerifiedAt && (
                  <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-status-confirmed">
                    ✓ Verified
                  </span>
                )}
              </div>
              <Link
                to="/profile/edit"
                className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline"
              >
                Edit profile
              </Link>
            </>
          )}
        </section>

        <Link
          to="/profile/dependents"
          className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm hover:bg-gray-50"
        >
          <span className="font-medium text-gray-900">Dependents</span>
          <span aria-hidden className="text-gray-400">
            ›
          </span>
        </Link>

        <Button variant="secondary" fullWidth onClick={handleLogout}>
          Log out
        </Button>
      </div>
    </div>
  )
}
