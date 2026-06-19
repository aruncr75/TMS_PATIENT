import type { ApiError } from '@/types/api'

// Normalises any thrown value (axios error, network failure, etc.) into the
// backend's uniform error envelope so callers can always read `.code`/`.message`.
// Reused across every phase.
export function getApiError(error: unknown): ApiError {
  const data = (error as { response?: { data?: unknown } })?.response?.data
  if (data && typeof data === 'object' && 'message' in data) {
    const e = data as Partial<ApiError>
    return {
      code: e.code ?? 'UNKNOWN',
      message: e.message ?? 'Something went wrong. Please try again.',
      details: e.details,
    }
  }
  // No structured body → network error, timeout, or non-JSON response.
  return {
    code: 'NETWORK',
    message: 'Network error. Check your connection and try again.',
  }
}
