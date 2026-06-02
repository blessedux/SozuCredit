/**
 * DeFindex Deposit API
 *
 * POST body: { amount?: number, strategyId?: "fixed" | "yieldblox" }
 *
 * Pre-deposit guards:
 *   - Wallet must hold the vault deposit asset (resolved on-chain via get_assets)
 *   - amount >= VAULT_MIN_DEPOSIT
 *   - Leaves VAULT_NETWORK_FEE_BUFFER in wallet
 *
 * Responds with { needsTrustline: true } when the BlendUSDC trustline is missing.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { depositToStrategy } from "@/lib/defindex/vault"
import { getResolvedDeFindexConfig } from "@/lib/defindex/config"
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import type { StrategyId } from "@/lib/defindex/strategy-catalog"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders(request) })
    }

    const body = await request.json().catch(() => ({}))
    const rawStrategyId: StrategyId =
      body.strategyId === "yieldblox" ? "yieldblox" : "fixed"

    const config = await getResolvedDeFindexConfig(rawStrategyId)

    const wallet = await getStellarWallet(user.id, true)
    if (!wallet) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404, headers: corsHeaders(request) })
    }

    const { getDepositableUsdcBalance } = await import("@/lib/stellar/soroban-token")
    const walletBalance = await getDepositableUsdcBalance(
      wallet.publicKey,
      config.network,
      config.assetAddress,
    )

    // Validate amount
    const requestedAmount: number | undefined = typeof body.amount === "number" ? body.amount : undefined
    const maxDepositable = Math.max(0, walletBalance - config.networkFeeBuffer)
    const depositAmount = requestedAmount !== undefined
      ? Math.min(requestedAmount, maxDepositable)
      : maxDepositable

    if (depositAmount < config.minDepositAmount) {
      return NextResponse.json(
        {
          error: "Insufficient balance",
          details: `Minimum deposit is $${config.minDepositAmount} USDC. Available: $${maxDepositable.toFixed(2)} USDC.`,
          walletBalance,
          depositAsset: config.assetAddress,
          minDeposit: config.minDepositAmount,
          networkFeeBuffer: config.networkFeeBuffer,
        },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    const result = await depositToStrategy(
      wallet.publicKey,
      depositAmount,
      user.id,
      rawStrategyId
    )

    return NextResponse.json(
      {
        success: true,
        strategyId: rawStrategyId,
        depositAmount,
        shares: result.shares,
        balance: result.balance,
        transactionHash: result.transactionHash,
      },
      { headers: corsHeaders(request) }
    )
  } catch (error) {
    console.error("[DeFindex Deposit API] Error:", error)
    const message = error instanceof Error ? error.message : String(error)

    // Surface trustline errors as a specific flag so the UI can prompt the user.
    const needsTrustline =
      message.toLowerCase().includes("trustline") ||
      message.toLowerCase().includes("no trust")

    return NextResponse.json(
      { error: "Failed to deposit", details: message, needsTrustline },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}
