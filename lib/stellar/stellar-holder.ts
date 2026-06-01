import { Address } from "@stellar/stellar-sdk"

const CLASSIC_G = /^G[A-Z0-9]{55}$/
const CONTRACT_C = /^C[A-Z0-9]{55}$/

/** Classic G or Soroban C — validated via SDK Address parser. */
export function isStellarHolderAddress(value: string): boolean {
  const t = value.trim().toUpperCase()
  if (!CLASSIC_G.test(t) && !CONTRACT_C.test(t)) return false
  try {
    Address.fromString(t)
    return true
  } catch {
    return false
  }
}

export function normalizeHolderAddress(raw: string): string {
  const normalized = raw.trim().toUpperCase()
  Address.fromString(normalized)
  return normalized
}

export function holderAddressKind(
  address: string,
): "classic" | "contract" | "invalid" {
  const t = address.trim().toUpperCase()
  if (!isStellarHolderAddress(t)) return "invalid"
  return t.startsWith("C") ? "contract" : "classic"
}
