/**
 * DeFindex Balance API
 * Returns user's balance from DeFindex strategy
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getVaultBalance, getStrategyInfo } from "@/lib/defindex/vault"
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function GET(request: NextRequest) {
  try {
    // Get user ID from session
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    let userId: string | null = null
    
    if (user) {
      userId = user.id
      console.log("[DeFindex Balance API] Using Supabase auth, userId:", userId)
    } else {
      // Fallback: check for userId in headers (for production when auth cookies might not work)
      userId = request.headers.get("x-user-id")
      console.log("[DeFindex Balance API] Fallback mode, userId from header:", userId)
      
      if (!userId) {
        console.error("[DeFindex Balance API] No userId provided")
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: corsHeaders(request) }
        )
      }
    }
    
    const url = new URL(request.url)
    const publicKeyParam = url.searchParams.get("publicKey")?.trim().toUpperCase()

    const wallet = await getStellarWallet(userId, !user)
    
    if (!wallet && !publicKeyParam) {
      return NextResponse.json(
        { error: "Wallet not found" },
        { status: 404, headers: corsHeaders(request) }
      )
    }

    const walletPk =
      publicKeyParam && /^[GC][A-Z0-9]{55}$/.test(publicKeyParam)
        ? publicKeyParam
        : wallet!.publicKey

    if (!walletPk.startsWith("C")) {
      return NextResponse.json(
        {
          error: "DeFindex requires a smart account (C…). Complete passkey wallet setup first.",
          code: "WALLET_MUST_BE_SMART_ACCOUNT",
        },
        { status: 422, headers: corsHeaders(request) }
      )
    }
    
    const vaultBalance = await getVaultBalance(walletPk, userId)
    
    // Get strategy info including APY
    const strategyInfo = await getStrategyInfo()
    
    return NextResponse.json(
      {
        success: true,
        balance: vaultBalance.totalBalance,
        walletBalance: vaultBalance.walletBalance,
        strategyBalance: vaultBalance.strategyBalance,
        strategyShares: vaultBalance.strategyShares,
        apy: strategyInfo.apy,
        strategy: {
          address: strategyInfo.strategyAddress,
          assetAddress: strategyInfo.assetAddress,
          totalAssets: strategyInfo.totalAssets,
          totalShares: strategyInfo.totalShares,
        },
      },
      { headers: corsHeaders(request) }
    )
  } catch (error) {
    console.error("[DeFindex Balance API] Error:", error)
    
    return NextResponse.json(
      {
        error: "Failed to get DeFindex balance",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}

