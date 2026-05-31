"use client"

export type UnifiedUsdcBalance = {
  /** Spendable for sends (BlendUSDC on C testnet). */
  walletBalance: number
  /** Circle USDC SAC on C (testnet) — visible on Stellar Expert, not used for sends yet. */
  sorobanSacBalance: number
  strategyBalance: number
  /** Visible wallet USDC (Blend + SAC + classic on G signer). */
  displayWalletUsdc: number
  /** Balance card primary figure (display wallet + DeFindex strategy). */
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
    sorobanUsdcBalance?: number
    sorobanSacUsdcBalance?: number
    defindexBalance?: number
    totalDisplayUsdcBalance?: number
    spendableAssetLabel?: string
    publicKey?: string
    classicUsdcOnSigner?: number
  }

  const walletBalance = typeof data.usdcBalance === "number" ? data.usdcBalance : 0
  const sorobanSacBalance =
    typeof data.sorobanSacUsdcBalance === "number" ? data.sorobanSacUsdcBalance : 0
  const strategyBalance = typeof data.defindexBalance === "number" ? data.defindexBalance : 0
  const classicOnSigner =
    typeof data.classicUsdcOnSigner === "number" ? data.classicUsdcOnSigner : 0

  const displayWalletUsdc =
    typeof data.displayWalletUsdc === "number"
      ? data.displayWalletUsdc
      : walletBalance + sorobanSacBalance + classicOnSigner

  const displayBalance =
    typeof data.totalDisplayUsdcBalance === "number"
      ? data.totalDisplayUsdcBalance
      : displayWalletUsdc + strategyBalance

  return {
    walletBalance,
    sorobanSacBalance,
    strategyBalance,
    displayWalletUsdc,
    displayBalance,
    classicOnSigner,
    spendableAssetLabel: data.spendableAssetLabel ?? "USDC",
    walletAddress: (data.publicKey ?? publicKey ?? "").trim().toUpperCase(),
  }
}
