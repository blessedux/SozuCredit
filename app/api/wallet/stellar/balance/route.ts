import { createClient } from "@/lib/supabase/server"
import { NextResponse, NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { getStellarWallet, getWalletBalance } from "@/lib/turnkey/stellar-wallet"
import { getUSDCBalance } from "@/lib/turnkey/stellar-wallet"
import { getStellarConfig } from "@/lib/turnkey/config"
import { Horizon } from "@stellar/stellar-sdk"
import { monitorBalanceAndAutoDeposit } from "@/lib/defindex/auto-deposit"

export async function OPTIONS(request: Request) {
  return handleOPTIONS(request as any)
}

export async function GET(request: NextRequest) {
  try {
    // Check if publicKey is provided as query parameter (takes precedence)
    const url = new URL(request.url)
    const publicKeyParam = url.searchParams.get("publicKey")
    
    let publicKeyToUse: string | null = null
    let wallet: any = null
    
    if (publicKeyParam && /^G[A-Z0-9]{55}$/.test(publicKeyParam)) {
      // Use provided public key directly (for real-time balance checks)
      publicKeyToUse = publicKeyParam
      console.log("[Stellar Balance API] Using provided publicKey:", publicKeyToUse.substring(0, 10) + "...")
    } else {
      // Get wallet from database
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
      wallet = await getStellarWallet(userId, !user)

      if (!wallet) {
        return NextResponse.json(
          { error: "Wallet not found. Please create a wallet first." },
          { status: 404, headers: corsHeaders(request as any) }
        )
      }
      
      publicKeyToUse = wallet.publicKey
      if (publicKeyToUse) {
        console.log("[Stellar Balance API] Using wallet from database:", publicKeyToUse.substring(0, 10) + "...")
      }
    }

    if (!publicKeyToUse) {
      return NextResponse.json(
        { error: "Wallet address not provided" },
        { status: 400, headers: corsHeaders(request as any) }
      )
    }

    // Query XLM balance from Stellar network
    const balance = await getWalletBalance(publicKeyToUse, "native")
    
    // Query USDC balance for auto-deposit monitoring
    let usdcBalance = 0
    let allBalances: any[] = []
    try {
      // First, get all account balances to see what's actually on the account
      const stellarConfig = getStellarConfig()
      const server = new Horizon.Server(
        stellarConfig.horizonUrl,
        { allowHttp: stellarConfig.network === "testnet" }
      )
      
      const account = await server.loadAccount(publicKeyToUse)
      allBalances = account.balances.map((b: any) => ({
        asset_type: b.asset_type,
        asset_code: b.asset_code || "XLM",
        asset_issuer: b.asset_issuer || undefined,
        balance: b.balance,
        limit: b.limit || undefined,
      }))
      
      console.log("[Stellar Balance API] 📊 All account balances on Stellar network:", {
        publicKey: publicKeyToUse.substring(0, 10) + "...",
        fullPublicKey: publicKeyToUse,
        balances: allBalances,
        totalBalances: allBalances.length
      })
      
      // Now get USDC balance specifically
      usdcBalance = await getUSDCBalance(publicKeyToUse)
      console.log("[Stellar Balance API] 💰 USDC balance:", {
        publicKey: publicKeyToUse.substring(0, 10) + "...",
        fullPublicKey: publicKeyToUse,
        usdcBalance,
        note: "This is the actual USDC balance in the wallet (not in DeFindex)"
      })
    } catch (error) {
      console.warn("[Stellar Balance API] Could not fetch USDC balance:", error)
    }
    
    // Check DeFindex position if we have a userId
    let defindexBalance = 0
    let defindexShares = 0
    try {
      // Try to get userId from headers or auth
      let userId: string | null = null
      if (wallet) {
        // If we have wallet from database, try to get userId from auth
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        userId = user?.id || null
      } else {
        // Try from headers
        userId = request.headers.get("x-user-id")
      }
      
      if (userId) {
        const { getVaultBalance } = await import("@/lib/defindex/vault")
        const vaultBalance = await getVaultBalance(publicKeyToUse, userId)
        defindexBalance = vaultBalance.strategyBalance
        defindexShares = vaultBalance.strategyShares
        console.log("[Stellar Balance API] 🏦 DeFindex position:", {
          walletBalance: vaultBalance.walletBalance,
          strategyBalance: vaultBalance.strategyBalance,
          totalBalance: vaultBalance.totalBalance,
          strategyShares: vaultBalance.strategyShares,
          note: "strategyBalance is locked in DeFindex, walletBalance is available for sending"
        })
      }
    } catch (error) {
      console.warn("[Stellar Balance API] Could not fetch DeFindex position:", error)
    }

    // Check for auto-deposit trigger (only if USDC balance > 0 and we have a wallet from database)
    // Note: Auto-deposit should be triggered by a separate background job or webhook
    // We skip it here to avoid issues with balance API calls
    const autoDepositTriggered = false

    return NextResponse.json(
      {
        balance,
        asset: "XLM", // Native Stellar asset
        usdcBalance, // Include USDC balance (real-time from Stellar network - available for sending)
        defindexBalance, // USDC locked in DeFindex strategy (not available for sending)
        defindexShares, // Strategy shares
        totalUsdcBalance: usdcBalance + defindexBalance, // Total USDC (wallet + strategy)
        allBalances, // All balances on the Stellar account (for debugging)
        publicKey: publicKeyToUse,
        network: wallet?.network || "testnet",
        autoDepositTriggered: autoDepositTriggered,
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
