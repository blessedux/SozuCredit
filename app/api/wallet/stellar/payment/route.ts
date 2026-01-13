import { NextRequest, NextResponse } from "next/server"
import { Horizon, Asset, TransactionBuilder, Networks, Operation, BASE_FEE, Account, Memo } from "@stellar/stellar-sdk"
import { getStellarConfig } from "@/lib/turnkey/config"
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet"

const corsHeaders = (request: NextRequest) => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
})

const USDC_ISSUERS = {
  testnet: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  mainnet: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
}

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders(request) })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userId = request.headers.get("x-user-id")
    const { destination, amount, sender, memo } = body

    if (!userId) {
      return NextResponse.json(
        { error: "User ID required" },
        { status: 401, headers: corsHeaders(request) }
      )
    }

    // Extract memo if provided (for transaction building)
    const transactionMemo = memo || null

    // If signed transaction is provided, submit it
    if (body.signedTransactionXdr) {
      console.log("[Payment API] Submitting signed transaction...")
      const stellarConfig = getStellarConfig()
      const server = new Horizon.Server(
        stellarConfig.horizonUrl,
        { allowHttp: stellarConfig.network === "testnet" }
      )

      const networkPassphrase = stellarConfig.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET
      
      try {
        const signedTransaction = TransactionBuilder.fromXDR(body.signedTransactionXdr, networkPassphrase)
        console.log("[Payment API] Transaction parsed, submitting to Horizon...")
        
        // Log transaction details for debugging
        const operations = signedTransaction.operations || []
        if (operations.length > 0) {
          const paymentOp = operations[0] as any
          console.log("[Payment API] Transaction details:", {
            source: signedTransaction.source,
            destination: paymentOp.destination,
            amount: paymentOp.amount,
            asset: paymentOp.asset?.code || "native",
            assetIssuer: paymentOp.asset?.issuer || "N/A"
          })
        }
        
        const response = await server.submitTransaction(signedTransaction)
        console.log("[Payment API] ✅ Transaction submitted successfully:", response.hash)

        return NextResponse.json(
          {
            success: true,
            transactionHash: response.hash,
          },
          { headers: corsHeaders(request) }
        )
      } catch (submitError: any) {
        // Log transaction details from the signed transaction for debugging
        try {
          const signedTransaction = TransactionBuilder.fromXDR(body.signedTransactionXdr, networkPassphrase)
          const operations = signedTransaction.operations || []
          if (operations.length > 0) {
            const paymentOp = operations[0] as any
            console.error("[Payment API] ❌ Transaction submission failed - Transaction details:", {
              source: signedTransaction.source,
              destination: paymentOp.destination,
              amount: paymentOp.amount,
              asset: paymentOp.asset?.code || "native",
              assetIssuer: paymentOp.asset?.issuer || "N/A"
            })
          }
        } catch (parseError) {
          console.error("[Payment API] Could not parse transaction for logging:", parseError)
        }
        
        console.error("[Payment API] ❌ Transaction submission failed:", {
          error: submitError.message,
          response: submitError.response?.data,
          status: submitError.response?.status,
          extras: submitError.extras
        })
        
        // Extract detailed error from Horizon response
        let errorMessage = submitError.message || "Transaction submission failed"
        let userFriendlyMessage = errorMessage
        
        if (submitError.response?.data) {
          const horizonError = submitError.response.data
          const resultCodes = horizonError.extras?.result_codes
          
          // Check for specific error codes and provide user-friendly messages
          if (resultCodes) {
            const operationCodes = resultCodes.operations || []
            const transactionCode = resultCodes.transaction || ""
            
            // Check error codes in order of priority
            if (operationCodes.includes("op_underfunded")) {
              // Sender doesn't have enough USDC
              // Note: We can't check DeFindex here since wallet isn't loaded yet in this error path
              // The frontend should handle balance checks before sending
              
              userFriendlyMessage = `Insufficient balance. You don't have enough USDC in your wallet to complete this payment.${defindexInfo}`
              console.error("[Payment API] ❌ Transaction failed - Insufficient USDC balance:", {
                resultCodes,
                suggestion: "Check your USDC balance and ensure you have enough to cover the payment amount plus transaction fees."
              })
            } else if (operationCodes.includes("op_no_destination")) {
              // Destination account doesn't exist
              // Try to get the destination from the transaction for better error message
              let destinationAddress = "unknown"
              try {
                const signedTransaction = TransactionBuilder.fromXDR(body.signedTransactionXdr, networkPassphrase)
                const operations = signedTransaction.operations || []
                if (operations.length > 0) {
                  const paymentOp = operations[0] as any
                  destinationAddress = paymentOp.destination || "unknown"
                }
              } catch (e) {
                // Ignore parse errors
              }
              
              // Get the original destination from the request body for comparison
              const originalDestination = body.destination || "unknown"
              
              console.error("[Payment API] ❌ Transaction failed - Destination account doesn't exist:", {
                destinationFromTransaction: destinationAddress,
                destinationFromRequest: originalDestination,
                fullDestination: destinationAddress !== "unknown" ? destinationAddress : originalDestination,
                network: stellarConfig.network,
                horizonUrl: stellarConfig.horizonUrl,
                resultCodes,
                suggestion: "Recipient needs to fund their account with XLM first. Verify the wallet address is correct and matches the network (testnet vs mainnet)."
              })
              
              // Check if there's a mismatch between request destination and transaction destination
              if (destinationAddress !== "unknown" && originalDestination !== "unknown" && destinationAddress !== originalDestination) {
                console.error("[Payment API] ❌ DESTINATION MISMATCH DETECTED!", {
                  requestDestination: originalDestination,
                  transactionDestination: destinationAddress,
                  network: stellarConfig.network
                })
              }
              
              userFriendlyMessage = `The recipient's wallet account doesn't exist on the Stellar network yet. They need to fund their account with at least 1 XLM first before they can receive USDC payments.`
            } else if (transactionCode === "tx_failed" && operationCodes.length === 0) {
              // Generic transaction failure - try to parse the error
              userFriendlyMessage = "Transaction failed. Please check your balance and try again."
            } else if (operationCodes.includes("op_no_trust")) {
              userFriendlyMessage = "The recipient hasn't established a USDC trustline yet. They need to create a USDC trustline first."
            } else {
              errorMessage = `Transaction failed: ${JSON.stringify(resultCodes)}`
              userFriendlyMessage = errorMessage
            }
          } else if (horizonError.detail) {
            errorMessage = horizonError.detail
            userFriendlyMessage = errorMessage
          }
        }
        
        return NextResponse.json(
          {
            success: false,
            error: userFriendlyMessage,
            details: submitError.response?.data
          },
          { status: 400, headers: corsHeaders(request) }
        )
      }
    }

    // Otherwise, build unsigned transaction
    const { destination, amount, sender } = body

    // Note: destination and amount are already extracted from body above
    if (!destination || !amount) {
      return NextResponse.json(
        { error: "Destination and amount are required" },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    // Get user's wallet
    console.log("[Payment API] Getting sender wallet for userId:", userId)
    const wallet = await getStellarWallet(userId, true)
    if (!wallet) {
      console.error("[Payment API] ❌ Wallet not found for userId:", userId)
      return NextResponse.json(
        { error: "Wallet not found" },
        { status: 404, headers: corsHeaders(request) }
      )
    }

    console.log("[Payment API] ✅ Sender wallet retrieved from database:", {
      publicKey: wallet.publicKey.substring(0, 10) + "..." + wallet.publicKey.substring(wallet.publicKey.length - 10),
      fullPublicKey: wallet.publicKey, // Log full key for debugging
      network: wallet.network,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt
    })

    // If sender address is provided from frontend, use it if it's valid
    // The frontend might be using a derived keypair address from sessionStorage
    // which is the actual wallet the user is using, even if it doesn't match the database
    if (sender) {
      console.log("[Payment API] Frontend provided sender address:", sender.substring(0, 10) + "..." + sender.substring(sender.length - 10))
      
      // Validate the sender address format (Stellar addresses start with G and are 56 chars)
      const isValidStellarAddress = /^G[A-Z0-9]{55}$/.test(sender)
      if (!isValidStellarAddress) {
        console.error("[Payment API] ❌ Invalid sender address format:", sender)
        return NextResponse.json(
          { 
            error: "Invalid sender wallet address format.",
            details: "Please refresh the page and try again."
          },
          { status: 400, headers: corsHeaders(request) }
        )
      }

      if (sender !== wallet.publicKey) {
        console.warn("[Payment API] ⚠️ Frontend sender address doesn't match database wallet!")
        console.warn("[Payment API]   Frontend:", sender)
        console.warn("[Payment API]   Database:", wallet.publicKey)
        
        // Try to find the wallet by the provided address in the database first
        const { createClient } = await import("@supabase/supabase-js")
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (supabaseUrl && supabaseServiceKey) {
          const serviceClient = createClient(supabaseUrl, supabaseServiceKey)
          const { data: walletByAddress, error: addressError } = await serviceClient
            .from("stellar_wallets")
            .select("*")
            .eq("public_key", sender)
            .eq("user_id", userId)
            .maybeSingle()
          
          if (!addressError && walletByAddress) {
            console.log("[Payment API] ✅ Found wallet by frontend address in database, using it")
            wallet.publicKey = walletByAddress.public_key
            wallet.network = walletByAddress.network
            wallet.createdAt = walletByAddress.created_at
            wallet.updatedAt = walletByAddress.updated_at
          } else {
            // Frontend address is valid but not in database - this is OK for non-custodial wallets
            // The user might be using a derived keypair from sessionStorage
            // Use the frontend address directly (it's the actual wallet they're using)
            console.log("[Payment API] ⚠️ Frontend address not in database, but it's valid - using it anyway")
            console.log("[Payment API]   This is normal for non-custodial wallets using derived keypairs")
            wallet.publicKey = sender
            // Keep the network from database (or use config default)
            wallet.network = wallet.network || stellarConfig.network
          }
        } else {
          // No service client available, but sender is valid - use it
          console.log("[Payment API] Using frontend sender address (service client not available)")
          wallet.publicKey = sender
        }
      } else {
        console.log("[Payment API] ✅ Frontend sender address matches database wallet")
      }
    }

    const stellarConfig = getStellarConfig()
    
    // Verify network matches wallet network
    if (wallet.network !== stellarConfig.network) {
      console.error("[Payment API] Network mismatch:", {
        walletNetwork: wallet.network,
        configNetwork: stellarConfig.network,
        publicKey: wallet.publicKey.substring(0, 10) + "..."
      })
      return NextResponse.json(
        { 
          error: `Network mismatch. Wallet is on ${wallet.network} but config is ${stellarConfig.network}`,
          details: "Please ensure you're using the correct network."
        },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    const usdcIssuer = USDC_ISSUERS[stellarConfig.network]

    if (!usdcIssuer) {
      return NextResponse.json(
        { error: `USDC issuer not configured for network: ${stellarConfig.network}` },
        { status: 500, headers: corsHeaders(request) }
      )
    }

    // Create USDC asset
    const usdcAsset = new Asset("USDC", usdcIssuer)

    // Create Stellar server instance
    const server = new Horizon.Server(
      stellarConfig.horizonUrl,
      { allowHttp: stellarConfig.network === "testnet" }
    )

    // Load sender account with retry logic
    // Sometimes Horizon API has temporary issues, so we retry with exponential backoff
    let account: Account
    const maxRetries = 3
    const retryDelay = 2000 // 2 seconds
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Payment API] Loading account for transaction (attempt ${attempt}/${maxRetries}):`, {
          publicKey: wallet.publicKey,
          network: stellarConfig.network,
          horizonUrl: stellarConfig.horizonUrl
        })
        
        account = await server.loadAccount(wallet.publicKey)
        
        // Get detailed balance information
        const usdcBalance = account.balances.find((b: any) => 
          b.asset_code === "USDC" && 
          b.asset_issuer === USDC_ISSUERS[stellarConfig.network]
        )
        const xlmBalance = account.balances.find((b: any) => b.asset_type === "native")
        
        console.log("[Payment API] ✅ Account loaded successfully:", {
          publicKey: wallet.publicKey,
          sequence: account.sequenceNumber(),
          balances: account.balances.length,
          allBalances: account.balances.map((b: any) => ({
            asset_type: b.asset_type,
            asset_code: b.asset_code || "XLM",
            asset_issuer: b.asset_issuer || undefined,
            balance: b.balance,
          })),
          hasUSDC: !!usdcBalance,
          usdcBalance: usdcBalance ? parseFloat(usdcBalance.balance) : 0,
          usdcIssuer: usdcBalance ? usdcBalance.asset_issuer : undefined,
          xlmBalance: xlmBalance ? parseFloat(xlmBalance.balance) : 0,
          note: "This is the actual balance on the Stellar network for the account being used"
        })
        break // Success, exit retry loop
      } catch (error: any) {
        const isNotFound = error?.response?.status === 404 || 
                          error?.message?.includes("404") || 
                          error?.message?.includes("Not Found") ||
                          error?.constructor?.name === "NotFoundError"
        
        if (isNotFound) {
          if (attempt < maxRetries) {
            // Retry with exponential backoff in case of temporary Horizon API issues
            const delay = retryDelay * attempt
            console.log(`[Payment API] ⚠️ Account not found (attempt ${attempt}), retrying in ${delay}ms...`)
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          } else {
            // All retries exhausted - check if account might exist but Horizon is having issues
            console.error("[Payment API] ❌ Account not found after all retries:", {
              publicKey: wallet.publicKey,
              network: stellarConfig.network,
              horizonUrl: stellarConfig.horizonUrl,
              attempts: attempt,
              error: error.message
            })
            
            // Try one more time with a direct Horizon API call to verify
            try {
              const horizonUrl = `${stellarConfig.horizonUrl}/accounts/${wallet.publicKey}`
              console.log("[Payment API] Attempting direct Horizon API call:", horizonUrl)
              const directResponse = await fetch(horizonUrl)
              
              if (directResponse.ok) {
                // Account exists! Try loading again
                console.log("[Payment API] ✅ Direct API call confirms account exists, retrying loadAccount...")
                account = await server.loadAccount(wallet.publicKey)
                console.log("[Payment API] ✅ Account loaded after direct API verification")
                break
              }
            } catch (directError) {
              console.error("[Payment API] Direct API call also failed:", directError)
            }
            
            return NextResponse.json(
              { 
                error: "Sender account not found. Please fund your account first.",
                details: `Account ${wallet.publicKey.substring(0, 8)}... does not exist on ${stellarConfig.network} network. The account needs to be funded with at least 1 XLM to exist on the Stellar network.`,
                horizonUrl: stellarConfig.horizonUrl,
                suggestion: "Please fund your account using a Stellar wallet or exchange, then try again."
              },
              { status: 404, headers: corsHeaders(request) }
            )
          }
        }
        
        // For other errors, throw them
        console.error("[Payment API] ❌ Unexpected error loading account:", {
          error: error.message,
          status: error?.response?.status,
          data: error?.response?.data
        })
        throw error
      }
    }
    
    // Ensure account was loaded
    if (!account!) {
      return NextResponse.json(
        { 
          error: "Failed to load account after multiple attempts",
          details: "Please try again in a moment."
        },
        { status: 503, headers: corsHeaders(request) }
      )
    }

    // Validate destination address format
    const isValidDestination = /^G[A-Z0-9]{55}$/.test(destination)
    if (!isValidDestination) {
      console.error("[Payment API] ❌ Invalid destination address format:", destination)
      return NextResponse.json(
        { 
          error: "Invalid recipient wallet address format.",
          details: "Please check the recipient address and try again."
        },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    // Check if destination account exists on the network (non-blocking check)
    // We log a warning but still proceed - Horizon will give the definitive answer
    console.log("[Payment API] Verifying destination account exists on network:", {
      destination: destination.substring(0, 10) + "..." + destination.substring(destination.length - 10),
      fullDestination: destination, // Log full address for debugging
      network: stellarConfig.network,
      horizonUrl: stellarConfig.horizonUrl
    })
    
    try {
      const destAccount = await server.loadAccount(destination)
      console.log("[Payment API] ✅ Destination account exists on network:", {
        sequence: destAccount.sequenceNumber(),
        balances: destAccount.balances.length,
        hasXLM: destAccount.balances.some((b: any) => b.asset_type === "native"),
        hasUSDC: destAccount.balances.some((b: any) => b.asset_code === "USDC")
      })
    } catch (destError: any) {
      const isDestNotFound = destError?.response?.status === 404 || 
                            destError?.message?.includes("404") || 
                            destError?.message?.includes("Not Found") ||
                            destError?.constructor?.name === "NotFoundError"
      
      if (isDestNotFound) {
        console.warn("[Payment API] ⚠️ Pre-check: Destination account doesn't exist on network (non-blocking):", {
          destination: destination,
          network: stellarConfig.network,
          horizonUrl: stellarConfig.horizonUrl,
          note: "Transaction will still be built and submitted - Horizon will provide definitive answer"
        })
        // Don't fail here - let the transaction be built and submitted
        // Horizon will return the definitive error if the account doesn't exist
      } else {
        // Network error - log but don't fail (might be temporary Horizon issue)
        console.warn("[Payment API] ⚠️ Could not verify destination account (non-fatal):", destError.message)
      }
    }

    // Convert amount to Stellar format (7 decimal places as decimal string)
    // Operation.payment expects amount as a decimal string like "0.1000000", not stroops
    const amountDecimal = parseFloat(amount).toFixed(7)

    // Get USDC balance from loaded account for verification
    // Note: usdcIssuer is already defined earlier in the function (line 307)
    const accountUSDCBalance = account.balances.find((b: any) => 
      b.asset_code === "USDC" && 
      b.asset_issuer === usdcIssuer
    )
    const accountUSDCAmount = accountUSDCBalance ? parseFloat(accountUSDCBalance.balance) : 0
    
    console.log("[Payment API] Building payment transaction:", {
      source: wallet.publicKey.substring(0, 10) + "..." + wallet.publicKey.substring(wallet.publicKey.length - 10),
      fullSource: wallet.publicKey, // Log full source for debugging
      destination: destination.substring(0, 10) + "..." + destination.substring(destination.length - 10),
      fullDestination: destination, // Log full destination for debugging
      amount: amount,
      amountDecimal: amountDecimal, // Decimal format for Operation.payment
      asset: "USDC",
      assetIssuer: usdcIssuer,
      accountUSDCBalance: accountUSDCAmount, // Actual USDC balance on the account
      note: "Verifying account has sufficient balance before building transaction"
    })

    // Build payment transaction
    const networkPassphrase = stellarConfig.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET

    const transactionBuilder = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination,
          asset: usdcAsset,
          amount: amountDecimal, // Use decimal format, not stroops
        })
      )
      .setTimeout(30)

    // Add memo if provided
    if (transactionMemo && transactionMemo.trim()) {
      // Stellar memos can be text (max 28 bytes), id (uint64), hash (32 bytes), or return (32 bytes)
      // For simplicity, we'll use text memo
      transactionBuilder.addMemo(Memo.text(transactionMemo.trim().substring(0, 28)))
      console.log("[Payment API] ✅ Added memo to transaction:", transactionMemo.trim().substring(0, 28))
    }

    const transaction = transactionBuilder.build()

    // Verify transaction source matches wallet
    // Verify transaction source matches wallet address
    if (transaction.source !== wallet.publicKey) {
      console.error("[Payment API] ❌ Transaction source mismatch!", {
        transactionSource: transaction.source,
        walletPublicKey: wallet.publicKey,
        senderFromFrontend: sender,
        note: "Transaction source must match the wallet address being used"
      })
      return NextResponse.json(
        {
          error: "Transaction source mismatch. Please refresh and try again.",
          details: "The transaction source doesn't match your wallet address."
        },
        { status: 400, headers: corsHeaders(request) }
      )
    }
    
    // Verify account has sufficient balance before returning transaction
    if (accountUSDCAmount < parseFloat(amount)) {
      console.error("[Payment API] ❌ Insufficient balance in account:", {
        accountPublicKey: wallet.publicKey,
        accountUSDCBalance: accountUSDCAmount,
        requestedAmount: parseFloat(amount),
        shortfall: parseFloat(amount) - accountUSDCAmount,
        note: "Account balance check failed before building transaction"
      })
      return NextResponse.json(
        {
          error: `Insufficient balance. Account has ${accountUSDCAmount.toFixed(2)} USDC but ${parseFloat(amount).toFixed(2)} USDC is required.`,
          details: {
            accountBalance: accountUSDCAmount,
            requestedAmount: parseFloat(amount),
            accountAddress: wallet.publicKey
          }
        },
        { status: 400, headers: corsHeaders(request) }
      )
    }
    
    console.log("[Payment API] ✅ Balance verification passed:", {
      accountUSDCBalance: accountUSDCAmount,
      requestedAmount: parseFloat(amount),
      remaining: accountUSDCAmount - parseFloat(amount)
    })

    // Log the actual destination from the transaction operation
    const paymentOp = transaction.operations[0] as any
    console.log("[Payment API] ✅ Transaction built successfully:", {
      source: transaction.source.substring(0, 10) + "..." + transaction.source.substring(transaction.source.length - 10),
      fullSource: transaction.source, // Log full source for debugging
      destination: paymentOp.destination ? paymentOp.destination.substring(0, 10) + "..." + paymentOp.destination.substring(paymentOp.destination.length - 10) : "N/A",
      fullDestination: paymentOp.destination, // Log full destination from operation for debugging
      operations: transaction.operations.length,
      fee: transaction.fee,
      network: stellarConfig.network
    })
    
    // Verify the destination in the operation matches what we expect
    if (paymentOp.destination !== destination) {
      console.error("[Payment API] ❌ Destination mismatch in transaction operation!", {
        expectedDestination: destination,
        actualDestination: paymentOp.destination,
        network: stellarConfig.network
      })
      return NextResponse.json(
        { 
          error: "Transaction destination mismatch. Please refresh and try again.",
          details: "The destination in the transaction doesn't match the expected address."
        },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    const unsignedXdr = transaction.toXDR()

    return NextResponse.json(
      {
        unsignedXdr,
      },
      { headers: corsHeaders(request) }
    )
  } catch (error: any) {
    console.error("[Payment API] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to process payment" },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}
