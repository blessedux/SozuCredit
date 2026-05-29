/**
 * DeFindex Withdraw API
 *
 * POST body: { amount?: number, strategyId?: "fixed" | "yieldblox" }
 *
 * When amount is omitted, withdraws the full strategy balance.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withdrawFromStrategy, getVaultBalance } from "@/lib/defindex/vault"
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

    const wallet = await getStellarWallet(user.id, true)
    if (!wallet) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404, headers: corsHeaders(request) })
    }

    // Determine amount — default to full strategy balance
    const vaultBal = await getVaultBalance(wallet.publicKey, user.id, rawStrategyId)
    const requestedAmount: number | undefined =
      typeof body.amount === "number" ? body.amount : undefined
    const withdrawAmount =
      requestedAmount !== undefined
        ? Math.min(requestedAmount, vaultBal.strategyBalance)
        : vaultBal.strategyBalance

    if (withdrawAmount <= 0) {
      return NextResponse.json(
        {
          error: "Nothing to withdraw",
          details: "Strategy balance is zero.",
          strategyBalance: vaultBal.strategyBalance,
        },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    const result = await withdrawFromStrategy(
      wallet.publicKey,
      withdrawAmount,
      user.id,
      rawStrategyId
    )

    return NextResponse.json(
      {
        success: true,
        strategyId: rawStrategyId,
        withdrawAmount,
        balance: result.balance,
        transactionHash: result.transactionHash,
      },
      { headers: corsHeaders(request) }
    )
  } catch (error) {
    console.error("[DeFindex Withdraw API] Error:", error)
    return NextResponse.json(
      { error: "Failed to withdraw", details: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}
