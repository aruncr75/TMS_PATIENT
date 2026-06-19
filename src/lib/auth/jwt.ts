// Minimal, dependency-free JWT payload reader. The patient app only needs the
// `sub` claim (the patientId) for display/scoping — it never verifies the
// signature (the server does that). Decode-only: do not trust this for auth.

export function decodeJwtSub(token: string): string | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    // base64url → base64, then decode UTF-8 safely.
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    )
    const claims = JSON.parse(json) as { sub?: unknown }
    return typeof claims.sub === 'string' ? claims.sub : null
  } catch {
    return null
  }
}
