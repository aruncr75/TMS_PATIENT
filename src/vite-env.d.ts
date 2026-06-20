/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Clinic timezone (IANA), e.g. 'Asia/Kolkata'. */
  readonly VITE_CLINIC_TZ?: string
  /** Per-patient reschedule limit, mirrors backend clinic-config (default 3). */
  readonly VITE_RESCHEDULE_LIMIT?: string
  /** WebSocket origin for the queue namespace (Phase 5). */
  readonly VITE_WS_URL?: string
  /** Firebase Cloud Messaging web config (Phase 7). All five must be set for push
   *  to be available; when any is missing the client degrades to no push. */
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
  /** Web Push VAPID public key (Firebase console → Cloud Messaging). */
  readonly VITE_FIREBASE_VAPID_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
