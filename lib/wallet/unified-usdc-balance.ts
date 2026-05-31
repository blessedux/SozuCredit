"use client"

export type UnifiedUsdcBalance = {
  /** Spendable on the canonical wallet (BlendUSDC on C testnet). */
  walletBalance: number
  strategyBalance: number
  /** wallet + strategy — portfolio total. */
  totalBalance: number
  /** Balance card primary figure (includes classic USDC on G signer when C). */
  displayBalance: number
  classicOnSigner: number
  spendableAssetLabel: string
  walletAddress: string
}

/**
 * Single source of truth for USDC balances — matches what the payment API enforces for sends,
 * with a separate display total so Stellar Expert–visible USDC is not hidden.
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
    displayWalletUsdc?: number
    defindexBalance?: number
    totalDisplayUsdcBalance?: number
    spendableAssetLabel?: string
    publicKey?: string
    classicUsdcOnSigner?: number
  }

  const walletBalance = typeof data.usdcBalance === "number" ? data.usdcBalance : 0
  const strategyBalance = typeof data.defindexBalance === "number" ? data.defindexBalance : 0
  const displayWalletUsdc =
    typeof data.displayWalletUsdc === "number" ? data.displayWalletUsdc : walletBalance
  const classicOnSigner =
    typeof data.classicUsdcOnSigner === "number" ? data.classicUsdcOnSigner : 0
  const displayBalance =
    typeof data.totalDisplayUsdcBalance === "number"
      ? data.totalDisplayUsdcBalance
      : displayWalletUsdc + strategyBalance

  return {
    walletBalance,
    strategyBalance,
    totalBalance: walletBalance + strategyBalance,
    displayBalance,
    classicOnSigner,
    spendableAssetLabel: data.spendableAssetLabel ?? "USDC",
    walletAddress: data.publicKey ?? publicKey ?? "",
  }
}
