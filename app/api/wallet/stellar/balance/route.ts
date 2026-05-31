import { createClient } from "@/lib/supabase/server"
import { NextResponse, NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { getStellarWallet, getWalletBalance } from "@/lib/turnkey/stellar-wallet"
import { getUsdcBalanceBreakdown } from "@/lib/stellar/usdc-balance"
import {
  getBlendUsdcContractId,
  getCircleTestnetUsdcSacContractId,
} from "@/lib/stellar/soroban-token"
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
    
    if (publicKeyParam && /^[GC][A-Z0-9]{55}$/.test(publicKeyParam)) {
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

    let balanceUserId: string | null = wallet?.userId ?? null
    if (!balanceUserId) {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      balanceUserId = user?.id ?? request.headers.get("x-user-id")
    }

    let signerForBreakdown = wallet?.signerPublicKey?.trim() ?? null
    if (!signerForBreakdown && publicKeyToUse.startsWith("C") && balanceUserId) {
      const rowWallet = await getStellarWallet(balanceUserId, true)
      if (rowWallet?.signerPublicKey) {
        signerForBreakdown = rowWallet.signerPublicKey.trim()
      }
    }

    // Query XLM balance from Stellar network
    const balance = await getWalletBalance(publicKeyToUse, "native")
    const usdcBreakdown = await getUsdcBalanceBreakdown({
      walletAddress: publicKeyToUse,
      signerPublicKey: signerForBreakdown,
    })
    const usdcBalance = usdcBreakdown.spendable
    const displayWalletUsdc = usdcBreakdown.displayOnWallet

    let allBalances: { asset_type: string; asset_code: string; asset_issuer?: string; balance: string }[] =
      []
    if (publicKeyToUse.startsWith("G")) {
      try {
        const stellarConfig = getStellarConfig()
        const server = new Horizon.Server(stellarConfig.horizonUrl, {
          allowHttp: stellarConfig.network === "testnet",
        })
        const account = await server.loadAccount(publicKeyToUse)
        allBalances = account.balances.map((b: { asset_type: string; asset_code?: string; asset_issuer?: string; balance: string; limit?: string }) => ({
          asset_type: b.asset_type,
          asset_code: b.asset_code || "XLM",
          asset_issuer: b.asset_issuer || undefined,
          balance: b.balance,
          limit: b.limit || undefined,
        }))
      } catch (error) {
        console.warn("[Stellar Balance API] Could not load classic account balances:", error)
      }
    }

    console.log("[Stellar Balance API] 💰 USDC breakdown:", {
      publicKey: publicKeyToUse.substring(0, 10) + "...",
      fullPublicKey: publicKeyToUse,
      spendable: usdcBalance,
      displayOnWallet: displayWalletUsdc,
      sorobanOnWallet: usdcBreakdown.sorobanOnWallet,
      sorobanSacOnWallet: usdcBreakdown.sorobanSacOnWallet,
      classicOnSigner: usdcBreakdown.classicOnSigner,
      asset: usdcBreakdown.spendableAssetLabel,
      hasFunder: Boolean(process.env.STELLAR_FUNDER_SECRET?.trim()),
      rpcUrl: process.env.SOROBAN_RPC_URL?.trim() ? "SOROBAN_RPC_URL" : "default/public",
    })

    if (
      publicKeyToUse.startsWith("C") &&
      usdcBreakdown.sorobanOnWallet === 0 &&
      usdcBreakdown.sorobanSacOnWallet === 0 &&
      usdcBreakdown.classicOnSigner === 0
    ) {
      console.warn(
        "[Stellar Balance API] C wallet shows 0 Soroban USDC — verify BlendUSDC was sent to this exact address and STELLAR_FUNDER_SECRET + SOROBAN_RPC_URL are set on the server.",
      )
    } else if (
      publicKeyToUse.startsWith("C") &&
      usdcBreakdown.sorobanOnWallet === 0 &&
      usdcBreakdown.sorobanSacOnWallet > 0
    ) {
      console.log(
        "[Stellar Balance API] C wallet holds Circle SAC USDC (visible on Stellar Expert); BlendUSDC is 0 — sends still require Blend on C.",
      )
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

    const cfg = getStellarConfig()
    const network = (wallet?.network || cfg.network) as "testnet" | "mainnet"

    return NextResponse.json(
      {
        balance,
        asset: "XLM", // Native Stellar asset
        usdcBalance, // Spendable for sends (BlendUSDC on C testnet, Circle USDC on G)
        displayWalletUsdc, // All USDC visible on wallet (+ classic on G signer when C)
        spendableAssetLabel: usdcBreakdown.spendableAssetLabel,
        sorobanUsdcBalance: usdcBreakdown.sorobanOnWallet,
        sorobanSacUsdcBalance: usdcBreakdown.sorobanSacOnWallet,
        classicUsdcOnSigner: usdcBreakdown.classicOnSigner,
        defindexBalance, // USDC locked in DeFindex strategy (not available for sending)
        defindexShares, // Strategy shares
        totalUsdcBalance: displayWalletUsdc + defindexBalance,
        totalDisplayUsdcBalance: displayWalletUsdc + defindexBalance,
        walletMustMigrate: !publicKeyToUse.startsWith("C"),
        allBalances, // Classic Horizon balances when wallet is G
        publicKey: publicKeyToUse,
        network,
        autoDepositTriggered: autoDepositTriggered,
        diagnostics: {
          blendContractId: getBlendUsdcContractId(network),
          circleSacContractId:
            network === "testnet" ? getCircleTestnetUsdcSacContractId() : null,
          sorobanRpcConfigured: Boolean(
            process.env.SOROBAN_RPC_URL?.trim() ||
              process.env.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim(),
          ),
          funderConfigured: Boolean(process.env.STELLAR_FUNDER_SECRET?.trim()),
        },
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
