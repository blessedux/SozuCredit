"use client"

export type UnifiedUsdcBalance = {
  /** Spendable on the canonical C wallet (BlendUSDC on testnet). */
  walletBalance: number
  strategyBalance: number
  /** wallet + strategy (for portfolio view only). */
  totalBalance: number
  spendableAssetLabel: string
  walletAddress: string
}

/**
 * Single source of truth for USDC balances — matches what the payment API enforces.
 */
export async function fetchUnifiedUsdcBalance(
  userId: string,
  publicKey?: string
): Promise<UnifiedUsdcBalance | null> {
  const qs =
    publicKey && /^[GC][A-Z0-9]{55}$/.test(publicKey)
      ? `?publicKey=${encodeURIComponent(publicKey)}`
      : ""

  const res = await fetch(`/api/wallet/stellar/balance${qs}`, {
    headers: { "x-user-id": userId },
  })
  if (!res.ok) return null

  const data = (await res.json()) as {
    usdcBalance?: number
    defindexBalance?: number
    spendableAssetLabel?: string
    publicKey?: string
  }

  const walletBalance = typeof data.usdcBalance === "number" ? data.usdcBalance : 0
  const strategyBalance = typeof data.defindexBalance === "number" ? data.defindexBalance : 0

  return {
    walletBalance,
    strategyBalance,
    totalBalance: walletBalance + strategyBalance,
    spendableAssetLabel: data.spendableAssetLabel ?? "USDC",
    walletAddress: data.publicKey ?? publicKey ?? "",
  }
}
