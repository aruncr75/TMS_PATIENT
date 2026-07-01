import { formatTime } from '@/lib/utils/date'
import type { SlotOption } from '@/types/api'

interface SlotGridProps {
  slots: SlotOption[]
  onSelect: (slot: SlotOption) => void
  /** Highlight the currently selected slot (e.g. the one being held). */
  selectedSlotId?: string
  /** Disable interaction while a hold is in flight. */
  pending?: boolean
  /** Message shown when there are no slots. */
  emptyLabel?: string
  /** Slots currently held by others (visually locked) */
  heldSlotIds?: Set<string>
}

// Responsive grid of bookable times. Used both for a day's availability and for
// the inline alternatives offered when a confirm loses the last-slot race.
export function SlotGrid({
  slots,
  onSelect,
  selectedSlotId,
  pending = false,
  emptyLabel = 'No slots available for this day.',
  heldSlotIds,
}: SlotGridProps) {
  if (slots.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">{emptyLabel}</p>
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {slots.map((slot) => {
        const selected = slot.slotId === selectedSlotId
        const held = heldSlotIds?.has(slot.slotId) ?? false
        return (
          <button
            key={slot.slotId}
            type="button"
            onClick={() => onSelect(slot)}
            disabled={pending || held}
            aria-pressed={selected}
            className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-sm font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 disabled:cursor-not-allowed ${
              selected
                ? 'border-brand-600 bg-brand-600 text-white disabled:opacity-60'
                : held
                  ? 'border-amber-400 bg-amber-50 text-amber-700'
                  : 'border-gray-300 bg-white text-gray-900 hover:border-brand-500 hover:bg-brand-50 disabled:opacity-60'
            }`}
          >
            {held && (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 flex-shrink-0">
                <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
              </svg>
            )}
            {formatTime(slot.startAt)}
          </button>
        )
      })}
    </div>
  )
}
