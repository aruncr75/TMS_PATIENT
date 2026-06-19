# Patient App — Build Roadmap

**Stack:** React 19 + Vite 6 + TypeScript (strict) + Tailwind CSS v4 + React Router v7 + TanStack Query v5 + Socket.IO client + Firebase web SDK (FCM) + Vite PWA (Workbox)

**Backend:** NestJS + Bun, runs on `http://localhost:3000`. Vite dev proxy forwards `/api/*` → `localhost:3000/*`.

---

## Cross-cutting rules (apply to every phase)

| Concern | Rule |
|---|---|
| **Idempotency keys** | Generate with `lib/idempotency.ts → getOrCreateKey(op)` before any mutating request that takes an `idempotency-key` header. Key survives a 401 → refresh → retry because it lives in `sessionStorage`. Clear only on confirmed success or non-retriable 4xx. **Required:** confirm booking, cancel, reschedule. **Optional (send anyway):** check-in, waitlist accept. |
| **401 auto-refresh** | Handled centrally in `lib/api/client.ts`. Concurrent 401s queue behind a single refresh. Retry carries the same idempotency key. |
| **429 back-off** | Use `lib/utils/retry.ts → withRetry()`. Availability search is debounced 400 ms in `use-availability.ts`. |
| **UTC / clinic TZ** | All server dates are UTC ISO strings. Display with `lib/utils/date.ts`. Never use `new Date()` bare for display. |
| **PHI** | Patient sees only their own data. Token numbers only on the queue display. Never cache PHI in `localStorage`. |

---

## Phase 1 — Foundation + Auth Shell

**Goal:** Working phone-OTP login with JWT storage, auth guard, and route skeleton.

**Endpoints used:**
- `POST /auth/patient/otp/request` → `{ status: 'sent' }`
- `POST /auth/patient/otp/verify` → `{ accessToken, refreshToken }`
- `POST /auth/refresh` → `{ accessToken, refreshToken }` (triggered by interceptor)
- `POST /auth/logout` → 204

**Deliverables:**

| File | Purpose |
|---|---|
| `lib/api/auth.ts` | `requestOtp`, `verifyOtp`, `refresh`, `logout` calls |
| `lib/auth/token-store.ts` | Access token in memory; refresh token in `localStorage` |
| `lib/auth/auth-context.tsx` | `AuthContext`: `isAuthenticated`, `patientId`, `login()`, `logout()` |
| `lib/auth/auth-guard.tsx` | Route wrapper: redirects to `/login` when unauthenticated |
| `pages/auth/login.tsx` | Phone number input → `POST /auth/patient/otp/request` |
| `pages/auth/verify-otp.tsx` | 6-box OTP entry (auto-advance + paste) → `POST /auth/patient/otp/verify` |
| `components/otp-input.tsx` | Controlled 6-digit input component |
| `components/ui/` | `Button`, `Input`, `Spinner`, `Toast` primitives |

**Backend notes:**
- `POST /auth/patient/otp/verify` body is `{ phone, code }` — **both required**. The verify page must carry the phone number forward from the login step (route state or a store).
- Token response is `{ accessToken, refreshToken, tokenType, expiresIn }` — `expiresIn` is available for proactive refresh if desired.

**Acceptance criteria:**
- Patient enters phone → OTP delivered → 6-digit entry → lands on home
- Browser refresh restores session (refresh token re-establishes access token without re-login)
- Logout clears all tokens and redirects to `/login`
- Invalid OTP shows an error without crashing
- All routes except `/login` and `/verify` redirect to `/login` when unauthenticated

---

## Phase 2 — Profile + Dependents

**Goal:** Patient can view/edit their profile and manage dependents for use in booking.

**Endpoints used:**
- `GET /me/profile`, `PATCH /me/profile`
- `GET /me/dependents`, `POST /me/dependents`, `PATCH /me/dependents/:id`

**Deliverables:**

| File | Purpose |
|---|---|
| `lib/api/identity.ts` | All `/me/profile` and `/me/dependents` API calls |
| `hooks/use-profile.ts` | `useQuery` with stale-while-revalidate |
| `hooks/use-dependents.ts` | List query + `useMutation` for create/update |
| `pages/profile/view.tsx` | Displays phone, name, verified status |
| `pages/profile/edit.tsx` | `PATCH /me/profile` with optimistic update |
| `pages/profile/dependents.tsx` | List with relationship + DOB |
| `pages/profile/add-dependent.tsx` | `POST /me/dependents` form |
| `components/dependent-picker.tsx` | Sheet/dropdown for self + dependents — reused in Phase 3 |

**Acceptance criteria:**
- View and edit full name
- Add dependent; appears in list and in the dependent picker
- Edit dependent's relationship / DOB persists
- Loading skeletons on first fetch; stale data shown while revalidating

---

## Phase 3 — Booking Flow

**Goal:** Full two-phase (hold → confirm) booking with idempotency and last-slot race handling.

**Endpoints used:**
- `GET /doctors/:doctorId/availability?date=YYYY-MM-DD` (or `?from=&to=`) → `SlotOption[]` = `{ slotId, doctorId, startAt, endAt }`
- `POST /appointments/holds` `{ slotId }` → `HoldResult` = `{ holdId, slotId, expiresAt }` (no alternatives here)
- `POST /appointments` `{ slotId, holdId, dependentId?, consultationType?: 'free'|'paid', reasonForVisit? }` with **required** `idempotency-key` header → `BookingConfirmationView`

**Deliverables:**

| File | Purpose |
|---|---|
| `lib/api/booking.ts` | Availability, hold, confirm, list, get-one |
| `hooks/use-availability.ts` | Debounced 400 ms query; handles 429 |
| `hooks/use-booking.ts` | Orchestrates hold → confirm; exposes `holdResult`, `holdExpiresAt`, `confirm()` |
| `pages/booking/doctor-select.tsx` | Doctor list (Phase 3: uses seeded doctor data) |
| `pages/booking/slot-picker.tsx` | Date + time slot grid (`components/slot-grid.tsx`) |
| `pages/booking/booking-confirm.tsx` | Hold countdown + dependent picker + submit |
| `pages/booking/booking-success.tsx` | Confirmation with appointment ID |
| `components/slot-grid.tsx` | Time slot selection grid |
| `components/hold-countdown.tsx` | TTL countdown bar during confirmation |

**Last-slot race (important):** the race is decided at **confirm**, not at hold. The loser of a concurrent confirm receives a `SLOT_UNAVAILABLE` error whose `details.alternatives: SlotOption[]` carries the offered alternatives. The UI catches the error, reads `details.alternatives` (typed as `ApiError`), and re-renders the slot grid without losing form state. A successful hold never carries alternatives.

**Token note:** `BookingConfirmationView` returns **no token number** — token issuance happens at check-in (Phase 5).

**Acceptance criteria:**
- Select doctor + date → available slots displayed
- Tapping a slot issues a hold; countdown starts
- Confirm with idempotency key — retry returns same booking (no double-book)
- Last-slot race: confirm error `SLOT_UNAVAILABLE` → UI shows `details.alternatives` without losing form state
- Hold expiry returns user to slot picker with a message

---

## Phase 4 — My Appointments (View, Cancel, Reschedule)

**Goal:** Patient can view all appointments, cancel with fee awareness, and reschedule within policy limits.

**Endpoints used:**
- `GET /appointments`, `GET /appointments/:id` → `AppointmentView` (no time field — see below)
- `GET /doctors/:doctorId/slots` → `SlotView[]` (to resolve appointment display times)
- `POST /appointments/:id/cancel` with **required** `idempotency-key` → `CancellationView`
- `POST /appointments/holds` `{ slotId }` then `POST /appointments/:id/reschedule` `{ newSlotId, holdId }` with **required** `idempotency-key` → `RescheduleView`

**Deliverables:**

| File | Purpose |
|---|---|
| `lib/api/lifecycle.ts` | `cancel`, `reschedule` API calls |
| `hooks/use-appointments.ts`, `use-appointment.ts` | List + single queries |
| `hooks/use-slots.ts` | Fetch doctor's `SlotView[]`; join `startAt`/`endAt` by `slotId` for display |
| `hooks/use-cancel.ts`, `use-reschedule.ts` | Mutations with idempotency + cache invalidation |
| `pages/appointments/list.tsx` | Grouped by upcoming / past (uses resolved slot times) |
| `pages/appointments/detail.tsx` | Full view + available FSM actions |
| `pages/appointments/cancel.tsx` | Shows `feePercent` / `feeWaived` from `CancellationView` |
| `pages/appointments/reschedule.tsx` | Hold-first: slot-picker → hold → reschedule; shows remaining reschedule count |
| `components/appointment-card.tsx` | Shared summary card |
| `components/status-badge.tsx` | FSM state → coloured label |

**Backend notes:**
- `AppointmentView` carries **no time field** — only `slotId`. Resolve display times by matching `slotId` against `GET /doctors/:doctorId/slots` (`SlotView.id` / `startAt` / `endAt`). No backend change required for v1.
- **Reschedule is hold-first**, exactly like booking: hold the target slot, then call reschedule with `{ newSlotId, holdId }`. It can also lose a last-slot race → `SLOT_UNAVAILABLE` + `details.alternatives` (same handling as Phase 3).

**Acceptance criteria:**
- All appointments shown with status badges and resolved date/times
- Cancel shows fee warning when `feePercent > 0 && !feeWaived`
- Double-cancel is a no-op (backend 200, UI shows "already cancelled")
- Reschedule count limit (`rescheduleCount`) displayed and enforced in UI
- Reschedule success updates list; old appointment shows `rescheduled`

---

## Phase 5 — Self Check-In + Live Queue Tracking

**Goal:** Patient checks in and tracks their live token position via Socket.IO.

**Endpoints used:**
- `POST /appointments/:id/check-in` → `CheckInView` (`idempotency-key` **optional** — still send it for safe retries)
- `GET /doctors/:doctorId/queue` → `QueueSnapshot` (REST fallback on reconnect)
- WebSocket `/queue` namespace, event `queue:update` → `QueueSnapshot` (payload is the snapshot itself); error event `queue:error` → `{ code: 'DOCTOR_ID_REQUIRED' }`

**Deliverables:**

| File | Purpose |
|---|---|
| `lib/api/checkin.ts` | `selfCheckIn` API call |
| `lib/socket/queue-socket.ts` | Socket.IO client; `seq` guard; reconnect → REST snapshot before live resumes |
| `lib/socket/socket-provider.tsx` | React context for socket lifecycle |
| `hooks/use-checkin.ts` | Mutation + stores `tokenNumber` / `doctorId` in `sessionStorage` |
| `hooks/use-queue.ts` | Subscribes to socket provider; REST fallback on reconnect |
| `hooks/use-my-token.ts` | Matches the patient's `tokenNumber` in `entries[]`; returns that entry's `{ position, etaMinutes, status }` |
| `pages/queue/checkin.tsx` | One-tap check-in from appointment detail |
| `pages/queue/track.tsx` | Large now-serving number, patient position + ETA, "you're next" alert at position 1 |
| `components/token-display.tsx` | Reusable large token number block |

**Key design notes:**
- Patient position is derived client-side from the public `QueueSnapshot.entries[]` — no per-patient position event. **ETA is per-entry** (`entry.etaMinutes`), not a snapshot-level multiplier.
- `seq` guard: never apply an update with `seq` lower than the last applied. On reconnect the gateway sends a replay immediately. Handle `queue:error` (`DOCTOR_ID_REQUIRED`) — the server disconnects right after.
- **Dev-proxy note:** the Vite `/api` proxy does NOT cover the socket. Socket.IO connects to the backend origin directly (default path `/socket.io`, namespace `/queue`) using `VITE_WS_URL` (e.g. `http://localhost:3000`), connecting with `?doctorId=…`.
- Queue tracking works as long as the tab is open; no background push required.

**Acceptance criteria:**
- Check-in returns a token number; redirects to queue tracker
- Live position updates within 2 s of a queue change
- "You're next" visual + vibration alert when `position === 1`
- Network drop + reconnect shows correct state (no false advance)
- Idempotent check-in (same key → same `CheckInView`)

---

## Phase 6 — Waitlist Management

**Goal:** Patient can join, monitor, and accept waitlist slot offers.

**Endpoints used:**
- `POST /doctors/:doctorId/waitlist` `{ date: 'YYYY-MM-DD', dependentId?, consultationType? }` → `WaitlistEntryView` (**`date` required**)
- `GET /waitlist` → `WaitlistEntryView[]`
- `DELETE /waitlist/:id` → `WaitlistEntryView` (status: `removed`)
- `POST /waitlist/:id/accept` → `BookingConfirmationView` (`idempotency-key` **optional** — send it)

**Deliverables:**

| File | Purpose |
|---|---|
| `lib/api/waitlist.ts` | All waitlist calls |
| `hooks/use-waitlist.ts` | List query (polls every 30 s); join/leave/accept mutations |
| `pages/waitlist/list.tsx` | Shows entries; offer banner + countdown when `offeredSlotId != null` |
| `pages/waitlist/accept.tsx` | Accept offered slot with idempotency key |
| `components/waitlist-offer-banner.tsx` | Persistent top banner with countdown |

**Slot picker updated:** when availability returns no slots, shows "Join Waitlist for this day."
**Appointment detail updated:** "Join Waitlist" button when relevant.

**Acceptance criteria:**
- Join waitlist when full; entry appears in list
- Offer banner appears when `offeredSlotId != null` (30 s polling; Phase 7 replaces with FCM)
- Accept is idempotent
- Accepting an expired offer shows "offer lapsed" and clears offer state
- Leaving removes the entry

---

## Phase 7 — Push Notifications (FCM)

**Goal:** FCM web push registration, in-app foreground message handling, iOS A2HS guidance.

**Endpoints used:**
- `POST /me/devices` `{ token, platform?: 'android'|'ios'|'web' }` → `{ id: string }`
- `DELETE /me/devices/:token` → 204
- `PATCH /me/notification-preferences` `{ optIn: boolean }` → `{ optIn: boolean }`

**Deliverables:**

| File | Purpose |
|---|---|
| `lib/fcm.ts` | Firebase web SDK init; `requestPermission()`, `getWebPushToken()`, `onForegroundMessage()`; iOS 16.4+ capability check |
| `hooks/use-notifications.ts` | Permission request → token registration → foreground handler |
| `pages/notifications/settings.tsx` | Opt-in toggle, install PWA prompt, permission state display |
| `components/install-prompt.tsx` | Android `beforeinstallprompt` / iOS manual A2HS instructions |

**Foreground notification types handled:** `booking.confirmed`, `booking.reminder`, `queue.eta_update`, `queue.called`, `waitlist.offer`

**Waitlist offer banner:** now also triggered by `waitlist.offer` foreground FCM message — polling from Phase 6 can be removed.

**iOS note:** Background push requires the PWA installed to Home Screen (iOS 16.4+). The opt-in toggle is disabled until the install prompt is accepted. Phase 5's socket-driven "you're next" alert remains the primary delivery path on iOS.

**Acceptance criteria:**
- Grant permission → FCM token registered via `POST /me/devices`
- Booking confirmation push shown as in-app toast
- Opt-out respected by backend (`optIn: false`)
- FCM token unregistered on logout
- On iOS, install instructions shown before push registration is attempted

---

## Phase 8 — PWA Hardening + Offline Shell

**Goal:** Installable, offline-capable app; Lighthouse PWA score ≥ 90.

**Deliverables:**

| Item | Detail |
|---|---|
| Workbox config (`vite.config.ts`) | Precache app shell; runtime cache for API: NetworkFirst + stale-with-staleness-indicator |
| Offline banner | Shows when `navigator.onLine === false` — no blank screen |
| Offline appointments | React Query cache serves last-known list with staleness timestamp |
| Offline queue tracker | "Reconnecting…" state + last-known snapshot with "as of N min ago" label |
| PWA manifest | `display: standalone`, all icon sizes, `theme_color`, `start_url` |
| Install prompt persistence | `beforeinstallprompt` dismissed state stored; does not re-appear for 7 days |
| Playwright e2e | `e2e/auth.spec.ts`, `e2e/booking.spec.ts`, `e2e/queue.spec.ts` |

**Acceptance criteria:**
- App shell renders when offline (no blank screen, no JS crash)
- Cached appointment list shown with staleness label when offline
- Session restored after installing and reopening the app without re-login
- Lighthouse PWA audit: installable ✓, service worker ✓, manifest ✓

---

## Timeline

| Phase | Estimated effort |
|---|---|
| 1 — Auth | 1 week |
| 2 — Profile + Dependents | 3–4 days |
| 3 — Booking | 1.5 weeks |
| 4 — Appointments | 1 week |
| 5 — Check-In + Queue | 1.5 weeks |
| 6 — Waitlist | 1 week |
| 7 — FCM Notifications | 1 week |
| 8 — PWA Hardening | 1 week |
| **Total** | **~8–10 weeks** |

---

## Development quick-start

```bash
# from repo root
cd client
bun install
bun run dev          # http://localhost:5173  (proxies /api/* → localhost:3000)
bun run typecheck    # TypeScript strict check
bun run build        # production bundle → dist/
```

Backend must be running on `localhost:3000` for API calls to work.
