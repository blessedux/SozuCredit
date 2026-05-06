import { fetchWalletBalancesFromHorizon } from "@/lib/stellar/structured-balances"
import { createClient } from "@/lib/supabase/server"
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet"

function sumUsdcTrustlines(rows: { assetCode: string; amount: string }[]): number {
  return rows.reduce((sum, row) => {
    if ((row.assetCode || "").toUpperCase() !== "USDC") return sum
    const n = Number(row.amount)
    return sum + (Number.isFinite(n) ? n : 0)
  }, 0)
}

/**
 * Same USDC total as GET /api/wallet/balances `displayTotalUsdc`.
 * Pass `publicKey` to mirror the route query param; otherwise resolves from `userId`.
 */
export async function getWalletDisplayUsdc(opts: {
  userId?: string | null
  publicKey?: string | null
}): Promise<number | null> {
  const { userId, publicKey: overridePk } = opts
  try {
    let publicKey = overridePk?.trim() ?? null
    if (publicKey && !/^G[A-Z0-9]{55}$/.test(publicKey)) {
      return null
    }

    if (!publicKey) {
      if (!userId) return null
      const userClient = await createClient()
      const {
        data: { user },
      } = await userClient.auth.getUser()
      const wallet = await getStellarWallet(userId, !user)
      if (!wallet?.publicKey) return null
      publicKey = wallet.publicKey
    }

    const balances = await fetchWalletBalancesFromHorizon(publicKey)

    let usdcSummary: { trustline: number; strategy: number; total: number } | null = null
    try {
      if (userId) {
        const { getVaultBalance } = await import("@/lib/defindex/vault")
        const v = await getVaultBalance(publicKey, userId)
        usdcSummary = {
          trustline: v.walletBalance,
          strategy: v.strategyBalance,
          total: v.totalBalance,
        }
      }
    } catch {
      // ignore — same as /api/wallet/balances
    }

    const trustlineFallback = sumUsdcTrustlines(balances)
    const vaultTotal = usdcSummary?.total ?? 0
    return Math.max(trustlineFallback, vaultTotal)
  } catch {
    return null
  }
}
