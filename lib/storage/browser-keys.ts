/**
 * Browser Key Storage
 * 
 * Stores encrypted Stellar private keys in the browser using IndexedDB and Web Crypto API.
 * Keys are encrypted using AES-GCM and stored locally. Private keys never leave the browser.
 */

import { Keypair } from "@stellar/stellar-sdk"
import { get, set, remove, getByIndex, getAllByIndex, STORES } from "./indexeddb"
import { deriveKeypairWithSeed, deriveStellarKeypair } from "../webauthn/key-derivation"

/**
 * Encrypted key data structure stored in IndexedDB
 */
export interface EncryptedKeyData {
  credentialId: string // WebAuthn credential ID (used as key)
  userId: string // User ID
  encryptedSeed: string // Encrypted seed (base64)
  publicKey: string // Stellar public key (stored in plaintext for quick lookup)
  iv: string // Initialization vector (base64)
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
}

/**
 * Generate a key for encryption/decryption from a passphrase
 * Uses PBKDF2 to derive a key from the credential ID
 */
async function deriveEncryptionKey(
  credentialId: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const credentialIdBuffer = new TextEncoder().encode(credentialId)

  // Import credential ID as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    credentialIdBuffer,
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  )

  // Derive encryption key using PBKDF2
  const encryptionKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000, // High iteration count for security
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )

  return encryptionKey
}

/**
 * Encrypt seed bytes using AES-GCM
 */
async function encryptSeed(
  seed: Uint8Array,
  credentialId: string
): Promise<{ encrypted: string; iv: string }> {
  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12)) // 12 bytes for AES-GCM

  // Derive encryption key
  const encryptionKey = await deriveEncryptionKey(credentialId, salt)

  // Encrypt the seed
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
      tagLength: 128, // 128-bit authentication tag
    },
    encryptionKey,
    seed.buffer as ArrayBuffer
  )

  // Combine salt and encrypted data for storage
  const combined = new Uint8Array(salt.length + encrypted.byteLength)
  combined.set(salt, 0)
  combined.set(new Uint8Array(encrypted), salt.length)

  return {
    encrypted: btoa(String.fromCharCode(...combined)), // Base64 encode
    iv: btoa(String.fromCharCode(...iv)), // Base64 encode IV separately
  }
}

/**
 * Decrypt seed bytes using AES-GCM
 */
async function decryptSeed(
  encryptedData: string,
  iv: string,
  credentialId: string
): Promise<Uint8Array> {
  // Decode base64
  const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0))
  const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0))

  // Extract salt (first 16 bytes) and encrypted data
  const salt = combined.slice(0, 16)
  const encrypted = combined.slice(16)

  // Derive decryption key
  const decryptionKey = await deriveEncryptionKey(credentialId, salt)

  // Decrypt the seed
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBytes,
      tagLength: 128,
    },
    decryptionKey,
    encrypted
  )

  return new Uint8Array(decrypted)
}

/**
 * Store encrypted key in browser storage
 * 
 * @param credentialId - WebAuthn credential ID
 * @param userId - User ID
 * @param seed - Raw seed bytes (32 bytes) to encrypt and store
 * @param publicKey - Stellar public key (stored in plaintext)
 */
export async function storeEncryptedKey(
  credentialId: string,
  userId: string,
  seed: Uint8Array,
  publicKey: string
): Promise<void> {
  if (seed.length !== 32) {
    throw new Error(`Invalid seed length: expected 32 bytes, got ${seed.length}`)
  }

  console.log("[Browser Keys] Storing encrypted key:", {
    credentialId: credentialId.substring(0, 20) + "...",
    userId,
    publicKey: publicKey.substring(0, 10) + "...",
  })

  // Encrypt the seed
  const { encrypted, iv } = await encryptSeed(seed, credentialId)

  // Create encrypted key data
  const encryptedKeyData: EncryptedKeyData = {
    credentialId,
    userId,
    encryptedSeed: encrypted,
    publicKey,
    iv,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  // Store in IndexedDB
  await set(STORES.KEYS, credentialId, encryptedKeyData)

  console.log("[Browser Keys] ✅ Encrypted key stored successfully")
}

/**
 * Retrieve and decrypt key from browser storage
 * 
 * @param credentialId - WebAuthn credential ID
 * @param userId - User ID (optional, used for verification)
 * @returns Stellar Keypair
 */
export async function retrieveKeypair(
  credentialId: string,
  userId?: string
): Promise<Keypair | null> {
  console.log("[Browser Keys] Retrieving key:", {
    credentialId: credentialId.substring(0, 20) + "...",
    userId: userId || "not provided",
  })

  // Get encrypted key data from IndexedDB
  const encryptedKeyData = await get<EncryptedKeyData>(
    STORES.KEYS,
    credentialId
  )

  if (!encryptedKeyData) {
    console.log("[Browser Keys] No stored key found for credential ID")
    return null
  }

  // If userId is provided, verify it matches (for consistency)
  if (userId && encryptedKeyData.userId !== userId) {
    console.warn("[Browser Keys] ⚠️ userId mismatch:", {
      stored: encryptedKeyData.userId,
      provided: userId,
    })
    // Don't fail - the key might still be valid, but log the warning
  }

  try {
    // Decrypt the seed
    const seed = await decryptSeed(
      encryptedKeyData.encryptedSeed,
      encryptedKeyData.iv,
      credentialId
    )

    // Verify seed length
    if (seed.length !== 32) {
      throw new Error(
        `Invalid decrypted seed length: expected 32 bytes, got ${seed.length}`
      )
    }

    // Create keypair from seed
    const keypair = Keypair.fromRawEd25519Seed(Buffer.from(seed))

    // Verify public key matches
    if (keypair.publicKey() !== encryptedKeyData.publicKey) {
      throw new Error("Decrypted key public key doesn't match stored public key")
    }

    console.log("[Browser Keys] ✅ Key retrieved and decrypted successfully")
    return keypair
  } catch (error) {
    console.error("[Browser Keys] Failed to decrypt key:", error)
    return null
  }
}

/**
 * Derive and store key from passkey credential ID
 * This is the main function to call when a user registers/logs in
 * 
 * @param credentialId - WebAuthn credential ID
 * @param userId - User ID (optional but recommended)
 * @returns Stellar Keypair and public key
 */
export async function deriveAndStoreKey(
  credentialId: string,
  userId?: string
): Promise<{ keypair: Keypair; publicKey: string }> {
  console.log("[Browser Keys] Deriving and storing key:", {
    credentialId: credentialId.substring(0, 20) + "...",
    userId: userId || "not provided",
  })

  // Check if key already exists
  const existingKeypair = await retrieveKeypair(credentialId)
  if (existingKeypair) {
    console.log("[Browser Keys] Key already exists, returning existing keypair")
    return {
      keypair: existingKeypair,
      publicKey: existingKeypair.publicKey(),
    }
  }

  // Derive keypair from credential ID
  const { keypair, publicKey, seed } = await deriveKeypairWithSeed(
    credentialId,
    userId
  )

  // Store encrypted key if userId is provided
  if (userId) {
    await storeEncryptedKey(credentialId, userId, seed, publicKey)
  } else {
    console.warn(
      "[Browser Keys] ⚠️ No userId provided, key will not be persisted"
    )
  }

  return { keypair, publicKey }
}

/**
 * Get keypair by public key (lookup via index).
 * When multiple passkeys share one Stellar address, prefers `preferredCredentialId` when provided.
 */
export async function getKeypairByPublicKey(
  publicKey: string,
  preferredCredentialId?: string | null
): Promise<Keypair | null> {
  const rows = await getAllByIndex<EncryptedKeyData>(STORES.KEYS, "publicKey", publicKey)
  if (!rows.length) {
    return null
  }
  if (preferredCredentialId) {
    const match = rows.find((r) => r.credentialId === preferredCredentialId)
    if (match) {
      return retrieveKeypair(match.credentialId, match.userId)
    }
  }
  return retrieveKeypair(rows[0].credentialId, rows[0].userId)
}

/**
 * Copy the encrypted wallet seed from one WebAuthn credential wrapper to another (same Stellar address).
 * Used after registering a second passkey so the new credential can sign on this browser.
 */
export async function cloneEncryptedKeyForNewCredential(
  sourceCredentialId: string,
  targetCredentialId: string,
  userId: string
): Promise<{ publicKey: string } | null> {
  const encryptedKeyData = await get<EncryptedKeyData>(STORES.KEYS, sourceCredentialId)
  if (!encryptedKeyData) {
    console.warn("[Browser Keys] cloneEncryptedKey: no source key")
    return null
  }
  const seed = await decryptSeed(
    encryptedKeyData.encryptedSeed,
    encryptedKeyData.iv,
    sourceCredentialId
  )
  if (seed.length !== 32) {
    throw new Error("Invalid seed length")
  }
  await storeEncryptedKey(targetCredentialId, userId, seed, encryptedKeyData.publicKey)
  return { publicKey: encryptedKeyData.publicKey }
}

/**
 * Delete stored key
 */
export async function deleteStoredKey(credentialId: string): Promise<void> {
  console.log("[Browser Keys] Deleting stored key:", {
    credentialId: credentialId.substring(0, 20) + "...",
  })

  await remove(STORES.KEYS, credentialId)
  console.log("[Browser Keys] ✅ Key deleted successfully")
}

/**
 * Check if a key exists for a credential ID
 */
export async function hasStoredKey(credentialId: string): Promise<boolean> {
  const keyData = await get<EncryptedKeyData>(STORES.KEYS, credentialId)
  return keyData !== null
}

/**
 * Get all stored keys (for debugging/admin purposes)
 * Returns only public keys, never private keys
 */
export async function getAllStoredPublicKeys(): Promise<
  Array<{ credentialId: string; publicKey: string; userId: string }>
> {
  const { getAll } = await import("./indexeddb")
  const keys = await getAll<EncryptedKeyData>(STORES.KEYS)

  return keys.map((key) => ({
    credentialId: key.credentialId,
    publicKey: key.publicKey,
    userId: key.userId,
  }))
}
