import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getProfile,
  updateProfile,
  type UpdateProfileInput,
} from '@/lib/api/identity'
import type { ProfileView } from '@/types/api'

export const profileKey = ['profile'] as const

export function useProfile() {
  return useQuery({
    queryKey: profileKey,
    queryFn: getProfile,
  })
}

// Optimistic name update: reflect the new name instantly, roll back on error,
// then reconcile with the server response on settle.
export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => updateProfile(input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: profileKey })
      const previous = qc.getQueryData<ProfileView>(profileKey)
      if (previous) {
        qc.setQueryData<ProfileView>(profileKey, { ...previous, fullName: input.fullName })
      }
      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) qc.setQueryData(profileKey, context.previous)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: profileKey })
    },
  })
}
