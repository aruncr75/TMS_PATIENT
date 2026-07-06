// Clinic-TZ-aware date helpers.
// All dates from the server are UTC ISO strings; display them in the clinic's
// timezone (available on the profile or clinic-config endpoint).

let _clinicTz = Intl.DateTimeFormat().resolvedOptions().timeZone // browser fallback

export function setClinicTimezone(tz: string) {
  _clinicTz = tz
}

export function formatDate(iso: string, options?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    timeZone: _clinicTz,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  })
}

export function formatTime(iso: string, options?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    timeZone: _clinicTz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...options,
  })
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)}, ${formatTime(iso)}`
}

export function isSameDay(isoA: string, isoB: string): boolean {
  const fmt = (s: string) =>
    new Date(s).toLocaleDateString('en-IN', { timeZone: _clinicTz })
  return fmt(isoA) === fmt(isoB)
}

export function todayInClinicTz(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: _clinicTz }) // YYYY-MM-DD
}

export function isSlotDateBeforeToday(iso?: string): boolean {
  if (!iso) return false
  try {
    const slotDay = new Date(iso).toLocaleDateString('en-CA', { timeZone: _clinicTz })
    return slotDay < todayInClinicTz()
  } catch {
    return false
  }
}


// Format a date-only `YYYY-MM-DD` value (e.g. a dependent's dateOfBirth) for display.
// Date-only values are NOT instants: do NOT route them through `formatDate`, which parses
// them as UTC midnight and shifts the calendar day backwards in any negative-offset zone.
// Constructing a local Date from the parts keeps the day exactly as stored.
export function formatDateOnly(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
