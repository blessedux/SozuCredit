/**
 * Key Derivation from Passkeys
 * 
 * Derives deterministic ED25519 Stellar keypairs from WebAuthn credential IDs.
 * Uses HKDF (HMAC-based Key Derivation Function) for secure, deterministic key derivation.
 * 
 * Same credential ID + user ID = same keys (deterministic)
 */

import { Keypair, StrKey } from "@stellar/stellar-sdk"
import { base64URLToBuffer } from "./utils"

/**
 * HKDF implementation using Web Crypto API
 * Based on RFC 5869: https://datatracker.ietf.org/doc/html/rfc5869
 */
async function hkdf(
  ikm: ArrayBuffer, // Input Key Material (credential ID)
  salt: ArrayBuffer | string, // Salt (context string)
  info: ArrayBuffer | string, // Application-specific info
  length: number // Output length in bytes
): Promise<ArrayBuffer> {
  // Convert salt and info to ArrayBuffer if they're strings
  const saltBuffer = typeof salt === "string" 
    ? new TextEncoder().encode(salt) 
    : salt
  const infoBuffer = typeof info === "string"
    ? new TextEncoder().encode(info)
    : info

  // Step 1: Extract (HKDF-Extract)
  // PRK = HMAC-Hash(salt, IKM)
  const extractKey = await crypto.subtle.importKey(
    "raw",
    saltBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )

  const prk = await crypto.subtle.sign("HMAC", extractKey, ikm)

  // Step 2: Expand (HKDF-Expand)
  // OKM = HKDF-Expand(PRK, info, L)
  const expandKey = await crypto.subtle.importKey(
    "raw",
    prk,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )

  const okm = new Uint8Array(length)
  const hashLength = 32 // SHA-256 output length
  const n = Math.ceil(length / hashLength)

  for (let i = 0; i < n; i++) {
    const t = new Uint8Array(
      (infoBuffer.byteLength || 0) + hashLength + 1
    )
    
    // T(0) = empty
    // T(i) = HMAC-Hash(PRK, T(i-1) | info | i)
    if (i > 0) {
      t.set(new Uint8Array(okm.slice((i - 1) * hashLength, i * hashLength)), 0)
    }
    
    if (infoBuffer.byteLength > 0) {
      t.set(new Uint8Array(infoBuffer), i === 0 ? 0 : hashLength)
    }
    
    t[t.length - 1] = i + 1

    const hmac = await crypto.subtle.sign("HMAC", expandKey, t)
    const hmacBytes = new Uint8Array(hmac)
    
    const start = i * hashLength
    const end = Math.min(start + hashLength, length)
    okm.set(hmacBytes.slice(0, end - start), start)
  }

  return okm.buffer
}

/**
 * Derive a Stellar ED25519 keypair from a passkey credential ID
 * 
 * @param credentialId - WebAuthn credential ID (base64url string)
 * @param userId - User ID (UUID string) - optional but recommended for uniqueness
 * @returns Stellar Keypair
 * 
 * @example
 * ```typescript
 * const keypair = await deriveStellarKeypair(credential.id, userId)
 * console.log("Public key:", keypair.publicKey())
 * ```
 */
export async function deriveStellarKeypair(
  credentialId: string,
  userId?: string
): Promise<Keypair> {
  if (!credentialId) {
    throw new Error("Credential ID is required for key derivation")
  }

  // Convert credential ID to ArrayBuffer
  // Credential ID is base64url encoded, convert to buffer
  const credentialIdBuffer = base64URLToBuffer(credentialId)

  // Prepare input key material
  // Combine credential ID with user ID if provided for additional uniqueness
  let ikm: ArrayBuffer
  if (userId) {
    const userIdBuffer = new TextEncoder().encode(userId)
    const combined = new Uint8Array(credentialIdBuffer.byteLength + userIdBuffer.byteLength)
    combined.set(new Uint8Array(credentialIdBuffer), 0)
    combined.set(userIdBuffer, credentialIdBuffer.byteLength)
    ikm = combined.buffer
  } else {
    ikm = credentialIdBuffer
  }

  // Derive 32-byte seed using HKDF
  // Salt: Application-specific context
  // Info: Version identifier for future key derivation changes
  const salt = "stellar-wallet-v1"
  const info = "ed25519-key-derivation"
  const seedLength = 32 // ED25519 requires 32 bytes

  console.log("[Key Derivation] Deriving key from credential ID:", {
    credentialId: credentialId.substring(0, 20) + "...",
    credentialIdLength: credentialId.length,
    userId: userId || "not provided",
    seedLength,
  })

  const seed = await hkdf(ikm, salt, info, seedLength)
  const seedBytes = new Uint8Array(seed)

  // Verify seed length
  if (seedBytes.length !== 32) {
    throw new Error(
      `Invalid seed length: expected 32 bytes, got ${seedBytes.length}`
    )
  }

  // Create Stellar keypair from seed
  // Stellar SDK's Keypair.fromRawEd25519Seed expects a 32-byte seed
  const keypair = Keypair.fromRawEd25519Seed(seedBytes)

  console.log("[Key Derivation] ✅ Keypair derived successfully:", {
    publicKey: keypair.publicKey(),
    publicKeyLength: keypair.publicKey().length,
  })

  return keypair
}

/**
 * Verify that a keypair can be re-derived from the same credential ID
 * 
 * @param credentialId - WebAuthn credential ID
 * @param userId - User ID (optional)
 * @param expectedPublicKey - Expected public key to verify against
 * @returns true if the derived public key matches the expected one
 */
export async function verifyKeyDerivation(
  credentialId: string,
  expectedPublicKey: string,
  userId?: string
): Promise<boolean> {
  try {
    const keypair = await deriveStellarKeypair(credentialId, userId)
    const derivedPublicKey = keypair.publicKey()
    
    const matches = derivedPublicKey === expectedPublicKey
    
    console.log("[Key Derivation] Verification:", {
      credentialId: credentialId.substring(0, 20) + "...",
      expectedPublicKey: expectedPublicKey.substring(0, 10) + "...",
      derivedPublicKey: derivedPublicKey.substring(0, 10) + "...",
      matches,
    })
    
    return matches
  } catch (error) {
    console.error("[Key Derivation] Verification failed:", error)
    return false
  }
}

/**
 * Derive a keypair and return both public and private key information
 * 
 * @param credentialId - WebAuthn credential ID
 * @param userId - User ID (optional)
 * @returns Object containing public key and raw seed (for storage)
 */
export async function deriveKeypairWithSeed(
  credentialId: string,
  userId?: string
): Promise<{
  keypair: Keypair
  publicKey: string
  seed: Uint8Array // Raw seed bytes (32 bytes) - can be used to recreate keypair
}> {
  const keypair = await deriveStellarKeypair(credentialId, userId)
  
  // Get the raw seed back from the keypair
  // Note: Stellar SDK doesn't expose the seed directly, so we need to derive it again
  const credentialIdBuffer = base64URLToBuffer(credentialId)
  let ikm: ArrayBuffer
  if (userId) {
    const userIdBuffer = new TextEncoder().encode(userId)
    const combined = new Uint8Array(credentialIdBuffer.byteLength + userIdBuffer.byteLength)
    combined.set(new Uint8Array(credentialIdBuffer), 0)
    combined.set(userIdBuffer, credentialIdBuffer.byteLength)
    ikm = combined.buffer
  } else {
    ikm = credentialIdBuffer
  }
  
  const salt = "stellar-wallet-v1"
  const info = "ed25519-key-derivation"
  const seed = await hkdf(ikm, salt, info, 32)
  const seedBytes = new Uint8Array(seed)

  return {
    keypair,
    publicKey: keypair.publicKey(),
    seed: seedBytes,
  }
}
