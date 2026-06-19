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
}

// Responsive grid of bookable times. Used both for a day's availability and for
// the inline alternatives offered when a confirm loses the last-slot race.
export function SlotGrid({
  slots,
  onSelect,
  selectedSlotId,
  pending = false,
  emptyLabel = 'No slots available for this day.',
}: SlotGridProps) {
  if (slots.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">{emptyLabel}</p>
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {slots.map((slot) => {
        const selected = slot.slotId === selectedSlotId
        return (
          <button
            key={slot.slotId}
            type="button"
            onClick={() => onSelect(slot)}
            disabled={pending}
            aria-pressed={selected}
            className={`rounded-xl border px-2 py-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 ${
              selected
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-gray-300 bg-white text-gray-900 hover:border-brand-500 hover:bg-brand-50'
            }`}
          >
            {formatTime(slot.startAt)}
          </button>
        )
      })}
    </div>
  )
}
