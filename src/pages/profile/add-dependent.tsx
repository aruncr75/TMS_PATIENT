import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateDependent } from '@/hooks/use-dependents'
import { getApiError } from '@/lib/api/error'
import { useToast } from '@/components/ui/toast'
import { PageHeader } from '@/components/layout/page-header'
import { DependentForm, type DependentFormValues } from '@/components/dependent-form'
import type { CreateDependentInput } from '@/lib/api/identity'

export default function AddDependentPage() {
  const create = useCreateDependent()
  const { show } = useToast()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (values: DependentFormValues) => {
    // Send optional fields only when provided (backend rejects empty strings).
    const input: CreateDependentInput = { fullName: values.fullName }
    if (values.dateOfBirth) input.dateOfBirth = values.dateOfBirth
    if (values.relationship) input.relationship = values.relationship

    create.mutate(input, {
      onSuccess: () => {
        show('Dependent added', 'success')
        navigate('/profile/dependents', { replace: true })
      },
      onError: (err) => setError(getApiError(err).message),
    })
  }

  return (
    <div>
      <PageHeader title="Add dependent" />
      <div className="p-4">
        <DependentForm
          submitting={create.isPending}
          error={error}
          submitLabel="Add dependent"
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  )
}
