/**
 * Persist the absolute faucet callback across the /auth bounce.
 * Nested query encoding + client soft-nav can drop `return`; sessionStorage is the backup.
 */

const KEY = "sozu_faucet_handoff_return_v1"

export function stashFaucetHandoffReturn(absoluteFaucetUrl: string): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(KEY, absoluteFaucetUrl.trim())
  } catch {
    /* private browsing */
  }
}

export function peekFaucetHandoffReturn(): string | null {
  if (typeof window === "undefined") return null
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function clearFaucetHandoffReturn(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* private browsing */
  }
}
