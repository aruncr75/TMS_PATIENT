import { test as base } from '@playwright/test'
import { mintRefreshToken, storageStateFor } from './auth'

// Refresh tokens are single-use + rotated: presenting an already-rotated token revokes
// the whole family. A single shared storageState therefore authenticates exactly ONE
// test — every later test would replay a dead token and get bounced to /login. So each
// test gets its OWN freshly-minted refresh token, applied once at context creation.
// (Within a test, the app rotates and writes the new token back to localStorage itself,
// so multiple navigations are fine.)
export const test = base.extend({
  storageState: async ({}, use) => {
    const token = await mintRefreshToken()
    await use(storageStateFor(token))
  },
})

export { expect } from '@playwright/test'
