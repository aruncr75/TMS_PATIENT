import { expect, test } from '@playwright/test'

// PWA offline slice (Phase 8) — runs against `vite build && vite preview` (the
// "offline" project), where the Workbox service worker is ACTIVE (it's disabled under
// vite dev). Strategy: stub the API so the cache fills deterministically online, then
// REMOVE the stubs and go truly offline and hard-reload. Now only the SW (precached
// shell) + the persisted React Query cache (IndexedDB) can serve the page — exactly
// the headline Phase-8 capability. No backend needed for this slice.

// A real-ish JWT so decodeJwtSub() reads sub="test-patient" without throwing.
const FAKE_ACCESS = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXBhdGllbnQifQ.sig'
const tokenPair = { accessToken: FAKE_ACCESS, refreshToken: 'rt', tokenType: 'Bearer', expiresIn: 900 }

const doctors = [{ id: 'doc-1', displayName: 'Dr. Dev', specialization: 'General Medicine' }]
const appointment = {
  id: 'appt-1',
  patientProfileId: 'p1',
  dependentId: null,
  doctorId: 'doc-1',
  slotId: 'slot-1',
  status: 'confirmed',
  consultationType: 'free',
  paymentStatus: 'not_required',
  reasonForVisit: null,
  rescheduleCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}
const slots = [
  {
    id: 'slot-1',
    doctorId: 'doc-1',
    startAt: new Date(Date.now() + 86_400_000).toISOString(),
    endAt: new Date(Date.now() + 88_200_000).toISOString(),
    durationMinutes: 30,
    bufferMinutes: 0,
    requiredResourceId: null,
    capacity: 1,
    status: 'open',
  },
]

const json = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

test('serves the offline shell + cached appointments on a hard reload', async ({ page, context }) => {
  // Boot authenticated: seed a refresh token the app will exchange on start.
  await page.addInitScript(() => localStorage.setItem('refresh_token', 'seed-rt'))

  // ── Online phase: stub the API so the cache fills deterministically. ──
  // Scope strictly to /api/ so the SPA document navigation (/appointments) is NOT
  // intercepted (else the browser would render the raw JSON instead of the app).
  await page.route('**/api/auth/refresh', (r) => r.fulfill(json(tokenPair)))
  await page.route(/\/api\/appointments(\?.*)?$/, (r) => r.fulfill(json([appointment])))
  await page.route(/\/api\/doctors(\?.*)?$/, (r) => r.fulfill(json(doctors)))
  await page.route(/\/api\/doctors\/[^/]+\/slots(\?.*)?$/, (r) => r.fulfill(json(slots)))

  await page.goto('/appointments')
  await expect(page.getByText('Dr. Dev').first()).toBeVisible()

  // Wait for the SW to take control and the React Query cache to persist to IndexedDB.
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 20_000 })
  await page.waitForTimeout(2_000)

  // ── Offline phase: remove stubs so nothing can serve /api, then drop the network. ──
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  await context.setOffline(true)

  // Hard reload — only the SW (precached shell) + IndexedDB cache can serve this.
  await page.reload()

  // The shell rendered (not a blank/offline-dino page)…
  await expect(page.getByText(/You're offline/i)).toBeVisible()
  // …and the cached appointment survived the reload (persisted RQ cache).
  await expect(page.getByText('Dr. Dev').first()).toBeVisible()

  await context.setOffline(false)
})
