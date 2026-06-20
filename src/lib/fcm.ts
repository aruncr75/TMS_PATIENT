import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  deleteToken,
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type Messaging,
  type MessagePayload,
} from 'firebase/messaging'

// Firebase Cloud Messaging (web push) integration for Phase 7.
//
// Every entry point is guarded so the app runs normally when Firebase isn't
// configured (empty VITE_FIREBASE_* in dev) or the browser can't do web push (e.g.
// iOS Safari not installed to Home Screen): the helpers resolve to null / no-op and
// never throw.

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
}
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY ?? ''

// All five values are required for web push to function.
export function hasFirebaseConfig(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.messagingSenderId &&
      firebaseConfig.appId &&
      VAPID_KEY,
  )
}

let supportedCache: boolean | null = null

// Config present + browser capable. Cached because `isSupported()` is async and
// stable for the page lifetime.
export async function isPushSupported(): Promise<boolean> {
  if (!hasFirebaseConfig()) return false
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('Notification' in window)
  ) {
    return false
  }
  if (supportedCache !== null) return supportedCache
  try {
    supportedCache = await isSupported()
  } catch {
    supportedCache = false
  }
  return supportedCache
}

let messaging: Messaging | null = null

function getMessagingInstance(): Messaging | null {
  if (!hasFirebaseConfig()) return null
  if (!messaging) {
    const app: FirebaseApp = getApps()[0] ?? initializeApp(firebaseConfig)
    messaging = getMessaging(app)
  }
  return messaging
}

// Register OUR messaging service worker at the dedicated FCM scope so it doesn't
// collide with the Workbox SW (scope '/', production only). `public/` files aren't
// processed by Vite, so the Firebase config is injected via the query string and
// read back with URLSearchParams inside the SW.
async function registerFcmServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined
  const params = new URLSearchParams({
    apiKey: firebaseConfig.apiKey,
    projectId: firebaseConfig.projectId,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
  })
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params.toString()}`, {
    scope: '/firebase-cloud-messaging-push-scope',
  })
}

let currentToken: string | null = null

export function getCurrentToken(): string | null {
  return currentToken
}

// `getToken` triggers Notification.requestPermission() when permission is 'default'
// and throws if it isn't granted — so this is the prompting path. Caller is
// responsible for only invoking it from a user gesture (the opt-in toggle), or when
// permission is already 'granted' (the silent re-register path below).
async function fetchToken(): Promise<string | null> {
  const m = getMessagingInstance()
  if (!m) return null
  try {
    const swReg = await registerFcmServiceWorker()
    const token = await getToken(m, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg })
    currentToken = token || null
    return currentToken
  } catch {
    return null
  }
}

// Opt-in path: may prompt the user for notification permission.
export async function requestPermissionAndToken(): Promise<string | null> {
  if (!(await isPushSupported())) return null
  return fetchToken()
}

// Silent path used on app start to refresh a possibly-rotated token. Never prompts:
// only proceeds when permission is already granted.
export async function getExistingToken(): Promise<string | null> {
  if (!(await isPushSupported())) return null
  if (Notification.permission !== 'granted') return null
  return fetchToken()
}

export async function deleteCurrentToken(): Promise<void> {
  const m = getMessagingInstance()
  currentToken = null
  if (!m) return
  try {
    await deleteToken(m)
  } catch {
    // best-effort
  }
}

// Foreground push handler. Returns an unsubscribe; a no-op when push is unavailable.
export function onForegroundMessage(cb: (payload: MessagePayload) => void): () => void {
  const m = getMessagingInstance()
  if (!m) return () => {}
  return onMessage(m, cb)
}
