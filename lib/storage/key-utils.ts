/**
 * Key Utilities
 * 
 * Helper functions for working with browser-stored keys
 */

"use client"

import { getAllStoredPublicKeys, getKeypairByPublicKey } from "./browser-keys"

/**
 * Get credential ID for a given public key
 * 
 * @param publicKey - Stellar public key
 * @returns Credential ID if found, null otherwise
 */
export async function getCredentialIdByPublicKey(
  publicKey: string
): Promise<string | null> {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const storedKeys = await getAllStoredPublicKeys()
    const matchingKey = storedKeys.find((k) => k.publicKey === publicKey)
    return matchingKey ? matchingKey.credentialId : null
  } catch (error) {
    console.warn("[Key Utils] Error getting credentialId by public key:", error)
    return null
  }
}

/**
 * Get credential ID from sessionStorage (if stored)
 * 
 * @returns Credential ID if found, null otherwise
 */
export function getCredentialIdFromSession(): string | null {
  if (typeof window === "undefined") {
    return null
  }

  return (
    sessionStorage.getItem("credential_id") ??
    localStorage.getItem("credential_id") ??
    null
  )
}

/**
 * Get credential ID for current user
 * Tries multiple methods to find the credential ID
 * 
 * @param publicKey - Optional public key to lookup
 * @returns Credential ID if found, null otherwise
 */
export async function getCurrentCredentialId(
  publicKey?: string
): Promise<string | null> {
  // Try sessionStorage first
  const sessionCredentialId = getCredentialIdFromSession()
  if (sessionCredentialId) {
    return sessionCredentialId
  }

  // Try lookup by public key if provided
  if (publicKey) {
    const credentialId = await getCredentialIdByPublicKey(publicKey)
    if (credentialId) {
      return credentialId
    }
  }

  // Try to get public key from localStorage/sessionStorage and lookup
  if (typeof window !== "undefined") {
    const storedPublicKey =
      localStorage.getItem("stellar_public_key") ?? sessionStorage.getItem("stellar_public_key")
    if (storedPublicKey) {
      const credentialId = await getCredentialIdByPublicKey(storedPublicKey)
      if (credentialId) {
        return credentialId
      }
    }
  }

  return null
}

/**
 * Store credential ID in sessionStorage for quick access
 * 
 * @param credentialId - Credential ID to store
 */
export function storeCredentialIdInSession(credentialId: string): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem("credential_id", credentialId)
    localStorage.setItem("credential_id", credentialId)
  }
}

/** WebAuthn rawId (base64url) for OZ keyData suffix — must match assertion bytes at sign time. */
export function storeCredentialRawIdInSession(rawIdBase64Url: string): void {
  if (typeof window !== "undefined" && rawIdBase64Url.trim()) {
    sessionStorage.setItem("credential_raw_id", rawIdBase64Url.trim())
  }
}

/**
 * Get public key from sessionStorage (if stored)
 * 
 * @returns Public key if found, null otherwise
 */
export function getPublicKeyFromSession(): string | null {
  if (typeof window === "undefined") {
    return null
  }

  // Try to get from sessionStorage
  // We store it during authentication
  return localStorage.getItem("stellar_public_key") ?? sessionStorage.getItem("stellar_public_key") ?? null
}
