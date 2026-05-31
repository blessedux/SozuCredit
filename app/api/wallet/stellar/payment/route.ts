import { NextRequest, NextResponse } from "next/server"
import { Horizon, TransactionBuilder, Networks, Transaction, FeeBumpTransaction } from "@stellar/stellar-sdk"
import { getStellarConfig } from "@/lib/turnkey/config"
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet"
import { paymentRailForAddress } from "@/lib/payment/payment-rail"
import { isValidStellarReceiveAddress } from "@/lib/payment/stellar-address"
import {
  buildOzSmartUsdcTransferEnvelope,
  buildSorobanUsdcTransferXdr,
  submitSignedSorobanEnvelope,
} from "@/lib/stellar/soroban-usdc-transfer"

// Helper function to get transaction source (handles both Transaction and FeeBumpTransaction)
function getTransactionSource(tx: Transaction | FeeBumpTransaction): string {
  if ('source' in tx) {
    return tx.source
  }
  // For FeeBumpTransaction, get source from inner transaction
  return (tx as any).innerTransaction?.source || ""
}

const corsHeaders = (request: NextRequest) => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
})

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders(request) })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userId = request.headers.get("x-user-id")
    const { destination, amount, sender, signer: signerFromBody, memo } = body

    if (!userId) {
      return NextResponse.json(
        { error: "User ID required" },
        { status: 401, headers: corsHeaders(request) }
      )
    }

    // Extract memo if provided (for transaction building)
    const transactionMemo = memo || null

    if (body.signedEnvelopeXdr && typeof body.signedEnvelopeXdr === "string") {
      try {
        const hash = await submitSignedSorobanEnvelope(body.signedEnvelopeXdr.trim())
        return NextResponse.json(
          { success: true, transactionHash: hash, confirmed: true },
          { headers: corsHeaders(request) }
        )
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return NextResponse.json({ success: false, error: msg }, { status: 400, headers: corsHeaders(request) })
      }
    }

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
            source: getTransactionSource(signedTransaction),
            destination: paymentOp.destination,
            amount: paymentOp.amount,
            asset: paymentOp.asset?.code || "native",
            assetIssuer: paymentOp.asset?.issuer || "N/A"
          })
        }
        
        const response = await server.submitTransaction(signedTransaction)
        console.log("[Payment API] ✅ Transaction submitted to network:", response.hash)

        // Wait for transaction to be confirmed in a ledger
        // Stellar transactions are typically included within 5 seconds
        console.log("[Payment API] Waiting for transaction confirmation...")
        let confirmed = false
        let attempts = 0
        const maxAttempts = 10 // Wait up to 10 seconds (1 second per attempt)

        while (!confirmed && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000)) // Wait 1 second
          
          try {
            const txResponse = await server.transactions().transaction(response.hash).call()
            if (txResponse && txResponse.successful !== undefined) {
              confirmed = true
              console.log("[Payment API] ✅ Transaction confirmed in ledger:", {
                hash: response.hash,
                successful: txResponse.successful,
                ledger: txResponse.ledger
              })
              
              if (!txResponse.successful) {
                console.error("[Payment API] ❌ Transaction failed on network")
                return NextResponse.json(
                  {
                    success: false,
                    error: "Transaction failed on network",
                    transactionHash: response.hash,
                  },
                  { status: 400, headers: corsHeaders(request) }
                )
              }
              break
            }
          } catch (checkError: any) {
            // Transaction might not be in ledger yet, continue waiting
            if (checkError.response?.status === 404) {
              console.log("[Payment API] Transaction not yet in ledger, waiting... (attempt", attempts + 1, "of", maxAttempts + ")")
            } else {
              console.warn("[Payment API] Error checking transaction status:", checkError.message)
            }
          }
          
          attempts++
        }

        if (!confirmed) {
          console.warn("[Payment API] ⚠️ Transaction not confirmed after", maxAttempts, "attempts, but submission was successful")
          // Still return success since submission was successful - transaction might be pending
        }

        return NextResponse.json(
          {
            success: true,
            transactionHash: response.hash,
            confirmed: confirmed,
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
              source: getTransactionSource(signedTransaction),
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
          
          // Special handling for tx_bad_seq - transaction might have already succeeded
          if (resultCodes?.transaction === "tx_bad_seq") {
            console.log("[Payment API] ⚠️ Got tx_bad_seq error - checking if transaction actually succeeded...")
            
            try {
              // Try to extract transaction hash from error response
              const txHash = horizonError.extras?.result_xdr || submitError.extras?.resultXdr
              
              // If we have a hash, verify the transaction succeeded
              if (txHash) {
                try {
                  const txResponse = await server.transactions().transaction(txHash).call()
                  if (txResponse && txResponse.successful) {
                    console.log("[Payment API] ✅ Transaction actually succeeded despite tx_bad_seq error:", txHash)
                    return NextResponse.json(
                      {
                        success: true,
                        transactionHash: txHash,
                        note: "Transaction succeeded (sequence number was already used)"
                      },
                      { headers: corsHeaders(request) }
                    )
                  }
                } catch (txCheckError) {
                  console.log("[Payment API] Could not verify transaction hash:", txCheckError)
                }
              }
              
              // Also check by parsing the signed transaction and looking for it in recent transactions
              try {
                const signedTx = TransactionBuilder.fromXDR(body.signedTransactionXdr, networkPassphrase)
                const operations = signedTx.operations || []
                if (operations.length > 0) {
                  const paymentOp = operations[0] as any
                  const destination = paymentOp.destination
                  const amount = paymentOp.amount
                  
                  // Check recent payments to this destination
                  const payments = await server.payments().forAccount(getTransactionSource(signedTx))
                    .order("desc")
                    .limit(5)
                    .call()
                  
                  // Look for a matching payment in the last few transactions
                  for (const payment of payments.records) {
                    const paymentRecord = payment as any
                    if (paymentRecord.to === destination && 
                        paymentRecord.asset_code === "USDC" &&
                        Math.abs(parseFloat(paymentRecord.amount) - parseFloat(amount)) < 0.0000001) {
                      // Found matching transaction - it succeeded!
                      console.log("[Payment API] ✅ Found matching successful transaction:", paymentRecord.transaction_hash)
                      return NextResponse.json(
                        {
                          success: true,
                          transactionHash: paymentRecord.transaction_hash,
                          note: "Transaction succeeded (found in recent payments)"
                        },
                        { headers: corsHeaders(request) }
                      )
                    }
                  }
                }
              } catch (checkError) {
                console.log("[Payment API] Could not check recent transactions:", checkError)
              }
            } catch (verifyError) {
              console.log("[Payment API] Error verifying tx_bad_seq transaction:", verifyError)
            }
            
            // If we couldn't verify success, return a user-friendly error
            userFriendlyMessage = "Transaction sequence number mismatch. The transaction may have already been submitted. Please check your transaction history."
            console.warn("[Payment API] ⚠️ tx_bad_seq error - could not verify if transaction succeeded")
          }
          
          // Check for specific error codes and provide user-friendly messages
          if (resultCodes) {
            const operationCodes = resultCodes.operations || []
            const transactionCode = resultCodes.transaction || ""
            
            // Skip tx_bad_seq here since we already handled it above
            if (transactionCode === "tx_bad_seq") {
              // Already handled above, continue to return the error
            } else if (operationCodes.includes("op_underfunded")) {
              // Sender doesn't have enough USDC
              // Note: We can't check DeFindex here since wallet isn't loaded yet in this error path
              // The frontend should handle balance checks before sending
              
              userFriendlyMessage = `Insufficient balance. You don't have enough USDC in your wallet to complete this payment.`
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
    // Note: destination, amount, sender, and memo are already extracted from body above (line 25)
    if (!destination || !amount) {
      return NextResponse.json(
        { error: "Destination and amount are required" },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    // Get user's wallet — primary lookup by userId, fallback to sender public key
    console.log("[Payment API] Getting sender wallet for userId:", userId)
    let wallet = await getStellarWallet(userId, true)

    if (!wallet) {
      console.warn("[Payment API] ⚠️ Wallet not found by userId — trying fallback by sender public key")

      // Fallback: if the client sent a valid sender public key, look it up directly
      const senderFromBody = typeof body?.sender === "string" ? body.sender.trim().toUpperCase() : null
      const isValidSender = senderFromBody && /^[GC][A-Z0-9]{55}$/.test(senderFromBody)

      if (isValidSender) {
        // Try to find any wallet with this public key in the DB
        const { createClient: createSvcClient } = await import("@supabase/supabase-js")
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (supabaseUrl && supabaseServiceKey) {
          const svc = createSvcClient(supabaseUrl, supabaseServiceKey)
          const { data: walletByKey } = await svc
            .from("stellar_wallets")
            .select("*")
            .eq("public_key", senderFromBody)
            .maybeSingle()

          if (walletByKey) {
            console.log("[Payment API] ✅ Found wallet by public key fallback:", senderFromBody.substring(0, 10) + "...")
            wallet = {
              id: walletByKey.id,
              userId: walletByKey.user_id,
              turnkeyWalletId: walletByKey.turnkey_wallet_id ?? null,
              publicKey: walletByKey.public_key,
              network: walletByKey.network,
              createdAt: walletByKey.created_at,
              updatedAt: walletByKey.updated_at,
              previousUsdcBalance: walletByKey.previous_usdc_balance ?? null,
            }
          } else {
            // Key not in DB — construct a synthetic wallet object from the sender address
            // The Stellar account load will validate it actually exists on-chain
            console.warn("[Payment API] ⚠️ Public key not in DB, using sender address directly (will validate on-chain)")
            const { getStellarConfig: getConfig } = await import("@/lib/turnkey/config")
            const cfg = getConfig()
            wallet = {
              id: "synthetic",
              userId,
              turnkeyWalletId: null,
              publicKey: senderFromBody,
              network: cfg.network,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              previousUsdcBalance: null,
            }
          }
        }
      }

      if (!wallet) {
        console.error("[Payment API] ❌ Cannot identify sender wallet for userId:", userId, "sender:", senderFromBody)
        return NextResponse.json(
          {
            error: "Wallet not found. Your session may be stale — please log out and log back in.",
            code: "WALLET_NOT_FOUND",
          },
          { status: 404, headers: corsHeaders(request) }
        )
      }
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
    const senderNorm = typeof sender === "string" ? sender.trim().toUpperCase() : ""

    if (senderNorm) {
      console.log("[Payment API] Frontend provided sender address:", senderNorm.substring(0, 10) + "..." + senderNorm.substring(senderNorm.length - 10))
      
      const isValidStellarAddress = /^[GC][A-Z0-9]{55}$/.test(senderNorm)
      if (!isValidStellarAddress) {
        console.error("[Payment API] ❌ Invalid sender address format:", senderNorm)
        return NextResponse.json(
          { 
            error: "Invalid sender wallet address format.",
            details: "Please refresh the page and try again."
          },
          { status: 400, headers: corsHeaders(request) }
        )
      }

      if (!senderNorm.startsWith("C")) {
        return NextResponse.json(
          {
            error:
              "Send from your passkey smart account (C…). Sign out, sign in again, and complete wallet setup.",
            code: "WALLET_MUST_BE_SMART_ACCOUNT",
          },
          { status: 422, headers: corsHeaders(request) }
        )
      }

      if (senderNorm !== wallet.publicKey) {
        console.warn("[Payment API] ⚠️ Frontend sender address doesn't match database wallet!")
        console.warn("[Payment API]   Frontend:", senderNorm)
        console.warn("[Payment API]   Database:", wallet.publicKey)
        
        const { createClient } = await import("@supabase/supabase-js")
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (supabaseUrl && supabaseServiceKey) {
          const serviceClient = createClient(supabaseUrl, supabaseServiceKey)
          const { data: walletByUser } = await serviceClient
            .from("stellar_wallets")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle()

          const { data: walletByAddress, error: addressError } = await serviceClient
            .from("stellar_wallets")
            .select("*")
            .eq("public_key", senderNorm)
            .eq("user_id", userId)
            .maybeSingle()
          
          const row = !addressError && walletByAddress ? walletByAddress : walletByUser
          if (row) {
            console.log("[Payment API] ✅ Using canonical C from client; signer from DB row")
            wallet.publicKey = senderNorm
            wallet.network = row.network
            wallet.createdAt = row.created_at
            wallet.updatedAt = row.updated_at
            if (typeof row.signer_public_key === "string") {
              wallet.signerPublicKey = row.signer_public_key.trim().toUpperCase()
            }
            if (typeof row.wallet_type === "string") {
              wallet.walletType = row.wallet_type as "oz" | "factory" | "legacy"
            }
            if (typeof row.oz_credential_id === "string") {
              wallet.ozCredentialId = row.oz_credential_id.trim()
            }
          } else {
            console.log("[Payment API] Using frontend C (DB row not found yet)")
            wallet.publicKey = senderNorm
            const tempStellarConfig = getStellarConfig()
            wallet.network = wallet.network || tempStellarConfig.network
          }
        } else {
          console.log("[Payment API] Using frontend sender C (service client not available)")
          wallet.publicKey = senderNorm
        }
      } else {
        console.log("[Payment API] ✅ Frontend sender address matches database wallet")
        wallet.publicKey = senderNorm
      }
    } else if (wallet.publicKey.startsWith("G")) {
      return NextResponse.json(
        {
          error:
            "Your wallet is still a classic G account in our records. Sign out and sign in with passkey to migrate to a smart account (C…).",
          code: "WALLET_MUST_BE_SMART_ACCOUNT",
        },
        { status: 422, headers: corsHeaders(request) }
      )
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

    const destinationNorm =
      typeof destination === "string" ? destination.trim().toUpperCase() : ""
    if (!isValidStellarReceiveAddress(destinationNorm)) {
      return NextResponse.json(
        {
          error: "Invalid recipient wallet address format.",
          details: "Please check the recipient address and try again.",
        },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    const destinationRail = paymentRailForAddress(destinationNorm)
    if (!destinationRail) {
      return NextResponse.json(
        { error: "Invalid recipient wallet address format." },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    const senderPk = wallet.publicKey.trim().toUpperCase()
    let signerPk = wallet.signerPublicKey?.trim().toUpperCase() || null
    const bodySigner =
      typeof signerFromBody === "string" ? signerFromBody.trim().toUpperCase() : ""
    if (!signerPk && bodySigner.startsWith("G") && bodySigner.length === 56) {
      signerPk = bodySigner
    }
    if (!signerPk && senderPk.startsWith("G")) {
      signerPk = senderPk
    }
    if (senderPk.startsWith("C") && !signerPk) {
      const { createClient: createSvc } = await import("@supabase/supabase-js")
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (supabaseUrl && supabaseServiceKey) {
        const svc = createSvc(supabaseUrl, supabaseServiceKey)
        const { data: row } = await svc
          .from("stellar_wallets")
          .select("signer_public_key")
          .eq("user_id", userId)
          .maybeSingle()
        if (typeof row?.signer_public_key === "string") {
          signerPk = row.signer_public_key.trim().toUpperCase()
        }
      }
    }

    const walletType =
      wallet.walletType ??
      (senderPk.startsWith("C") && !signerPk ? "oz" : senderPk.startsWith("C") ? "factory" : "legacy")

    const amountNum = parseFloat(amount)
    const feeBuffer = 0.01

    if (!senderPk.startsWith("C")) {
      return NextResponse.json(
        {
          error:
            "Your wallet must be a passkey smart account (C…). Close the app, sign in again, and complete wallet setup when prompted.",
          code: "WALLET_MUST_BE_SMART_ACCOUNT",
        },
        { status: 422, headers: corsHeaders(request) }
      )
    }

    const { getUsdcBalanceBreakdown } = await import("@/lib/stellar/usdc-balance")
    const balanceBreakdown = await getUsdcBalanceBreakdown({
      walletAddress: senderPk,
      signerPublicKey: signerPk,
      network: stellarConfig.network,
    })

    if (balanceBreakdown.spendable < amountNum + feeBuffer) {
      const asset = balanceBreakdown.spendableAssetLabel
      let error = `Insufficient balance. You need ${(amountNum + feeBuffer).toFixed(2)} ${asset} but have ${balanceBreakdown.spendable.toFixed(2)} ${asset} on your smart wallet.`
      if (stellarConfig.network === "testnet" && balanceBreakdown.classicOnSigner > 0) {
        error += ` You have ${balanceBreakdown.classicOnSigner.toFixed(2)} Circle testnet USDC on a classic G account — that balance is separate. Move or mint BlendUSDC on your C address via testnet.blend.capital.`
      }
      return NextResponse.json({ error }, { status: 400, headers: corsHeaders(request) })
    }

    if (!signerPk || !signerPk.startsWith("G")) {
      return NextResponse.json(
        {
          error:
            "Smart wallet signer (G…) missing in our records. Sign out, sign in with passkey again, and retry — we need your classic signer to pay Soroban fees while your C account holds USDC.",
          code: "SMART_SIGNER_REQUIRED",
        },
        { status: 422, headers: corsHeaders(request) }
      )
    }

    if (walletType === "oz") {
      const prepared = await buildOzSmartUsdcTransferEnvelope({
        fromContractId: senderPk,
        toAddress: destinationNorm,
        amount: String(amount),
        signerPublicKey: signerPk,
        network: stellarConfig.network,
      })
      return NextResponse.json(
        {
          unsignedXdr: prepared.unsignedXdr,
          paymentRail: "smart",
          signMethod: "oz_passkey",
          signerPublicKey: signerPk,
          walletAddress: senderPk,
          ozCredentialId: wallet.ozCredentialId ?? null,
        },
        { headers: corsHeaders(request) }
      )
    }

    const { unsignedXdr } = await buildSorobanUsdcTransferXdr({
      signerPublicKey: signerPk,
      fromAddress: senderPk,
      toAddress: destinationNorm,
      amount: String(amount),
      network: stellarConfig.network,
    })

    return NextResponse.json(
      {
        unsignedXdr,
        paymentRail: "smart",
        signMethod: "factory_ed25519",
        signerPublicKey: signerPk,
        walletAddress: senderPk,
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
