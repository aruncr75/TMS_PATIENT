/* Firebase Cloud Messaging background service worker (Phase 7).
 *
 * The backend sends DATA-ONLY messages (no `notification` block, for PHI
 * minimality). Firebase only auto-displays a system notification when a
 * `notification` block is present, so for data-only payloads WE must call
 * showNotification() ourselves from onBackgroundMessage — otherwise background
 * pushes are silent.
 *
 * `public/` is not processed by Vite, so the Firebase config is read from this
 * worker's own query string (set by lib/fcm.ts when it registers the worker).
 * Pinned to firebase 11.9.1 to match the installed SDK. The copy map below mirrors
 * lib/notifications/message-map.ts (it cannot import that TS module).
 */
/* global firebase, importScripts, clients */
importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-messaging-compat.js')

const params = new URLSearchParams(self.location.search)

firebase.initializeApp({
  apiKey: params.get('apiKey'),
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
})

const messaging = firebase.messaging()

function describe(data) {
  const doctor = data.doctorName || 'your doctor'
  const token = data.tokenNumber
  switch (data.type) {
    case 'appointment.confirmed':
      return { title: 'Appointment confirmed', body: 'Your appointment with ' + doctor + ' is confirmed.', route: '/appointments' }
    case 'appointment.reminder':
      return { title: 'Appointment reminder', body: 'Reminder: your upcoming visit with ' + doctor + '.', route: '/appointments' }
    case 'appointment.cancelled':
      return { title: 'Appointment cancelled', body: 'Your appointment with ' + doctor + ' was cancelled.', route: '/appointments' }
    case 'appointment.rescheduled':
      return { title: 'Appointment rescheduled', body: 'Your appointment with ' + doctor + ' was rescheduled.', route: '/appointments' }
    case 'appointment.checked_in':
      return { title: 'Checked in', body: token ? "You're checked in — your token is " + token + '.' : "You're checked in.", route: '/queue' }
    case 'consultation.now_serving':
      return { title: "You're being called", body: token ? 'Token ' + token + ' — please proceed to ' + doctor + ' now.' : 'Please proceed to ' + doctor + ' now.', route: '/queue' }
    case 'doctor.running_late':
      return { title: 'Doctor running late', body: data.delayMinutes ? doctor + ' is running about ' + data.delayMinutes + ' min late.' : doctor + ' is running late.', route: '/queue' }
    case 'doctor.unavailable':
      return { title: 'Appointment affected', body: data.date ? doctor + ' is unavailable on ' + data.date + '.' : doctor + ' is unavailable.', route: '/appointments' }
    case 'waitlist.offer':
      return { title: 'A slot just opened up', body: 'A slot with ' + doctor + ' is available — accept before it lapses.', route: '/waitlist' }
    default:
      return { title: 'Clinic update', body: 'You have a new notification.', route: '/' }
  }
}

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {}
  const copy = describe(data)
  return self.registration.showNotification(copy.title, {
    body: copy.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.type || 'clinic',
    data: { route: copy.route },
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const route = (event.notification.data && event.notification.data.route) || '/'
  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if ('focus' in client) {
          try {
            await client.navigate(route)
          } catch (_e) {
            // cross-document navigation can reject; fall back to focus only
          }
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(route)
      return undefined
    })(),
  )
})
