"use client"

export type TokenBalanceRow = {
  assetId: string
  contractId: string
  symbol: string
  displayName: string
  balance: number
}

export type UnifiedUsdcBalance = {
  /** BlendUSDC on C (TESTNET_USDC_CONTRACT_ADDRESS). */
  blendBalance: number
  /** @deprecated Alias for blendBalance — used by send modal / earn. */
  walletBalance: number
  /** Spendable on C across unique Soroban contracts (one contract per send). */
  spendableOnC: number
  /** Circle USDC SAC on C (testnet). */
  sorobanSacBalance: number
  tokenBalances: TokenBalanceRow[]
  strategyBalance: number
  /** Visible wallet USDC (Blend + SAC + classic on G signer). */
  displayWalletUsdc: number
  /** Balance card primary figure (display wallet + DeFindex strategy). */
  displayBalance: number
  classicOnSigner: number
  legacyUsdcOnSigner: number
  spendableAssetLabel: string
  walletAddress: string
  contractIds?: {
    blend?: string | null
    circleSac?: string | null
  }
}

function uniqueTokenSum(rows: TokenBalanceRow[]): number {
  const byContract = new Map<string, number>()
  for (const row of rows) {
    const key = (row.contractId || row.assetId).trim().toUpperCase()
    byContract.set(key, Math.max(byContract.get(key) ?? 0, Number(row.balance) || 0))
  }
  return [...byContract.values()].reduce((s, n) => s + n, 0)
}

function balanceForAsset(rows: TokenBalanceRow[], assetId: string): number {
  return rows.find((r) => r.assetId === assetId)?.balance ?? 0
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
    publicKey && /^(C|G)[A-Z0-9]{55}$/.test(publicKey)
      ? `?publicKey=${encodeURIComponent(publicKey)}`
      : ""

  const res = await fetch(`/api/wallet/stellar/balance${qs}`, {
    headers: { "x-user-id": userId },
    cache: "no-store",
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    console.error("[UnifiedBalance] API error", res.status, errBody)
    return null
  }

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
    legacyUsdcOnSigner?: number
    tokenBalances?: TokenBalanceRow[]
    maxSingleTokenBalance?: number
    diagnostics?: {
      blendContractId?: string | null
      circleSacContractId?: string | null
    }
  }

  const tokenRows = Array.isArray(data.tokenBalances) ? data.tokenBalances : []
  const tokenSum = uniqueTokenSum(tokenRows)

  const blendBalance =
    typeof data.sorobanUsdcBalance === "number"
      ? data.sorobanUsdcBalance
      : balanceForAsset(tokenRows, "blend_usdc")

  const sorobanSacBalance =
    typeof data.sorobanSacUsdcBalance === "number"
      ? data.sorobanSacUsdcBalance
      : balanceForAsset(tokenRows, "circle_usdc_sac")

  const spendableOnC =
    typeof data.usdcBalance === "number" && data.usdcBalance > 0
      ? data.usdcBalance
      : Math.max(tokenSum, blendBalance + sorobanSacBalance)

  const strategyBalance = typeof data.defindexBalance === "number" ? data.defindexBalance : 0
  const legacyUsdcOnSigner =
    typeof data.legacyUsdcOnSigner === "number"
      ? data.legacyUsdcOnSigner
      : typeof data.classicUsdcOnSigner === "number"
        ? data.classicUsdcOnSigner
        : 0
  const classicOnSigner = 0

  const walletUsdcFromLines = blendBalance + sorobanSacBalance
  const displayWalletUsdc =
    typeof data.displayWalletUsdc === "number"
      ? data.displayWalletUsdc
      : Math.max(spendableOnC, walletUsdcFromLines)

  const lineTotal = displayWalletUsdc + strategyBalance
  const displayBalance =
    typeof data.totalDisplayUsdcBalance === "number"
      ? Math.max(data.totalDisplayUsdcBalance, lineTotal)
      : lineTotal

  // New C wallets are unfunded until Deposit / faucet — 0 is the happy empty state.
  if (
    publicKey?.startsWith("C") &&
    displayBalance === 0 &&
    displayWalletUsdc === 0 &&
    data.diagnostics
  ) {
    console.debug("[UnifiedBalance] C wallet empty (expected until funded)", {
      publicKey: publicKey.slice(0, 12) + "…",
    })
  }

  return {
    blendBalance,
    walletBalance: blendBalance,
    spendableOnC,
    sorobanSacBalance,
    tokenBalances: tokenRows,
    strategyBalance,
    displayWalletUsdc,
    displayBalance,
    classicOnSigner,
    legacyUsdcOnSigner,
    spendableAssetLabel: data.spendableAssetLabel ?? "USDC",
    walletAddress: (data.publicKey ?? publicKey ?? "").trim().toUpperCase(),
    contractIds: {
      blend:
        data.diagnostics?.blendContractId ??
        tokenRows.find((r) => r.assetId === "blend_usdc")?.contractId ??
        null,
      circleSac:
        data.diagnostics?.circleSacContractId ??
        tokenRows.find((r) => r.assetId === "circle_usdc_sac")?.contractId ??
        null,
    },
  }
}
