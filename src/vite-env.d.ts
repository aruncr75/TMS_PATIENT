/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Clinic timezone (IANA), e.g. 'Asia/Kolkata'. */
  readonly VITE_CLINIC_TZ?: string
  /** Per-patient reschedule limit, mirrors backend clinic-config (default 3). */
  readonly VITE_RESCHEDULE_LIMIT?: string
  /** WebSocket origin for the queue namespace (Phase 5). */
  readonly VITE_WS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
