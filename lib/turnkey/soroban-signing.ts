/**
 * Turnkey Soroban Transaction Signing
 * Handles signing of Soroban smart contract transactions using Turnkey
 */

import { getTurnkeyClient } from "./client"
import { getTurnkeyConfig } from "./config"
import { getStellarWallet } from "./stellar-wallet"
import { Transaction, TransactionBuilder, xdr, Networks, BASE_FEE } from "@stellar/stellar-sdk"
import { getSorobanRpc as getSorobanRpcFromVault } from "../defindex/vault"
import * as rpc from "@stellar/stellar-sdk/rpc"
import { Api } from "@stellar/stellar-sdk/rpc"
import { createActivityPoller } from "@turnkey/http"

export interface SignedTransaction {
  transaction: Transaction
  signature: string
  transactionXdr: string
}

/**
 * Sign a Soroban transaction using Turnkey
 */
export async function signSorobanTransaction(
  userId: string,
  transaction: Transaction
): Promise<SignedTransaction> {
  console.log("[Turnkey Soroban Signing] Starting transaction signing for user:", userId)
  
  const turnkeyConfig = getTurnkeyConfig()
  if (!turnkeyConfig) {
    throw new Error("Turnkey configuration not found")
  }
  
  // Get user's Stellar wallet (which contains the Turnkey wallet ID)
  const wallet = await getStellarWallet(userId, true)
  if (!wallet || !wallet.turnkeyWalletId) {
    throw new Error("Stellar wallet not found or missing Turnkey wallet ID")
  }
  
  console.log("[Turnkey Soroban Signing] Using Turnkey wallet ID:", wallet.turnkeyWalletId)
  
  // Convert transaction to XDR for signing
  const transactionXdr = transaction.toXDR()
  console.log("[Turnkey Soroban Signing] Transaction XDR length:", transactionXdr.length)
  
  // Convert transaction XDR to bytes (Buffer)
  const transactionBytes = Buffer.from(transactionXdr, "base64")
  
  // Prepare Turnkey signing request
  const client = getTurnkeyClient()
  const requestBody = {
    type: "ACTIVITY_TYPE_SIGN_TRANSACTION",
    timestampMs: Date.now().toString(),
    organizationId: turnkeyConfig.organizationId,
    parameters: {
      signWith: wallet.turnkeyWalletId,
      unsignedTransaction: transactionBytes.toString("base64"),
      // For Soroban transactions, we need to specify the signing scheme
      // Stellar uses ED25519
    },
  }
  
  console.log("[Turnkey Soroban Signing] Requesting transaction signature from Turnkey...")
  
  try {
    // Sign the transaction via Turnkey
    let activity
    try {
      const initialResponse = await client.signTransaction({
        body: requestBody,
      } as any)
      
      activity = initialResponse.activity
      
      // Poll for completion if needed
      if (activity.status !== "ACTIVITY_STATUS_COMPLETED") {
        const signTransactionPoller = createActivityPoller({
          client,
          requestFn: client.signTransaction,
          refreshIntervalMs: 500,
        })
        
        activity = await signTransactionPoller({
          body: requestBody,
        } as any)
      }
    } catch (error: any) {
      console.error("[Turnkey Soroban Signing] Error with body wrapper:", error.message)
      
      // Try without body wrapper
      const initialResponse = await client.signTransaction(requestBody as any)
      activity = initialResponse.activity
      
      if (activity.status !== "ACTIVITY_STATUS_COMPLETED") {
        const signTransactionPoller = createActivityPoller({
          client,
          requestFn: client.signTransaction,
          refreshIntervalMs: 500,
        })
        
        activity = await signTransactionPoller(requestBody as any)
      }
    }
    
    if (!activity.result?.signTransactionResult?.signedTransaction) {
      throw new Error("Turnkey did not return a signed transaction")
    }
    
    // Get the signed transaction XDR
    const signedTransactionXdr = activity.result.signTransactionResult.signedTransaction
    
    // Parse the signed transaction
    const signedTransaction = TransactionBuilder.fromXDR(
      signedTransactionXdr,
      transaction.networkPassphrase
    )
    
    console.log("[Turnkey Soroban Signing] ✅ Transaction signed successfully")
    
    return {
      transaction: signedTransaction,
      signature: signedTransactionXdr,
      transactionXdr: signedTransactionXdr,
    }
  } catch (error) {
    console.error("[Turnkey Soroban Signing] Error signing transaction:", error)
    throw error
  }
}

/**
 * Submit a signed Soroban transaction to the network
 */
export async function submitSorobanTransaction(
  signedTransaction: SignedTransaction,
  network: "testnet" | "mainnet" = "testnet"
): Promise<{ success: boolean; transactionHash: string; status: string }> {
  try {
    console.log("[Soroban Submit] Submitting transaction to Soroban RPC...")
    
    const sorobanRpc = getSorobanRpc()
    
    // Send the transaction
    const sendTransactionResponse = await sorobanRpc.sendTransaction(signedTransaction.transaction)
    
    if (sendTransactionResponse.status === "ERROR") {
      throw new Error(`Transaction submission failed: ${sendTransactionResponse.errorResult}`)
    }
    
    const transactionHash = sendTransactionResponse.hash
    console.log("[Soroban Submit] ✅ Transaction submitted successfully")
    console.log("[Soroban Submit] Transaction hash:", transactionHash)
    
    // Wait for transaction to be included in a ledger
    console.log("[Soroban Submit] Waiting for transaction confirmation...")
    
    let status = "PENDING"
    let attempts = 0
    const maxAttempts = 30 // Wait up to 30 seconds (1 second per attempt)
    
    while (status === "PENDING" && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000)) // Wait 1 second
      
      try {
        const transactionStatus = await sorobanRpc.getTransactionStatus(transactionHash)
        
        if (transactionStatus.status === "SUCCESS") {
          status = "SUCCESS"
          console.log("[Soroban Submit] ✅ Transaction confirmed successfully")
        } else if (transactionStatus.status === "ERROR") {
          status = "ERROR"
          console.error("[Soroban Submit] ❌ Transaction failed:", transactionStatus.errorResultXdr)
        } else {
          status = "PENDING"
        }
      } catch (error) {
        // Transaction might not be in ledger yet, continue waiting
        console.log("[Soroban Submit] Transaction not yet in ledger, waiting...")
      }
      
      attempts++
    }
    
    if (status === "PENDING") {
      console.warn("[Soroban Submit] ⚠️ Transaction still pending after max attempts")
    }
    
    return {
      success: status === "SUCCESS",
      transactionHash,
      status,
    }
  } catch (error) {
    console.error("[Soroban Submit] Error submitting transaction:", error)
    throw error
  }
}

/**
 * Helper function to get Soroban RPC client
 */
function getSorobanRpc(): rpc.Server {
  return getSorobanRpcFromVault()
}

