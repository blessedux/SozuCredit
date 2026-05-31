/** Stellar contract id (C + 55 base32 chars). */
const CONTRACT_ID_RE = /^C[A-Z2-7]{55}$/

const DEFAULT_TESTNET_BLEND_USDC =
  "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU"

/**
 * Normalize env contract ids — fixes missing leading `C` (common Vercel typo).
 */
export function normalizeStellarContractId(
  raw: string | undefined | null,
  fallback: string,
  envName: string,
): string {
  const trimmed = raw?.trim().toUpperCase() ?? ""
  if (CONTRACT_ID_RE.test(trimmed)) return trimmed

  if (/^[A-Z2-7]{55}$/.test(trimmed)) {
    const fixed = `C${trimmed}`
    console.warn(
      `[contract-id] ${envName} missing leading C — using ${fixed.slice(0, 8)}…`,
    )
    return fixed
  }

  if (trimmed.length > 0) {
    console.error(
      `[contract-id] Invalid ${envName}="${trimmed.slice(0, 12)}…" — using default Blend testnet id`,
    )
  }

  return fallback
}

export function getDefaultTestnetBlendUsdcId(): string {
  return DEFAULT_TESTNET_BLEND_USDC
}

export function isValidContractId(value: string): boolean {
  return CONTRACT_ID_RE.test(value.trim().toUpperCase())
}
