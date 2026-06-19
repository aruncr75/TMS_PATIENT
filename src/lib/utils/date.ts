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
