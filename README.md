# Token Management System — Patient Client

React 19 + Vite + TypeScript PWA for patients: book appointments, track the live queue, manage
waitlists. Talks to the NestJS backend over REST + Socket.IO. See [`ROADMAP.md`](./ROADMAP.md) for
the phased build plan. `@/` → `src/`.

## Stack

React 19 · Vite 6 · TypeScript · Tailwind v4 · TanStack Query (+ IndexedDB persistence) ·
React Router 7 · socket.io-client · Firebase (FCM web push) · vite-plugin-pwa (Workbox).

## Run (dev)

```
bun install
bun run dev            # http://localhost:5173 — proxies /api/* → http://localhost:3000
```

Config lives in `.env.local` (copy from `.env.example`): `VITE_API_URL`, `VITE_WS_URL`, and the
`VITE_FIREBASE_*` push keys.

```
bun run build          # tsc -b && vite build  (emits the service worker)
bun run preview        # serve the build (SW active here; it's disabled under vite dev)
bun run typecheck      # tsc -b
bun run lint
```

## End-to-end tests (Playwright)

A full E2E suite drives the **real** stack — the backend (NestJS), Postgres, Redis, and the live
Socket.IO queue. Tests live in [`e2e/`](./e2e); config is [`playwright.config.ts`](./playwright.config.ts).

### Prerequisites

- **Postgres (5432) + Redis (6379) running** (see the backend README).
- Browser binary (one-time): `npx playwright install chromium`.

You do **not** start the servers yourself — Playwright boots the backend, `vite dev`, and
`vite build && vite preview`, reusing any already running.

### Run

```
bun run test:e2e                      # whole suite (12 tests)
bun run test:e2e:ui                   # interactive UI mode
bun run test:e2e e2e/booking.spec.ts  # one file
bun run test:e2e --project=flows      # real-backend flows (vite dev)
bun run test:e2e --project=offline    # PWA/offline slice (build + preview, SW active)
bun run test:e2e --headed             # watch in a real browser
npx playwright show-report            # open the HTML report
```

A green run is **12 passed**. Failures drop a screenshot + trace under `test-results/`
(`npx playwright show-trace <trace.zip>`).

### How it works

- **Two projects.** `flows` runs the app under `vite dev` against the real backend; `offline` runs
  the built app under `vite preview` so the Workbox service worker is active, then goes offline and
  hard-reloads to prove the SW shell + persisted IndexedDB cache still serve the page.
- **Auth seam.** The login OTP is a one-way HMAC in Redis (unrecoverable), so the happy path can't be
  UI-driven. Each test mints its own single-use `refresh_tokens` row in Postgres and seeds
  `localStorage['refresh_token']`; the app's `hydrateSession()` exchanges it at `/auth/refresh`.
- **Fresh patient per run** (created in `global-setup`) keeps the appointment list clean across runs.
- **Queue** is driven via walk-ins + an admin token (the check-in window blocks self check-in
  out-of-hours); **waitlist** offers come from the real cancel → promotion pipeline. Helpers live in
  [`e2e/support/`](./e2e/support).

Coverage: auth/session · booking · cancel + reschedule · check-in & live queue · waitlist join +
accept · notification settings · PWA offline shell.

## Layout

```
src/
  pages/         route screens (auth, booking, appointments, queue, waitlist, profile, notifications)
  components/    UI + layout (app-shell, cards, banners)
  hooks/         data + UI hooks (use-booking, use-checkin, use-waitlist, use-now, …)
  lib/           api/ (axios client + endpoints), auth/, socket/, query/ (RQ persistence), fcm
  types/         backend view shapes (api.ts) + socket events
e2e/             Playwright suite (specs + support/ helpers + global-setup)
```
