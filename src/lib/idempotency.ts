// Idempotency key store.
// Keys must survive a 401 → access-token-refresh → retry cycle, so they
// live in sessionStorage rather than module memory.

const PREFIX = 'idem:'

export function generateKey(): string {
  return crypto.randomUUID()
}

export function getOrCreateKey(operation: string): string {
  const stored = sessionStorage.getItem(PREFIX + operation)
  if (stored) return stored
  const key = generateKey()
  sessionStorage.setItem(PREFIX + operation, key)
  return key
}

export function clearKey(operation: string): void {
  sessionStorage.removeItem(PREFIX + operation)
}
