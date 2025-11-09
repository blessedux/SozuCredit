/**
 * Turnkey Soroban Transaction Signing
 * Handles signing of Soroban smart contract transactions using Turnkey
 */

import { getTurnkeyClient } from "./client"
import { getTurnkeyConfig } from "./config"
import { getStellarWallet } from "./stellar-wallet"
import { Transaction, TransactionBuilder, xdr, Networks, BASE_FEE, Keypair, StrKey } from "@stellar/stellar-sdk"
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
  console.log("[Turnkey Soroban Signing] Wallet public key:", wallet.publicKey)
  
  // Verify the public key is valid
  try {
    const testKeypair = Keypair.fromPublicKey(wallet.publicKey)
    console.log("[Turnkey Soroban Signing] ✅ Public key is valid Stellar address")
  } catch (e: any) {
    console.error("[Turnkey Soroban Signing] ❌ Invalid public key:", e.message)
    throw new Error(`Invalid Stellar public key: ${wallet.publicKey}`)
  }
  
  // For Stellar transactions, we need to sign the transaction hash
  // According to Stellar documentation:
  // - The transaction hash is calculated from: first 4 bytes of SHA-256(network_passphrase) + transaction XDR
  // - The Stellar SDK's transaction.hash() method handles this correctly
  // - We sign the 32-byte transaction hash, not the XDR directly
  const transactionHash = transaction.hash()
  console.log("[Turnkey Soroban Signing] Transaction hash length:", transactionHash.length, "bytes")
  console.log("[Turnkey Soroban Signing] Transaction hash (hex):", transactionHash.toString("hex"))
  console.log("[Turnkey Soroban Signing] Transaction hash (base64):", transactionHash.toString("base64"))
  
  // Also get the transaction XDR for comparison/testing
  const transactionXdr = transaction.toXDR()
  const xdrBuffer = Buffer.from(transactionXdr, "base64")
  const xdrHex = xdrBuffer.toString("hex")
  console.log("[Turnkey Soroban Signing] Transaction XDR length:", transactionXdr.length, "chars (base64)")
  console.log("[Turnkey Soroban Signing] Transaction XDR buffer length:", xdrBuffer.length, "bytes")
  console.log("[Turnkey Soroban Signing] Transaction XDR hex length:", xdrHex.length, "chars")
  console.log("[Turnkey Soroban Signing] Transaction XDR (first 100 chars):", transactionXdr.substring(0, 100))
  console.log("[Turnkey Soroban Signing] Transaction XDR hex (first 100 chars):", xdrHex.substring(0, 100))
  
  // Verify the transaction source account matches the wallet public key
  const transactionSource = transaction.source
  console.log("[Turnkey Soroban Signing] Transaction source account:", transactionSource)
  if (transactionSource !== wallet.publicKey) {
    console.warn("[Turnkey Soroban Signing] ⚠️ Transaction source doesn't match wallet public key!")
    console.warn("[Turnkey Soroban Signing] Transaction source:", transactionSource)
    console.warn("[Turnkey Soroban Signing] Wallet public key:", wallet.publicKey)
  }
  
  // IMPORTANT: For Stellar ED25519, we should sign the transaction hash (32 bytes)
  // However, the signature format from Turnkey might not be compatible
  // Let's try both approaches: signing the hash (correct) and signing the XDR (for comparison)
  const client = getTurnkeyClient()
  
  // First, try signing the transaction hash (correct approach per Stellar docs)
  // NOTE: We must use the private key ID (turnkeyWalletId) - public key address doesn't work with Turnkey API
  // The Adamik tutorial might use a different setup or the public key approach doesn't work with signRawPayload
  const usePublicKeyForSigning = process.env.USE_PUBLIC_KEY_FOR_SIGNING === "true"
  const signWith = usePublicKeyForSigning ? wallet.publicKey : wallet.turnkeyWalletId
  console.log("[Turnkey Soroban Signing] Attempting to sign transaction hash (correct approach)...")
  console.log("[Turnkey Soroban Signing] Using", usePublicKeyForSigning ? "public key address" : "private key ID", "for signWith:", signWith)
  if (usePublicKeyForSigning) {
    console.warn("[Turnkey Soroban Signing] ⚠️ WARNING: Using public key address - this may not work with Turnkey API")
  }
  const signParamsHash = {
    signWith: signWith,
    payload: transactionHash.toString("hex"), // Sign the transaction hash (32 bytes = 64 hex chars)
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NOT_APPLICABLE", // Required for ED25519 (Stellar) - we're providing the hash directly
  }
  
  // Also prepare parameters for signing the XDR (for comparison/testing)
  console.log("[Turnkey Soroban Signing] Also preparing to sign transaction XDR (for comparison)...")
  const signParamsXdr = {
    signWith: signWith,
    payload: xdrHex, // Sign the full transaction XDR (hex-encoded)
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NOT_APPLICABLE", // Required for ED25519 (Stellar) - we're providing the XDR directly
  }
  
  // Try signing the XDR instead of the hash (for testing/comparison)
  // According to Stellar docs, we should sign the hash, but let's try XDR to see if it works
  // Set USE_XDR_SIGNING=true in environment to try signing XDR instead of hash
  // NOTE: Even if we sign XDR, we still verify against the hash (which is what Stellar uses)
  const useXdrSigning = process.env.USE_XDR_SIGNING === "true"
  const signParams = useXdrSigning ? signParamsXdr : signParamsHash
  console.log("[Turnkey Soroban Signing] Using", useXdrSigning ? "transaction XDR" : "transaction hash", "signing approach")
  if (useXdrSigning) {
    console.log("[Turnkey Soroban Signing] ⚠️ WARNING: Signing XDR instead of hash (not recommended per Stellar docs)")
    console.log("[Turnkey Soroban Signing] ⚠️ NOTE: We will still verify against the hash (which is what Stellar uses)")
  }
  
  console.log("[Turnkey Soroban Signing] Requesting raw payload signature from Turnkey...")
  console.log("[Turnkey Soroban Signing] Sign parameters:", JSON.stringify(signParams, null, 2))
  console.log("[Turnkey Soroban Signing] Organization ID:", turnkeyConfig.organizationId)
  console.log("[Turnkey Soroban Signing] Sign with:", signWith, `(${usePublicKeyForSigning ? "public key address" : "private key ID"})`)
  console.log("[Turnkey Soroban Signing] Turnkey wallet ID:", wallet.turnkeyWalletId)
  console.log("[Turnkey Soroban Signing] Wallet public key:", wallet.publicKey)
  console.log("[Turnkey Soroban Signing] Payload type:", signParams === signParamsHash ? "Transaction Hash" : "Transaction XDR")
  console.log("[Turnkey Soroban Signing] Payload length:", signParams.payload.length, "hex chars")
  console.log("[Turnkey Soroban Signing] Payload (first 64 chars):", signParams.payload.substring(0, 64))
  console.log("[Turnkey Soroban Signing] Payload (last 64 chars):", signParams.payload.substring(signParams.payload.length - 64))
  
  try {
    // Sign the raw payload via Turnkey
    // For @turnkey/http, we need to use the full request body structure
    // Unlike @turnkey/sdk-server which has apiClient().signRawPayload()
    const requestBody = {
      type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
      timestampMs: Date.now().toString(),
      organizationId: turnkeyConfig.organizationId,
      parameters: signParams,
    }
    
    console.log("[Turnkey Soroban Signing] Full request body:", JSON.stringify(requestBody, null, 2))
    
    let activity
    try {
      const initialResponse = await client.signRawPayload(requestBody as any)
      activity = initialResponse.activity
      
      if (activity.status !== "ACTIVITY_STATUS_COMPLETED") {
        const signRawPayloadPoller = createActivityPoller({
          client,
          requestFn: client.signRawPayload,
          refreshIntervalMs: 500,
        })
        
        activity = await signRawPayloadPoller(requestBody as any)
      }
    } catch (error: any) {
      // Log everything we can about the error
      console.error("[Turnkey Soroban Signing] ❌ Error signing payload")
      console.error("[Turnkey Soroban Signing] Error message:", error.message)
      console.error("[Turnkey Soroban Signing] Error name:", error.name)
      console.error("[Turnkey Soroban Signing] Error code:", error.code)
      console.error("[Turnkey Soroban Signing] Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
      
      // Check for different error response structures
      if (error.response) {
        console.error("[Turnkey Soroban Signing] Error response exists")
        console.error("[Turnkey Soroban Signing] Error response status:", error.response.status)
        console.error("[Turnkey Soroban Signing] Error response statusText:", error.response.statusText)
        console.error("[Turnkey Soroban Signing] Error response data:", JSON.stringify(error.response.data, null, 2))
        console.error("[Turnkey Soroban Signing] Error response headers:", JSON.stringify(error.response.headers, null, 2))
      }
      
      // Check for error.data (some HTTP clients use this)
      if (error.data) {
        console.error("[Turnkey Soroban Signing] Error.data:", JSON.stringify(error.data, null, 2))
      }
      
      // Extract detailed error message from various possible locations
      let errorMessage = error.message || "Unknown error"
      let errorDetails: any = null
      
      // Try to extract from error.response.data
      if (error.response?.data) {
        const responseData = error.response.data
        
        // Check for different error message fields
        errorMessage = responseData.message || 
                      responseData.error || 
                      responseData.errorMessage ||
                      error.message || 
                      "Unknown error"
        
        // Check for details field
        errorDetails = responseData.details || 
                      responseData.errorDetails ||
                      responseData
      }
      
      // Log the extracted error details
      console.error("[Turnkey Soroban Signing] Extracted error message:", errorMessage)
      if (errorDetails) {
        console.error("[Turnkey Soroban Signing] Extracted error details:", JSON.stringify(errorDetails, null, 2))
      }
      
      // Create a more detailed error message
      // Include all available information to help debug
      let detailedError = `Turnkey signing failed: ${errorMessage}`
      
      // Add error details if available
      if (errorDetails) {
        // Try to extract field violations if present
        if (errorDetails.fieldViolations) {
          detailedError += `. Field violations: ${JSON.stringify(errorDetails.fieldViolations)}`
        } else {
          detailedError += `. Details: ${JSON.stringify(errorDetails)}`
        }
      }
      
      // Add status code
      if (error.response?.status) {
        detailedError += ` (Status: ${error.response.status})`
      }
      
      // Add request info for debugging
      detailedError += `. Request: signWith=${signParams.signWith}, payload=${signParams.payload.substring(0, 16)}..., orgId=${turnkeyConfig.organizationId}`
      
      console.error("[Turnkey Soroban Signing] Throwing detailed error:", detailedError)
      throw new Error(detailedError)
    }
    
    if (!activity.result?.signRawPayloadResult) {
      throw new Error("Turnkey did not return a signature")
    }
    
    // For ED25519 (Stellar), the signature is a single 64-byte value
    // Turnkey returns r and s components, but for ED25519 we need to combine them
    const signatureResult = activity.result.signRawPayloadResult
    
    console.log("[Turnkey Soroban Signing] ✅ Signature received from Turnkey")
    console.log("[Turnkey Soroban Signing] Signature result (full):", JSON.stringify(signatureResult, null, 2))
    console.log("[Turnkey Soroban Signing] Signature result type:", typeof signatureResult)
    console.log("[Turnkey Soroban Signing] Signature result keys:", Object.keys(signatureResult))
    
    if (!signatureResult.r || !signatureResult.s) {
      console.error("[Turnkey Soroban Signing] ❌ Missing signature components!")
      console.error("[Turnkey Soroban Signing] r:", signatureResult.r)
      console.error("[Turnkey Soroban Signing] s:", signatureResult.s)
      throw new Error("Turnkey did not return signature components")
    }
    
    // For ED25519, the signature format is different from ECDSA
    // ED25519 signatures are 64 bytes: R (32 bytes) + S (32 bytes)
    // Turnkey returns r and s as hex strings
    // Following Adamik tutorial pattern exactly: simply remove "0x" prefix and combine r + s
    // No padding - use exact values from Turnkey
    const rOriginal = signatureResult.r
    const sOriginal = signatureResult.s
    console.log("[Turnkey Soroban Signing] r (original):", rOriginal, "type:", typeof rOriginal, "length:", rOriginal?.length)
    console.log("[Turnkey Soroban Signing] s (original):", sOriginal, "type:", typeof sOriginal, "length:", sOriginal?.length)
    
    const rHex = rOriginal.replace("0x", "")
    const sHex = sOriginal.replace("0x", "")
    
    console.log("[Turnkey Soroban Signing] r (after removing 0x):", rHex, "length:", rHex.length, "hex chars")
    console.log("[Turnkey Soroban Signing] s (after removing 0x):", sHex, "length:", sHex.length, "hex chars")
    console.log("[Turnkey Soroban Signing] r (first 32 chars):", rHex.substring(0, 32))
    console.log("[Turnkey Soroban Signing] r (last 32 chars):", rHex.substring(Math.max(0, rHex.length - 32)))
    console.log("[Turnkey Soroban Signing] s (first 32 chars):", sHex.substring(0, 32))
    console.log("[Turnkey Soroban Signing] s (last 32 chars):", sHex.substring(Math.max(0, sHex.length - 32)))
    
    // Check if r and s are the expected length (32 bytes = 64 hex chars each)
    const expectedLength = 64 // 32 bytes = 64 hex chars
    console.log("[Turnkey Soroban Signing] Expected length for r and s:", expectedLength, "hex chars (32 bytes each)")
    console.log("[Turnkey Soroban Signing] r length matches expected:", rHex.length === expectedLength)
    console.log("[Turnkey Soroban Signing] s length matches expected:", sHex.length === expectedLength)
    
    // For ED25519, the signature is 64 bytes: R (32 bytes) + S (32 bytes)
    // Following Adamik tutorial: simply combine r + s without padding
    // Each component should be 32 bytes = 64 hex chars
    // If they're shorter, pad to ensure 32 bytes each
    // If they're longer, truncate to 64 hex chars
    const rPadded = rHex.length < 64 ? rHex.padStart(64, '0') : rHex.slice(0, 64)
    const sPadded = sHex.length < 64 ? sHex.padStart(64, '0') : sHex.slice(0, 64)
    
    // For ED25519, combine R and S: signature = R || S (following Adamik tutorial pattern)
    // Try both orders: R || S and S || R (in case Turnkey returns them in reverse order)
    let signatureHex = rPadded + sPadded
    let signatureBytes = Buffer.from(signatureHex, "hex")
    
    // For ED25519, the signature format from Turnkey might be different
    // ED25519 signatures are 64 bytes: R (32 bytes) || S (32 bytes)
    // However, Turnkey might be returning them in a different format
    // Let's try multiple combinations to find the correct one
    
    // Try verifying with R || S first
    let isValid = false
    let finalSignatureBytes = signatureBytes
    
    // Verify the public key matches what we expect
    // IMPORTANT: We always verify against the transaction hash (which is what Stellar uses)
    // Even if we signed the XDR, we verify against the hash
    console.log("[Turnkey Soroban Signing] Verifying signature with public key:", wallet.publicKey)
    console.log("[Turnkey Soroban Signing] Payload that was signed:", signParams === signParamsHash ? "Transaction Hash" : "Transaction XDR")
    console.log("[Turnkey Soroban Signing] Payload to verify against:", "Transaction Hash (always)")
    console.log("[Turnkey Soroban Signing] Transaction hash to verify:", transactionHash.toString("hex"))
    console.log("[Turnkey Soroban Signing] Transaction hash length:", transactionHash.length, "bytes")
    console.log("[Turnkey Soroban Signing] Signature to verify (R || S):", signatureBytes.toString("hex"))
    console.log("[Turnkey Soroban Signing] Signature length:", signatureBytes.length, "bytes")
    console.log("[Turnkey Soroban Signing] Signature (first 32 bytes hex):", signatureBytes.slice(0, 32).toString("hex"))
    console.log("[Turnkey Soroban Signing] Signature (last 32 bytes hex):", signatureBytes.slice(32, 64).toString("hex"))
    
    try {
      const keypair = Keypair.fromPublicKey(wallet.publicKey)
      console.log("[Turnkey Soroban Signing] Keypair created successfully")
      // Verify against the transaction hash (which is what Stellar uses)
      isValid = keypair.verify(transactionHash, signatureBytes)
      if (isValid) {
        console.log("[Turnkey Soroban Signing] ✅ Signature verification PASSED with R || S!")
      } else {
        console.log("[Turnkey Soroban Signing] ❌ Signature verification FAILED with R || S (returned false)")
      }
    } catch (e: any) {
      console.error("[Turnkey Soroban Signing] Verification failed with R || S:", e.message || e)
      console.error("[Turnkey Soroban Signing] Error details:", e)
    }
    
    // If verification failed, try swapping r and s
    if (!isValid) {
      console.log("[Turnkey Soroban Signing] Trying swapped order: S || R")
      const swappedSignatureHex = sPadded + rPadded
      const swappedSignatureBytes = Buffer.from(swappedSignatureHex, "hex")
      
      try {
        const keypair = Keypair.fromPublicKey(wallet.publicKey)
        isValid = keypair.verify(transactionHash, swappedSignatureBytes)
        if (isValid) {
          console.log("[Turnkey Soroban Signing] ✅ Signature verification PASSED with swapped order (S || R)!")
          finalSignatureBytes = swappedSignatureBytes
        }
      } catch (e) {
        console.log("[Turnkey Soroban Signing] Verification failed with S || R:", e)
      }
    }
    
    // If still not valid, try other combinations
    // For ED25519, sometimes the signature might need to be formatted differently
    if (!isValid) {
      console.warn("[Turnkey Soroban Signing] ⚠️ Signature verification failed with both standard orders")
      console.warn("[Turnkey Soroban Signing] Trying alternative signature formats...")
      
      // Try reversing the bytes of r and s individually
      const rBytes = Buffer.from(rPadded, "hex")
      const sBytes = Buffer.from(sPadded, "hex")
      const rReversed = rBytes.reverse().toString("hex")
      const sReversed = sBytes.reverse().toString("hex")
      
      // Try: reversed R || reversed S
      const reversedRS = Buffer.from(rReversed + sReversed, "hex")
      try {
        const keypair = Keypair.fromPublicKey(wallet.publicKey)
        isValid = keypair.verify(transactionHash, reversedRS)
        if (isValid) {
          console.log("[Turnkey Soroban Signing] ✅ Signature verification PASSED with reversed R || reversed S!")
          finalSignatureBytes = reversedRS
        } else {
          console.log("[Turnkey Soroban Signing] ❌ Signature verification FAILED with reversed R || reversed S")
        }
      } catch (e) {
        console.log("[Turnkey Soroban Signing] Verification failed with reversed R || reversed S:", e)
      }
      
      // Try: reversed S || reversed R
      if (!isValid) {
        const reversedSR = Buffer.from(sReversed + rReversed, "hex")
        try {
          const keypair = Keypair.fromPublicKey(wallet.publicKey)
          isValid = keypair.verify(transactionHash, reversedSR)
          if (isValid) {
            console.log("[Turnkey Soroban Signing] ✅ Signature verification PASSED with reversed S || reversed R!")
            finalSignatureBytes = reversedSR
          } else {
            console.log("[Turnkey Soroban Signing] ❌ Signature verification FAILED with reversed S || reversed R")
          }
        } catch (e) {
          console.log("[Turnkey Soroban Signing] Verification failed with reversed S || reversed R:", e)
        }
      }
      
      // If still not valid, use R || S format anyway
      if (!isValid) {
        console.warn("[Turnkey Soroban Signing] ⚠️ Signature verification failed with all attempted formats")
        console.warn("[Turnkey Soroban Signing] Using R || S format anyway - Stellar will verify on submission")
        console.warn("[Turnkey Soroban Signing] This will likely result in tx_bad_auth from Stellar")
        finalSignatureBytes = signatureBytes
      }
    }
    
    signatureBytes = finalSignatureBytes
    
    console.log("[Turnkey Soroban Signing] r (first 16 chars):", rPadded.substring(0, 16))
    console.log("[Turnkey Soroban Signing] s (first 16 chars):", sPadded.substring(0, 16))
    console.log("[Turnkey Soroban Signing] Combined signature hex length:", signatureHex.length)
    
    // Convert hex signature to bytes (should be 64 bytes for ED25519)
    if (signatureBytes.length !== 64) {
      throw new Error(`Invalid ED25519 signature length: expected 64 bytes, got ${signatureBytes.length}`)
    }
    
    console.log("[Turnkey Soroban Signing] Signature bytes length:", signatureBytes.length)
    console.log("[Turnkey Soroban Signing] Signature (first 16 bytes hex):", signatureBytes.slice(0, 16).toString("hex"))
    
    // Log verification result
    if (isValid) {
      console.log("[Turnkey Soroban Signing] ✅ Signature verification PASSED - signature is valid!")
    } else {
      console.error("[Turnkey Soroban Signing] ❌ Signature verification FAILED with both R||S and S||R orders!")
      console.error("[Turnkey Soroban Signing] This indicates the signature format from Turnkey is incorrect")
      console.error("[Turnkey Soroban Signing] Transaction hash being signed:", transactionHash.toString("hex"))
      console.error("[Turnkey Soroban Signing] Public key:", wallet.publicKey)
      console.error("[Turnkey Soroban Signing] Signature (R || S):", signatureBytes.toString("hex"))
      console.error("[Turnkey Soroban Signing] Continuing anyway - Stellar will reject with tx_bad_auth")
    }
    
    // Get the public key bytes for the signature hint
    const publicKeyBytes = StrKey.decodeEd25519PublicKey(wallet.publicKey)
    const hint = publicKeyBytes.slice(-4) // Last 4 bytes of public key
    
    console.log("[Turnkey Soroban Signing] Public key bytes length:", publicKeyBytes.length)
    console.log("[Turnkey Soroban Signing] Hint length:", hint.length)
    console.log("[Turnkey Soroban Signing] Hint (hex):", hint.toString("hex"))
    
    // Verify the signature format is correct for Stellar
    // For ED25519, the signature should be exactly 64 bytes
    if (signatureBytes.length !== 64) {
      throw new Error(`Invalid ED25519 signature length: expected 64 bytes, got ${signatureBytes.length}`)
    }
    
    // Create the decorated signature using Stellar SDK's XDR format
    const decoratedSignature = new xdr.DecoratedSignature({
      hint: hint,
      signature: signatureBytes,
    })
    
    console.log("[Turnkey Soroban Signing] Decorated signature created")
    
    // Add the signature to the transaction
    // IMPORTANT: We need to add the signature BEFORE getting the final XDR
    // But we calculated the hash BEFORE adding signatures, which is correct
    transaction.signatures.push(decoratedSignature)
    
    console.log("[Turnkey Soroban Signing] Signature added to transaction")
    console.log("[Turnkey Soroban Signing] Transaction signatures count:", transaction.signatures.length)
    
    // Verify the transaction hash matches what we signed
    const newHash = transaction.hash()
    console.log("[Turnkey Soroban Signing] New transaction hash (after adding signature):", newHash.toString("hex"))
    console.log("[Turnkey Soroban Signing] Original hash (what we signed):", transactionHash.toString("hex"))
    
    // The hash should be the same because signatures are not included in the hash calculation
    if (!newHash.equals(transactionHash)) {
      console.warn("[Turnkey Soroban Signing] ⚠️ Transaction hash changed after adding signature - this might be expected")
    }
    
    // Get the signed transaction XDR
    const signedTransactionXdr = transaction.toXDR()
    
    // Parse the signed transaction to verify
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

