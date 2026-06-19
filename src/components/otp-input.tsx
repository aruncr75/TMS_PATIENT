import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'

interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  length?: number
  disabled?: boolean
  autoFocus?: boolean
  /** Fired when all boxes are filled (e.g. to auto-submit). */
  onComplete?: (value: string) => void
}

export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  autoFocus = false,
  onComplete,
}: OtpInputProps) {
  const inputs = useRef<Array<HTMLInputElement | null>>([])

  const focusBox = (i: number) => inputs.current[Math.max(0, Math.min(length - 1, i))]?.focus()

  const emit = (next: string) => {
    onChange(next)
    if (next.length === length) onComplete?.(next)
  }

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1) // keep only the last typed digit
    if (!digit) return
    const chars = value.split('')
    chars[index] = digit
    emit(chars.join('').slice(0, length))
    if (index < length - 1) focusBox(index + 1)
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const chars = value.split('')
      if (chars[index]) {
        // Filled cell → clear it, keep focus here.
        chars[index] = ''
        emit(chars.join(''))
      } else if (index > 0) {
        // Empty cell → clear the previous one and step back.
        chars[index - 1] = ''
        emit(chars.join(''))
        focusBox(index - 1)
      }
    } else if (e.key === 'ArrowLeft') {
      focusBox(index - 1)
    } else if (e.key === 'ArrowRight') {
      focusBox(index + 1)
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!digits) return
    emit(digits)
    focusBox(digits.length >= length ? length - 1 : digits.length)
  }

  return (
    <div className="flex justify-center gap-2" role="group" aria-label={`${length}-digit code`}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputs.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          value={value[i] ?? ''}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className="h-14 w-12 rounded-xl border border-gray-300 text-center text-2xl font-semibold text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100"
        />
      ))}
    </div>
  )
}
