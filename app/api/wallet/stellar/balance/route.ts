import { createClient } from "@/lib/supabase/server"
import { NextResponse, NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { getStellarWallet, getWalletBalance } from "@/lib/turnkey/stellar-wallet"
import { getUSDCBalance } from "@/lib/turnkey/stellar-wallet"
import { monitorBalanceAndAutoDeposit } from "@/lib/defindex/auto-deposit"

export async function OPTIONS(request: Request) {
  return handleOPTIONS(request as any)
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    let userId: string | null = null

    if (user) {
      userId = user.id
      console.log("[Stellar Balance API] Using Supabase auth, userId:", userId)
    } else {
      // In dev mode, check for userId in headers
      userId = request.headers.get("x-user-id")
      console.log("[Stellar Balance API] Dev mode, userId from header:", userId)

      if (!userId) {
        console.error("[Stellar Balance API] No userId provided")
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: corsHeaders(request as any) }
        )
      }
    }

    // Get wallet from database (use service client if no authenticated user)
    const wallet = await getStellarWallet(userId, !user)

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet not found. Please create a wallet first." },
        { status: 404, headers: corsHeaders(request as any) }
      )
    }

    // Query XLM balance from Stellar network
    const balance = await getWalletBalance(wallet.publicKey, "native")
    
    // Query USDC balance for auto-deposit monitoring
    let usdcBalance = 0
    try {
      usdcBalance = await getUSDCBalance(wallet.publicKey)
      console.log("[Stellar Balance API] USDC balance:", usdcBalance)
    } catch (error) {
      console.warn("[Stellar Balance API] Could not fetch USDC balance:", error)
    }

    // Check for auto-deposit trigger (only if USDC balance > 0)
    // Note: This uses an in-memory store for previous balances
    // In production, you should use a database to track previous balances
    let autoDepositResult = null
    if (usdcBalance > 0) {
      try {
        // In a real implementation, you'd fetch previous balance from database
        // For now, we'll skip auto-deposit on balance API calls to avoid issues
        // Auto-deposit should be triggered by a separate background job or webhook
        console.log("[Stellar Balance API] USDC balance detected, but auto-deposit should be handled separately")
      } catch (error) {
        console.error("[Stellar Balance API] Auto-deposit check failed:", error)
        // Don't fail the balance request if auto-deposit check fails
      }
    }

    return NextResponse.json(
      {
        balance,
        asset: "XLM", // Native Stellar asset
        usdcBalance, // Include USDC balance
        publicKey: wallet.publicKey,
        network: wallet.network,
        autoDepositTriggered: autoDepositResult?.triggered || false,
      },
      { headers: corsHeaders(request as any) }
    )
  } catch (error) {
    console.error("[Stellar Balance API] Error getting balance:", error)

    const isDevelopment = process.env.NODE_ENV === "development"

    return NextResponse.json(
      {
        error: "Failed to get wallet balance",
        ...(isDevelopment && {
          details: error instanceof Error ? error.message : String(error),
        }),
      },
      { status: 500, headers: corsHeaders(request as any) }
    )
  }
}
