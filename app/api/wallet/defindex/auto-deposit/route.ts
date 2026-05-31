/**
 * DeFindex Auto-Deposit API
 * Triggers automatic deposit of funds into DeFindex strategy
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkAndTriggerAutoDeposit, monitorBalanceAndAutoDeposit } from "@/lib/defindex/auto-deposit"
import { getUSDCBalance, getStellarWallet, updatePreviousUsdcBalance, saveBalanceSnapshot } from "@/lib/turnkey/stellar-wallet"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function POST(request: NextRequest) {
  try {
    // Get user ID from session
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders(request) }
      )
    }

    console.log("[Auto-Deposit API] Starting auto-deposit check for user:", user.id)

    // Get user's Stellar wallet
    const wallet = await getStellarWallet(user.id, true) // Use service client

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet not found" },
        { status: 404, headers: corsHeaders(request) }
      )
    }

    // Get current USDC balance
    const currentBalance = await getUSDCBalance(wallet.publicKey)
    console.log("[Auto-Deposit API] Current USDC balance:", currentBalance)

    // Allow caller to pass strategy + idle-balance flag
    const body = await request.json().catch(() => ({}))
    const strategyId = body.strategyId === "yieldblox" ? "yieldblox" : "fixed"
    const depositIdleBalance = body.depositIdleBalance === true

    // Check and trigger auto-deposit if needed
    const result = await checkAndTriggerAutoDeposit(
      user.id,
      wallet.previousUsdcBalance ?? null,
      currentBalance,
      {
        minDepositAmount: Number(process.env.VAULT_MIN_DEPOSIT ?? "10"),
        networkFeeBuffer: Number(process.env.VAULT_NETWORK_FEE_BUFFER ?? "0.4"),
        strategyId,
        depositIdleBalance,
      }
    )

    if (result.triggered) {
      console.log("[Auto-Deposit API] ✅ Auto-deposit triggered successfully:", {
        depositAmount: result.depositAmount,
        transactionHash: result.transactionHash,
      })

      // Update the previous balance after successful deposit
      if (result.depositAmount && result.transactionHash) {
        await updatePreviousUsdcBalance(user.id, currentBalance - result.depositAmount, true)
        await saveBalanceSnapshot(
          user.id,
          currentBalance - result.depositAmount,
          {
            previousBalance: wallet.previousUsdcBalance,
            autoDepositTriggered: true,
            depositAmount: result.depositAmount,
            transactionHash: result.transactionHash,
            snapshotType: "auto_deposit_trigger",
          },
          true
        )
      }

      return NextResponse.json(
        {
          success: true,
          triggered: true,
          depositAmount: result.depositAmount,
          transactionHash: result.transactionHash,
          newBalance: currentBalance - (result.depositAmount || 0),
          message: `Successfully deposited ${result.depositAmount} USDC into DeFindex strategy`,
        },
        { headers: corsHeaders(request) }
      )
    } else {
      console.log("[Auto-Deposit API] ℹ️ Auto-deposit not triggered")

      return NextResponse.json(
        {
          success: true,
          triggered: false,
          currentBalance,
          previousBalance: wallet.previousUsdcBalance,
          message: "Auto-deposit not triggered - balance increase below threshold or no previous balance",
        },
        { headers: corsHeaders(request) }
      )
    }
  } catch (error) {
    console.error("[Auto-Deposit API] Error:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Failed to process auto-deposit",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id ?? request.headers.get("x-user-id")

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders(request) }
      )
    }

    const wallet = await getStellarWallet(userId, !user)

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet not found" },
        { status: 404, headers: corsHeaders(request) }
      )
    }

    const { getSpendableUsdcBalance } = await import("@/lib/stellar/usdc-balance")
    const currentBalance = await getSpendableUsdcBalance(
      wallet.publicKey,
      wallet.signerPublicKey ?? null,
      wallet.network as "testnet" | "mainnet",
    )

    // Calculate auto-deposit status
    const balanceIncrease = wallet.previousUsdcBalance
      ? currentBalance - wallet.previousUsdcBalance
      : 0

    const wouldTrigger = wallet.previousUsdcBalance !== null &&
                        balanceIncrease >= 10.0 &&
                        currentBalance >= 11.0 // Min $10 deposit + $1 buffer

    return NextResponse.json(
      {
        success: true,
        walletAddress: wallet.publicKey,
        currentBalance,
        previousBalance: wallet.previousUsdcBalance,
        balanceIncrease,
        wouldTriggerAutoDeposit: wouldTrigger,
        minDepositAmount: 10.0,
        networkFeeBuffer: 1.0,
        status: wallet.previousUsdcBalance === null ? "initializing" : "ready",
      },
      { headers: corsHeaders(request) }
    )
  } catch (error) {
    console.error("[Auto-Deposit API] Error getting status:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Failed to get auto-deposit status",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}