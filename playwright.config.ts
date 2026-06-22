import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const here = path.dirname(fileURLToPath(import.meta.url))
const BACKEND_DIR =
  process.env.E2E_BACKEND_DIR ?? path.resolve(here, '../O1-TOCKEN MANAGEMENT SYSTEM/backend')

const APP_ORIGIN = process.env.E2E_APP_ORIGIN ?? 'http://localhost:5173'
const PREVIEW_ORIGIN = process.env.E2E_PREVIEW_ORIGIN ?? 'http://localhost:4173'
const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://localhost:3000'
const reuse = !process.env.CI

// Full end-to-end tests for the patient client, driven against the REAL backend
// (NestJS + Postgres + Redis + Socket.IO). Auth is bootstrapped via the refresh-token
// seam; see e2e/support/auth.ts + e2e/support/fixtures.ts.
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // Serial: the suite shares one dev DB + one live queue (one-serving-per-doctor),
  // so parallel workers would race each other.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    // A patient PWA — exercise it at a phone viewport.
    ...devices['Pixel 7'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      // The real-backend flows (vite dev). Authenticated tests get a fresh, single-use
      // refresh token per test via the fixture in e2e/support/fixtures.ts.
      name: 'flows',
      testIgnore: /offline\.spec\.ts/,
      use: { browserName: 'chromium', baseURL: APP_ORIGIN },
    },
    {
      // PWA offline slice: runs against `vite build && vite preview` so the Workbox
      // service worker is ACTIVE (it's disabled under vite dev). Network is stubbed,
      // then dropped, to test the SW shell + persisted cache surviving a hard reload.
      name: 'offline',
      testMatch: /offline\.spec\.ts/,
      use: { browserName: 'chromium', baseURL: PREVIEW_ORIGIN },
    },
  ],

  webServer: [
    {
      command: 'bun run start',
      cwd: BACKEND_DIR,
      url: `${BACKEND_URL}/health/live`,
      reuseExistingServer: reuse,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'bun run dev',
      url: APP_ORIGIN,
      reuseExistingServer: reuse,
      timeout: 120_000,
    },
    {
      // Built app + service worker for the offline project.
      command: 'bun run build && bun run preview --port 4173 --strictPort',
      url: PREVIEW_ORIGIN,
      reuseExistingServer: reuse,
      timeout: 180_000,
    },
  ],
})
