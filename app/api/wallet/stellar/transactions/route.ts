import { NextRequest, NextResponse } from "next/server"
import { Horizon } from "@stellar/stellar-sdk"
import { getStellarConfig } from "@/lib/turnkey/config"
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet"
import { createClient } from "@/lib/supabase/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"

export async function OPTIONS(request: Request) {
  return handleOPTIONS(request as any)
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const publicKeyParam = url.searchParams.get("publicKey")
    const limit = parseInt(url.searchParams.get("limit") || "20")
    
    let publicKeyToUse: string | null = null
    let wallet: any = null
    
    if (publicKeyParam && /^G[A-Z0-9]{55}$/.test(publicKeyParam)) {
      publicKeyToUse = publicKeyParam
      console.log("[Transaction History API] Using provided publicKey:", publicKeyToUse.substring(0, 10) + "...")
    } else {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      let userId: string | null = null

      if (user) {
        userId = user.id
        console.log("[Transaction History API] Using Supabase auth, userId:", userId)
      } else {
        userId = request.headers.get("x-user-id")
        console.log("[Transaction History API] Dev mode, userId from header:", userId)

        if (!userId) {
          return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401, headers: corsHeaders(request as any) }
          )
        }
      }

      wallet = await getStellarWallet(userId, !user)

      if (!wallet) {
        return NextResponse.json(
          { error: "Wallet not found" },
          { status: 404, headers: corsHeaders(request as any) }
        )
      }
      
      publicKeyToUse = wallet.publicKey
      if (publicKeyToUse) {
        console.log("[Transaction History API] Using wallet from database:", publicKeyToUse.substring(0, 10) + "...")
      }
    }

    if (!publicKeyToUse) {
      return NextResponse.json(
        { error: "Wallet address not provided" },
        { status: 400, headers: corsHeaders(request as any) }
      )
    }

    // Fetch transactions from Stellar Horizon
    const stellarConfig = getStellarConfig()
    const server = new Horizon.Server(
      stellarConfig.horizonUrl,
      { allowHttp: stellarConfig.network === "testnet" }
    )

    // Get USDC issuer for the network
    const USDC_ISSUERS = {
      testnet: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      mainnet: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    }
    const usdcIssuer = USDC_ISSUERS[stellarConfig.network as "testnet" | "mainnet"]

    console.log("[Transaction History API] Fetching transactions for account:", publicKeyToUse.substring(0, 10) + "...")
    console.log("[Transaction History API] Network:", stellarConfig.network, "USDC Issuer:", usdcIssuer)

    // Use payments endpoint which is more reliable and includes asset info directly
    // This fetches all payments (sent and received) for the account
    const payments = await server
      .payments()
      .forAccount(publicKeyToUse)
      .order("desc")
      .limit(limit)
      .call()

    console.log("[Transaction History API] Raw payments from Horizon:", payments.records.length)

    // Process payments and group by transaction hash
    const transactionMap = new Map<string, any>()

    for (const payment of payments.records) {
      const txHash = payment.transaction_hash
      
      // Skip if not a payment operation
      if (payment.type !== "payment") {
        console.log(`[Transaction History API] Skipping non-payment operation: ${payment.type}`)
        continue
      }
      
      // Get asset info - handle both native and non-native assets
      // Payments endpoint uses asset_type, asset_code, asset_issuer
      let assetCode = "XLM"
      let assetIssuer: string | null = null
      
      if (payment.asset_type === "native") {
        assetCode = "XLM"
      } else if (payment.asset_type === "credit_alphanum4" || payment.asset_type === "credit_alphanum12") {
        assetCode = payment.asset_code || "unknown"
        assetIssuer = payment.asset_issuer || null
      }
      
      console.log(`[Transaction History API] Payment asset: ${assetCode}, issuer: ${assetIssuer}, expected USDC issuer: ${usdcIssuer}`)
      
      // Filter for USDC payments only
      const isUSDC = assetCode === "USDC" && assetIssuer === usdcIssuer
      if (!isUSDC) {
        console.log(`[Transaction History API] Skipping non-USDC payment: ${assetCode} (issuer: ${assetIssuer}) from ${payment.from?.substring(0, 10) || payment.source_account?.substring(0, 10) || "unknown"}...`)
        continue
      }
      
      // Get from/to addresses - payments endpoint uses 'from' and 'to', or 'source_account' and 'to'
      const fromAddress = payment.from || payment.source_account || publicKeyToUse
      const toAddress = payment.to || publicKeyToUse
      
      // Get or create transaction entry
      if (!transactionMap.has(txHash)) {
        // Fetch transaction details for memo and timestamp
        try {
          const txDetails = await server.transactions().transaction(txHash).call()
          const memo = txDetails.memo_type && txDetails.memo ? 
            (txDetails.memo_type === "text" ? txDetails.memo : txDetails.memo_type === "id" ? `ID: ${txDetails.memo}` : null) 
            : null
          
          transactionMap.set(txHash, {
            id: txDetails.id,
            hash: txHash,
            createdAt: txDetails.created_at,
            ledger: txDetails.ledger,
            successful: txDetails.successful,
            memo: memo,
            operations: [],
          })
        } catch (error) {
          console.warn(`[Transaction History API] Could not fetch transaction ${txHash}:`, error)
          // Create minimal entry if we can't fetch details
          transactionMap.set(txHash, {
            id: txHash,
            hash: txHash,
            createdAt: payment.created_at || new Date().toISOString(),
            ledger: payment.ledger || 0,
            successful: true,
            memo: null,
            operations: [],
          })
        }
      }
      
      // Add payment operation to transaction
      const tx = transactionMap.get(txHash)!
      tx.operations.push({
        type: "payment",
        from: fromAddress,
        to: toAddress,
        amount: parseFloat(payment.amount),
        asset: assetCode,
        assetIssuer: assetIssuer,
      })
    }

    // Convert map to array and sort by date (newest first)
    const finalTransactions = Array.from(transactionMap.values())
      .filter(tx => tx.successful && tx.operations.length > 0)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    console.log("[Transaction History API] ✅ Fetched transactions:", {
      publicKey: publicKeyToUse.substring(0, 10) + "...",
      totalTransactions: finalTransactions.length,
      totalPayments: payments.records.length,
      usdcPayments: finalTransactions.length,
      limit
    })
    
    // Log first few transactions for debugging
    if (finalTransactions.length > 0) {
      console.log("[Transaction History API] Sample transaction:", {
        hash: finalTransactions[0].hash.substring(0, 16) + "...",
        operations: finalTransactions[0].operations.length,
        firstOp: finalTransactions[0].operations[0]
      })
    } else if (payments.records.length > 0) {
      console.log("[Transaction History API] Sample payment (not USDC):", {
        type: payments.records[0].type,
        asset_type: payments.records[0].asset_type,
        asset_code: payments.records[0].asset_code,
        asset_issuer: payments.records[0].asset_issuer,
        from: payments.records[0].from?.substring(0, 10) + "...",
        to: payments.records[0].to?.substring(0, 10) + "...",
      })
    }

    return NextResponse.json(
      {
        success: true,
        transactions: finalTransactions,
        count: finalTransactions.length,
      },
      { headers: corsHeaders(request as any) }
    )
  } catch (error) {
    console.error("[Transaction History API] Error fetching transactions:", error)
    
    return NextResponse.json(
      {
        error: "Failed to fetch transaction history",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders(request as any) }
    )
  }
}
