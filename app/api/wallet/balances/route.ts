import { NextResponse } from "next/server"
import { getApiUserClient } from "@/lib/ledger/supabase-admin"
import { fetchWalletBalancesFromHorizon } from "@/lib/stellar/structured-balances"
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet"
import { createClient } from "@/lib/supabase/server"

function sumUsdcTrustlines(
  rows: { assetCode: string; amount: string }[]
): number {
  return rows.reduce((sum, row) => {
    if ((row.assetCode || "").toUpperCase() !== "USDC") return sum
    const n = Number(row.amount)
    return sum + (Number.isFinite(n) ? n : 0)
  }, 0)
}

/**
 * Structured on-chain balances (Horizon) + optional DeFindex USDC breakdown when `x-user-id` resolves.
 * Pass `publicKey` from the client session so it matches /wallet even if DB user id is a tag string.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const publicKeyParam = url.searchParams.get("publicKey")
    const ctx = await getApiUserClient(request)

    let publicKey = publicKeyParam?.trim() ?? null
    if (publicKey && !/^G[A-Z0-9]{55}$/.test(publicKey)) {
      return NextResponse.json({ error: "Invalid publicKey" }, { status: 400 })
    }

    if (!publicKey) {
      if (!ctx) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      const userClient = await createClient()
      const {
        data: { user },
      } = await userClient.auth.getUser()
      const wallet = await getStellarWallet(ctx.userId, !user)
      if (!wallet?.publicKey) {
        return NextResponse.json({ error: "Wallet not found" }, { status: 404 })
      }
      publicKey = wallet.publicKey
    }

    const balances = await fetchWalletBalancesFromHorizon(publicKey)

    let usdcSummary: { trustline: number; strategy: number; total: number } | null = null
    if (ctx?.userId) {
      try {
        const { getVaultBalance } = await import("@/lib/defindex/vault")
        const v = await getVaultBalance(publicKey, ctx.userId)
        usdcSummary = {
          trustline: v.walletBalance,
          strategy: v.strategyBalance,
          total: v.totalBalance,
        }
      } catch (e) {
        console.warn("[wallet/balances] DeFindex merge skipped:", e)
      }
    }

    const trustlineFallback = sumUsdcTrustlines(balances)
    const vaultTotal = usdcSummary?.total ?? 0
    const displayTotalUsdc = Math.max(trustlineFallback, vaultTotal)

    return NextResponse.json({
      domain: "wallet" as const,
      publicKey,
      balances,
      usdcSummary,
      /** Aligns with /wallet: DeFindex total when present, else USDC trustline on the account. */
      displayTotalUsdc,
    })
  } catch (e) {
    console.error("[wallet/balances]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load balances" },
      { status: 500 }
    )
  }
}
