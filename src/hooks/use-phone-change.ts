import { useMutation, useQueryClient } from '@tanstack/react-query'
import { confirmPhoneChange, requestPhoneChange } from '@/lib/api/identity'
import { profileKey } from '@/hooks/use-profile'

// OTP-gated phone change (§14.6). Two steps: request sends a code to the NEW number;
// confirm swaps the phone once the code checks out. Neither is idempotency-keyed (the
// backend takes no key here — a duplicate request just re-sends, a bad confirm is a
// clean 401), so plain mutations are correct.

export function useRequestPhoneChange() {
  return useMutation({
    mutationFn: (newPhone: string) => requestPhoneChange(newPhone),
  })
}

export function useConfirmPhoneChange() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ newPhone, code }: { newPhone: string; code: string }) =>
      confirmPhoneChange(newPhone, code),
    // The profile's phone (and phoneVerifiedAt) just changed — refetch it.
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profileKey })
    },
  })
}
