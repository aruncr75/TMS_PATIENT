// Exponential backoff for 429 / transient 5xx errors.
export async function withRetry<T>(
  fn: () => Promise<T>,
  { maxAttempts = 3, baseDelayMs = 500 } = {},
): Promise<T> {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status
      const isRetriable = status === 429 || (status !== undefined && status >= 500)
      attempt++
      if (!isRetriable || attempt >= maxAttempts) throw error
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** (attempt - 1)))
    }
  }
}
