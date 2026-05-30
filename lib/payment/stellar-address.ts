/** Classic account (G…) or Soroban contract (C…) — 56-char StrKey. */
const CLASSIC_G = /^G[A-Z0-9]{55}$/
const CONTRACT_C = /^C[A-Z0-9]{55}$/

export function isClassicStellarAddress(value: string): boolean {
  return CLASSIC_G.test(value.trim())
}

export function isContractStellarAddress(value: string): boolean {
  return CONTRACT_C.test(value.trim())
}

export function isValidStellarReceiveAddress(value: string): boolean {
  const t = value.trim()
  return isClassicStellarAddress(t) || isContractStellarAddress(t)
}

export function normalizeStellarAddressInput(raw: string): string {
  return raw.trim().toUpperCase()
}
