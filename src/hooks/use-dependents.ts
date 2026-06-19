import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createDependent,
  listDependents,
  updateDependent,
  type CreateDependentInput,
  type UpdateDependentInput,
} from '@/lib/api/identity'

export const dependentsKey = ['dependents'] as const

export function useDependents() {
  return useQuery({
    queryKey: dependentsKey,
    queryFn: listDependents,
  })
}

export function useCreateDependent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateDependentInput) => createDependent(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: dependentsKey })
    },
  })
}

export function useUpdateDependent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateDependentInput }) =>
      updateDependent(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: dependentsKey })
    },
  })
}
