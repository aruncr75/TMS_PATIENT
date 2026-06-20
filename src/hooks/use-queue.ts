import { useQueueSocket } from '@/lib/socket/socket-provider'

// Subscribe to the live queue exposed by the nearest QueueSocketProvider. Thin
// pass-through so pages depend on a hook (and a REST fallback / reconnect handled
// inside the provider) rather than the socket directly.
export function useQueue() {
  return useQueueSocket()
}
