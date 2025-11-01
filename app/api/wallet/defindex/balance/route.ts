/**
 * DeFindex Balance API
 * Returns user's balance from DeFindex strategy
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getVaultBalance, getStrategyInfo } from "@/lib/defindex/vault"
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"

export async function OPTIONS(request: Request) {
  return handleOPTIONS(request)
}

export async function GET(request: Request) {
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
    
    // Get user's Stellar wallet
    const wallet = await getStellarWallet(user.id, true) // Use service client
    
    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet not found" },
        { status: 404, headers: corsHeaders(request) }
      )
    }
    
    // Get vault balance from DeFindex
    const vaultBalance = await getVaultBalance(wallet.publicKey)
    
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

