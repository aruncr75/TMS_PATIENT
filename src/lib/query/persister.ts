import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'

// The React Query cache is persisted to IndexedDB (NOT localStorage) so the patient's
// last-known appointments and queue survive an offline reload. Storing it in IndexedDB
// rather than localStorage satisfies the cross-cutting PHI rule "Never cache PHI in
// localStorage" (ROADMAP.md → "Cross-cutting rules") — appointment data is the
// patient's own PHI. The SW Cache Storage already holds the raw /api responses, so
// this keeps the client's offline posture consistent.
const IDB_KEY = 'tms-rq-cache'

export const queryPersister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => get<string>(key).then((v) => v ?? null),
    setItem: (key, value) => set(key, value),
    removeItem: (key) => del(key),
  },
  key: IDB_KEY,
})

// Drop the persisted cache (e.g. on logout) so one patient's data can't surface in a
// later session on the same device. Best-effort — never block logout on it.
export async function purgePersistedQueryCache(): Promise<void> {
  try {
    await del(IDB_KEY)
  } catch {
    // ignore
  }
}
