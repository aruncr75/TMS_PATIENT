import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDependents, useUpdateDependent } from '@/hooks/use-dependents'
import { getApiError } from '@/lib/api/error'
import { useToast } from '@/components/ui/toast'
import { PageHeader } from '@/components/layout/page-header'
import { DependentForm, type DependentFormValues } from '@/components/dependent-form'
import { Skeleton } from '@/components/ui/skeleton'
import type { UpdateDependentInput } from '@/lib/api/identity'

export default function EditDependentPage() {
  const { id } = useParams<{ id: string }>()
  // The list query also satisfies a deep-link/refresh: it fetches if the cache is empty.
  const { data: dependents, isPending } = useDependents()
  const update = useUpdateDependent()
  const { show } = useToast()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const dependent = dependents?.find((d) => d.id === id)

  const handleSubmit = (values: DependentFormValues) => {
    if (!dependent || !id) return

    // Send only changed, non-empty fields (the DTO can't clear a field to null).
    const patch: UpdateDependentInput = {}
    if (values.fullName !== dependent.fullName) patch.fullName = values.fullName
    if (values.dateOfBirth && values.dateOfBirth !== (dependent.dateOfBirth ?? ''))
      patch.dateOfBirth = values.dateOfBirth
    if (values.relationship && values.relationship !== (dependent.relationship ?? ''))
      patch.relationship = values.relationship

    if (Object.keys(patch).length === 0) {
      show('No changes', 'info')
      navigate(-1)
      return
    }

    update.mutate(
      { id, input: patch },
      {
        onSuccess: () => {
          show('Dependent updated', 'success')
          navigate('/profile/dependents', { replace: true })
        },
        onError: (err) => setError(getApiError(err).message),
      },
    )
  }

  return (
    <div>
      <PageHeader title="Edit dependent" />
      <div className="p-4">
        {isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : !dependent ? (
          <p className="text-sm text-status-cancelled">Dependent not found.</p>
        ) : (
          <DependentForm
            initial={{
              fullName: dependent.fullName,
              dateOfBirth: dependent.dateOfBirth ?? '',
              relationship: dependent.relationship ?? '',
            }}
            submitting={update.isPending}
            error={error}
            submitLabel="Save changes"
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </div>
  )
}
