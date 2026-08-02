/**
 * Allowlisted faucet origins for Login-with-Sozu handoff `return` param.
 * Shared by client UX checks and the server mint route (authoritative).
 */
export const FAUCET_HANDOFF_RETURN_ORIGINS = [
  "https://faucet.sozu.capital",
  "http://localhost:3010",
  "http://127.0.0.1:3010",
] as const

const ALLOWED = new Set<string>(FAUCET_HANDOFF_RETURN_ORIGINS)

/**
 * Parse and validate an absolute faucet callback URL.
 * Rejects wrong origins, non-http(s), credentials, and malformed input.
 */
export function parseAllowlistedFaucetReturnUrl(
  raw: string | null | undefined,
): URL | null {
  if (!raw?.trim()) return null

  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null
  if (url.username || url.password) return null
  if (!ALLOWED.has(url.origin)) return null

  return url
}

/** Attach short-lived Mode A JWT as `token` query param (preserves other params). */
export function buildFaucetReturnWithToken(returnUrl: URL, token: string): string {
  const out = new URL(returnUrl.toString())
  out.searchParams.set("token", token)
  return out.toString()
}

/**
 * Safe relative post-auth path back into Wallet handoff.
 * Only `/auth/faucet-handoff?return=…` is accepted (open-redirect safe).
 */
export function parseFaucetHandoffAuthReturn(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null
  const trimmed = raw.trim()
  if (!trimmed.startsWith("/auth/faucet-handoff?")) return null

  let url: URL
  try {
    url = new URL(trimmed, "http://sozu.invalid")
  } catch {
    return null
  }

  if (url.pathname !== "/auth/faucet-handoff") return null
  const faucetReturn = url.searchParams.get("return")
  if (!parseAllowlistedFaucetReturnUrl(faucetReturn)) return null

  return `${url.pathname}${url.search}`
}
