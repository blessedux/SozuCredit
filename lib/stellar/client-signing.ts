/**
 * Client-Side Transaction Signing
 * 
 * Signs Stellar transactions using keys stored in the browser (non-custodial).
 * Uses keys derived from passkeys and stored encrypted in IndexedDB.
 */

"use client"

import { Transaction, TransactionBuilder, Keypair } from "@stellar/stellar-sdk"
import { retrieveKeypair, getKeypairByPublicKey } from "../storage/browser-keys"

export interface SignedTransaction {
  transaction: Transaction
  signature: string
  transactionXdr: string
}

/**
 * Sign a Stellar transaction using browser-stored keys
 * 
 * @param transaction - Unsigned Stellar transaction
 * @param credentialId - WebAuthn credential ID (optional, will try to find by public key if not provided)
 * @param publicKey - Stellar public key (optional, will extract from transaction if not provided)
 * @returns Signed transaction
 * 
 * @example
 * ```typescript
 * const signedTx = await signTransactionClientSide(transaction, credentialId)
 * ```
 */
export async function signTransactionClientSide(
  transaction: Transaction,
  credentialId?: string,
  publicKey?: string,
  userId?: string
): Promise<SignedTransaction> {
  console.log("[Client Signing] Starting client-side transaction signing")

  // Get public key from transaction if not provided
  const txPublicKey = publicKey || transaction.source
  console.log("[Client Signing] Transaction source (public key):", txPublicKey)

  // Retrieve keypair from browser storage
  let keypair: Keypair | null = null

  if (credentialId) {
    // Try to get keypair by credential ID (most direct)
    // Pass userId if available for verification
    console.log("[Client Signing] Retrieving keypair by credential ID:", credentialId.substring(0, 20) + "...")
    keypair = await retrieveKeypair(credentialId, userId)
  }

  if (!keypair) {
    // Fallback: try to get keypair by public key
    console.log("[Client Signing] Keypair not found by credential ID, trying public key lookup:", txPublicKey.substring(0, 10) + "...")
    keypair = await getKeypairByPublicKey(txPublicKey)
  }

  if (!keypair) {
    throw new Error(
      `Keypair not found in browser storage. Credential ID: ${credentialId ? credentialId.substring(0, 20) + "..." : "not provided"}, Public Key: ${txPublicKey.substring(0, 10)}..., User ID: ${userId || "not provided"}`
    )
  }

  // Verify the keypair's public key matches the transaction source
  const keypairPublicKey = keypair.publicKey()
  if (keypairPublicKey !== txPublicKey) {
    throw new Error(
      `Keypair public key mismatch. Expected: ${txPublicKey.substring(0, 10)}..., Got: ${keypairPublicKey.substring(0, 10)}...`
    )
  }

  console.log("[Client Signing] ✅ Keypair retrieved and verified")

  // Sign the transaction using Stellar SDK
  // The Stellar SDK handles all the complexity of signing (hash calculation, signature format, etc.)
  console.log("[Client Signing] Signing transaction...")
  transaction.sign(keypair)

  // Verify signature was added
  if (transaction.signatures.length === 0) {
    throw new Error("Transaction signing failed - no signatures added")
  }

  console.log("[Client Signing] ✅ Transaction signed successfully")
  console.log("[Client Signing] Signature count:", transaction.signatures.length)

  // Get signed transaction XDR
  const signedTransactionXdr = transaction.toXDR()

  // Verify the transaction can be parsed back
  const networkPassphrase = transaction.networkPassphrase
  const parsedTransaction = TransactionBuilder.fromXDR(signedTransactionXdr, networkPassphrase)

  console.log("[Client Signing] ✅ Signed transaction verified")

  return {
    transaction: parsedTransaction,
    signature: signedTransactionXdr,
    transactionXdr: signedTransactionXdr,
  }
}

/**
 * Sign a Soroban transaction using browser-stored keys
 * 
 * @param transaction - Unsigned Soroban transaction
 * @param credentialId - WebAuthn credential ID (optional)
 * @param publicKey - Stellar public key (optional)
 * @param userId - User ID (optional, used for key verification)
 * @returns Signed transaction
 */
export async function signSorobanTransactionClientSide(
  transaction: Transaction,
  credentialId?: string,
  publicKey?: string,
  userId?: string
): Promise<SignedTransaction> {
  // Soroban transactions are just Stellar transactions with Soroban operations
  // So we can use the same signing function
  return signTransactionClientSide(transaction, credentialId, publicKey, userId)
}

/**
 * Check if a keypair exists for a given credential ID or public key
 * 
 * @param credentialId - WebAuthn credential ID (optional)
 * @param publicKey - Stellar public key (optional)
 * @returns true if keypair exists, false otherwise
 */
export async function hasKeypair(
  credentialId?: string,
  publicKey?: string
): Promise<boolean> {
  if (credentialId) {
    const keypair = await retrieveKeypair(credentialId)
    return keypair !== null
  }

  if (publicKey) {
    const keypair = await getKeypairByPublicKey(publicKey)
    return keypair !== null
  }

  return false
}

/**
 * Get public key for a given credential ID
 * 
 * @param credentialId - WebAuthn credential ID
 * @returns Public key if found, null otherwise
 */
export async function getPublicKey(credentialId: string): Promise<string | null> {
  const keypair = await retrieveKeypair(credentialId)
  return keypair ? keypair.publicKey() : null
}
