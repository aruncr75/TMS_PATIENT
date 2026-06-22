import { type APIRequestContext } from '@playwright/test'
import { expect, test } from './support/fixtures'
import { bookFirstOpenSlot, clinicDate, patientContext, seededDoctorId, staffContext } from './support/api'
import {
  callNext,
  checkInSessionFrom,
  clearQueueDb,
  completeEntry,
  reportRunningLate,
  shiftSlotToNow,
  walkIn,
} from './support/queue'

// Check-in seam + the live Socket.IO queue tracker. The check-in WINDOW is enforced
// for self AND manual, and no seeded slot is in-window right now — so we cover the
// check-in UI's closed-window path, and drive the live board via WALK-INS (no window).

let staffCtx: APIRequestContext
let patientCtx: APIRequestContext
let doctorId: string

test.beforeAll(async () => {
  staffCtx = await staffContext() // admin: walk-in + call-next + complete
  patientCtx = await patientContext()
  doctorId = await seededDoctorId(staffCtx)
})

test.afterAll(async () => {
  await staffCtx?.dispose()
  await patientCtx?.dispose()
})

test('check-in CTA surfaces the closed-window message', async ({ page }) => {
  const appt = await bookFirstOpenSlot(patientCtx, doctorId)

  await page.goto(`/appointments/${appt.appointmentId}/checkin`)
  const checkInBtn = page.getByRole('button', { name: 'Check in now' })
  await expect(checkInBtn).toBeVisible()
  await checkInBtn.click()

  // Booked slot is days out → backend rejects with CHECKIN_TOO_EARLY.
  await expect(page.getByText(/not open yet/i)).toBeVisible()
})

test('live queue tracker shows the token and updates when the doctor calls it', async ({ page }) => {
  const serviceDate = clinicDate(0)
  await clearQueueDb(doctorId, serviceDate) // make our token the sole live entry

  const view = await walkIn(staffCtx, doctorId)

  // The /queue tracker reads the check-in session from sessionStorage.
  await page.addInitScript((session) => {
    sessionStorage.setItem('checkin:session', JSON.stringify(session))
  }, checkInSessionFrom(view))

  await page.goto('/queue')

  // REST seed + socket frame → our token is shown.
  await expect(page.getByText('Your token', { exact: true })).toBeVisible()
  await expect(page.getByText(String(view.tokenNumber)).first()).toBeVisible()

  // Doctor calls the next token → live push (no reload) flips us to "your turn".
  await callNext(staffCtx, doctorId)
  await expect(page.getByText(/it's your turn/i)).toBeVisible({ timeout: 20_000 })

  // Completing the consultation removes us from the board.
  await completeEntry(staffCtx, view.queueEntryId)
  await expect(page.getByText(/you've been seen/i)).toBeVisible({ timeout: 20_000 })
})

test('self check-in issues a token and shows it on the live queue', async ({ page }) => {
  const appt = await bookFirstOpenSlot(patientCtx, doctorId)
  // Seeded slots are never naturally in-window; shift this one to NOW so check-in opens.
  await shiftSlotToNow(appt.slotId)

  await page.goto(`/appointments/${appt.appointmentId}/checkin`)
  await page.getByRole('button', { name: 'Check in now' }).click()

  // 200 → token issued, session persisted → redirected to the live tracker showing it
  // (not the "No active check-in" fallback).
  await expect(page).toHaveURL(/\/queue$/)
  await expect(page.getByText('Your token', { exact: true })).toBeVisible({ timeout: 20_000 })
})

test("running-late delay updates the patient's estimated wait live", async ({ page }) => {
  const serviceDate = clinicDate(0)
  await clearQueueDb(doctorId, serviceDate) // sole live entry → deterministic ETA
  await reportRunningLate(staffCtx, doctorId, 0) // clear any prior delay → ETA starts at 0

  const view = await walkIn(staffCtx, doctorId)
  await page.addInitScript((session) => {
    sessionStorage.setItem('checkin:session', JSON.stringify(session))
  }, checkInSessionFrom(view))

  await page.goto('/queue')
  await expect(page.getByText('Your token', { exact: true })).toBeVisible()

  // Doctor declares a 30-min delay → read-time ETA recompute pushed over the socket.
  // Sole waiting entry, none serving → eta = round(delayMinutes) = 30.
  await reportRunningLate(staffCtx, doctorId, 30)
  await expect(page.getByText('30 min')).toBeVisible({ timeout: 20_000 })

  await reportRunningLate(staffCtx, doctorId, 0) // cleanup: clear the delay
})
