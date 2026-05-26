/**
 * Wallet utility functions
 * Shared utilities for wallet components
 */

/**
 * Format balance value - remove trailing zeros, only show decimals if needed
 */
export function formatBalance(value: number): string {
  if (value === 0) {
    return "0"
  }
  // Convert to string and remove trailing zeros
  const formatted = value.toString()
  // If it has a decimal point, remove trailing zeros and the decimal point if not needed
  if (formatted.includes('.')) {
    return formatted.replace(/\.?0+$/, '')
  }
  return formatted
}

/**
 * Mask balance for privacy
 */
export function maskBalance(balance: string): string {
  return balance.replace(/\d/g, "*")
}

/**
 * Format wallet address for display (truncate middle)
 */
export function formatAddress(address: string, startChars: number = 8, endChars: number = 8): string {
  if (!address || address.length <= startChars + endChars) {
    return address
  }
  return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`
}

/**
 * Get currency symbol for display
 */
export function getCurrencySymbol(): string {
  return "USDC"
}

/**
 * Get Stellar Expert URL for an account
 */
export function getStellarExpertUrl(address: string, network: "testnet" | "mainnet"): string {
  return network === "mainnet"
    ? `https://stellar.expert/explorer/mainnet/account/${address}`
    : `https://stellar.expert/explorer/testnet/account/${address}`
}

/**
 * Get Stellar Expert URL for a transaction
 */
export function getStellarExpertTxUrl(txHash: string, network: "testnet" | "mainnet"): string {
  return network === "mainnet"
    ? `https://stellar.expert/explorer/mainnet/tx/${txHash}`
    : `https://stellar.expert/explorer/testnet/tx/${txHash}`
}

/**
 * Copy text to clipboard with error handling
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    console.error("Failed to copy to clipboard:", err)
    return false
  }
}

/** UUID v4 pattern — 8-4-4-4-12 hex groups */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Get user ID from session storage.
 *
 * Guards against a known bug where the tag string (e.g. "alice3") was
 * accidentally stored in dev_username instead of the UUID. If the stored
 * value is not a UUID, returns null so callers surface an auth error
 * instead of silently sending the wrong id to API routes.
 */
export function getUserId(): string | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem("dev_username")
  if (!raw) return null
  if (!UUID_RE.test(raw)) {
    console.warn(
      "[getUserId] dev_username is not a UUID — session may be stale. Value:",
      raw.substring(0, 20)
    )
    return null // Caller will treat this as unauthenticated
  }
  return raw
}
