"use client"

import { getTurnkeyConfig } from "./config"

export interface PasskeyChallenge {
  challenge: string
  rpId: string
  rp?: {
    name: string
    id: string
  }
  user?: {
    id: string
    name: string
    displayName: string
  }
  allowCredentials?: Array<{
    id: string
    type: string
    transports?: AuthenticatorTransport[]
  }>
  authenticatorSelection?: {
    authenticatorAttachment?: "platform" | "cross-platform"
    requireResidentKey?: boolean
    residentKey?: "required" | "preferred" | "discouraged"
    userVerification?: "required" | "preferred" | "discouraged"
  }
  timeout?: number
  userVerification?: "required" | "preferred" | "discouraged"
}

export interface PasskeyCredential {
  id: string
  rawId: string
  type: string
  response: {
    clientDataJSON: string
    authenticatorData?: string
    signature?: string
    attestationObject?: string
    userHandle?: string | null
  }
}

/**
 * Generate passkey registration challenge via API
 */
export async function generateRegistrationChallenge(username: string): Promise<PasskeyChallenge> {
  try {
    const response = await fetch("/api/auth/register/challenge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username }),
    })

    if (!response.ok) {
      const error = await response.json()
      const errorMessage = error.error || "Failed to generate registration challenge"
      const errorToThrow = new Error(errorMessage)
      // Preserve status code and usernameExists flag for handling
      ;(errorToThrow as any).status = response.status
      ;(errorToThrow as any).usernameExists = error.usernameExists || false
      throw errorToThrow
    }

    const data = await response.json()
    
    return {
      challenge: data.challenge,
      rpId: data.rp.id,
      rp: data.rp,
      user: data.user,
      timeout: data.timeout,
      userVerification: data.authenticatorSelection?.userVerification || "required",
    }
  } catch (error) {
    console.error("Error generating registration challenge:", error)
    throw error
  }
}

/**
 * Generate passkey authentication challenge via API
 */
export async function generateAuthChallenge(username?: string): Promise<PasskeyChallenge> {
  try {
    // Send username only if provided, otherwise send empty object for discovery mode
    const response = await fetch("/api/auth/login/challenge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(username ? { username } : {}),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to generate authentication challenge" }))
      // Check if it's a "not found" error - this is expected for new users
      // But only if we provided a username
      if (response.status === 404 && username) {
        throw new Error(error.error || "User not found")
      }
      // For discovery mode or other errors, throw generic error
      throw new Error(error.error || "Failed to generate authentication challenge")
    }

    const data = await response.json()
    
    // Use rpId from the server response (correct for Vercel deployment)
    // Fallback to window.location.hostname for client-side compatibility
    const rpId = data.rp?.id || (typeof window !== "undefined" ? window.location.hostname : "localhost")
    
    return {
      challenge: data.challenge,
      rpId,
      allowCredentials: data.allowCredentials || [],
      timeout: data.timeout,
      userVerification: data.userVerification || "required",
    }
  } catch (error) {
    console.error("Error generating authentication challenge:", error)
    throw error
  }
}

/**
 * Verify passkey registration via API and save to database
 */
export async function verifyRegistration(
  username: string,
  credential: PasskeyCredential,
  challenge?: string,
  referralCode?: string | null
): Promise<{ success: boolean; userId?: string; username?: string }> {
  try {
    // Extract public key from attestation object (simplified for now)
    // In production, you'd need to parse the CBOR attestation object
    const publicKey = credential.response.attestationObject || credential.id

    const response = await fetch("/api/auth/register/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        challenge, // Pass challenge in case store doesn't have it
        referralCode: referralCode || null, // Pass referral code if provided
        credential: {
          ...credential,
          response: {
            ...credential.response,
            publicKey,
            transports: ["internal"], // Platform authenticator
          },
        },
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to verify registration" }))
      const errorMessage = error.error || error.details || "Failed to verify registration"
      console.error("[verifyRegistration] API error:", errorMessage, "Full error:", error)
      throw new Error(errorMessage)
    }

    const data = await response.json()
    return { 
      success: data.success, 
      userId: data.userId,
      username: data.username 
    }
  } catch (error) {
    console.error("Error verifying registration:", error)
    throw error
  }
}

/**
 * Verify passkey authentication via API
 */
export async function verifyAuthentication(
  username: string,
  credential: PasskeyCredential,
  challenge?: string
): Promise<{ success: boolean; userId?: string; username?: string }> {
  try {
    const response = await fetch("/api/auth/login/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        credential,
        challenge, // Pass challenge in case store doesn't have it (serverless)
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to verify authentication")
    }

    const data = await response.json()
    return { 
      success: data.success, 
      userId: data.userId,
      username: data.username 
    }
  } catch (error) {
    console.error("Error verifying authentication:", error)
    throw error
  }
}

/**
 * Create WebAuthn credential (browser API wrapper)
 * 
 * @param challenge - Passkey challenge from server
 * @param userId - User ID to store in userHandle (optional but recommended for decentralized auth)
 * @param displayName - Display name for the passkey (optional, defaults to challenge.user.displayName or "User")
 */
export async function createPasskey(
  challenge: PasskeyChallenge,
  userId?: string,
  displayName?: string
): Promise<PasskeyCredential | null> {
  try {
    if (!window.PublicKeyCredential) {
      throw new Error("WebAuthn is not supported in this browser")
    }

    // Prepare user ID for userHandle
    // userHandle will be returned during authentication and can be used to identify the user
    // without database lookup (decentralized authentication)
    const userHandleBytes = userId 
      ? new TextEncoder().encode(userId)
      : challenge.user?.id 
        ? new TextEncoder().encode(challenge.user.id)
        : new TextEncoder().encode("user")

    const publicKeyOptions: PublicKeyCredentialCreationOptions = {
      challenge: base64URLToArrayBuffer(challenge.challenge),
      rp: challenge.rp || {
        name: "Sozu Credit Platform",
        id: challenge.rpId,
      },
      user: challenge.user ? {
        id: userHandleBytes, // Store userId in user.id (will be available as userHandle during auth)
        name: challenge.user.name,
        displayName: displayName || challenge.user.displayName || challenge.user.name || "User",
      } : {
        id: userHandleBytes,
        name: displayName || "user",
        displayName: displayName || "User",
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" }, // ES256
        { alg: -257, type: "public-key" }, // RS256
      ],
      authenticatorSelection: {
        // Don't restrict to platform - allow both device-stored and browser-stored passkeys
        // Use the challenge's authenticatorSelection if provided, otherwise allow both types
        ...(challenge.authenticatorSelection || {}),
        requireResidentKey: challenge.authenticatorSelection?.requireResidentKey ?? true,
        residentKey: challenge.authenticatorSelection?.residentKey ?? "required",
        userVerification: challenge.authenticatorSelection?.userVerification ?? "required",
      },
      timeout: challenge.timeout || 60000,
    }

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyOptions,
    })) as PublicKeyCredential

    if (!credential) {
      throw new Error("Failed to create passkey")
    }

    const response = credential.response as AuthenticatorAttestationResponse

    // Log credential ID details for debugging
    console.log("[createPasskey] Credential ID from browser:", {
      id: credential.id,
      length: credential.id.length,
      first_20: credential.id.substring(0, 20),
      last_20: credential.id.substring(credential.id.length - 20),
      type: typeof credential.id,
      rawId_length: credential.rawId.byteLength,
      userId: userId || challenge.user?.id || "not provided",
    })

    // Extract userHandle from response if available
    // Note: userHandle may not be available in registration response for all authenticators
    // It will be available during authentication
    let userHandle: string | null = null
    if ((response as any).userHandle) {
      userHandle = new TextDecoder().decode((response as any).userHandle)
      console.log("[createPasskey] UserHandle in response:", userHandle)
    } else {
      // Use the userId we provided (it's stored in user.id)
      userHandle = userId || challenge.user?.id || null
      console.log("[createPasskey] UserHandle from userId:", userHandle)
    }

    return {
      id: credential.id,
      rawId: arrayBufferToBase64URL(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: arrayBufferToBase64URL(response.clientDataJSON),
        attestationObject: arrayBufferToBase64URL(response.attestationObject),
        userHandle: userHandle,
      },
    }
  } catch (error) {
    // Preserve DOMException errors (NotAllowedError, AbortError, etc.) so they can be handled properly
    if (error instanceof DOMException) {
      // Log but don't wrap - preserve the original error type
      console.log("[createPasskey] WebAuthn error:", error.name, error.message)
      throw error
    }
    
    // For other errors, provide better error messages
    if (error instanceof Error) {
      if (error.name === "NotAllowedError") {
        throw new Error("Passkey creation was cancelled or not allowed. Please try again.")
      } else if (error.name === "SecurityError") {
        throw new Error("Security error. Please ensure you're using HTTPS or localhost.")
      } else if (error.name === "AbortError") {
        throw new Error("Operation cancelled.")
      } else if (error.name === "InvalidStateError") {
        throw new Error("A passkey already exists. Please try logging in instead.")
      }
      throw error
    }
    
    // If error is not an Error instance, wrap it
    throw new Error("Failed to create passkey: Unknown error occurred")
  }
}

/**
 * Get WebAuthn credential for transaction approval
 * Wrapper around getPasskey with transaction-specific error messages
 */
export async function getPasskeyForTransaction(challenge: PasskeyChallenge): Promise<PasskeyCredential | null> {
  try {
    return await getPasskey(challenge)
  } catch (error: any) {
    // Provide transaction-specific error messages
    if (error instanceof DOMException) {
      if (error.name === "NotAllowedError") {
        throw new Error("Transaction cancelled. You must approve the transaction with your passkey to send payment.")
      } else if (error.name === "AbortError") {
        throw new Error("Transaction approval cancelled.")
      } else if (error.name === "TimeoutError") {
        throw new Error("Transaction approval timed out. Please try again.")
      }
      throw error
    }
    
    if (error instanceof Error) {
      if (error.message.includes("WebAuthn is not supported")) {
        throw new Error("Your browser does not support passkeys. Please use a modern browser.")
      }
      throw error
    }
    
    throw new Error("Failed to get passkey approval. Please try again.")
  }
}

/**
 * Get WebAuthn credential (browser API wrapper)
 */
export async function getPasskey(challenge: PasskeyChallenge): Promise<PasskeyCredential | null> {
  try {
    if (!window.PublicKeyCredential) {
      throw new Error("WebAuthn is not supported in this browser")
    }

    const publicKeyOptions: PublicKeyCredentialRequestOptions = {
      challenge: base64URLToArrayBuffer(challenge.challenge),
      rpId: challenge.rpId,
      allowCredentials: challenge.allowCredentials?.map((cred) => ({
        id: base64URLToArrayBuffer(cred.id),
        type: cred.type as PublicKeyCredentialType,
        // Only include transports if explicitly provided
        // Omitting transports allows browser to use any available transport for that credential
        ...(cred.transports && cred.transports.length > 0 ? { transports: cred.transports } : {}),
      })) || [],
      timeout: challenge.timeout || 60000,
      userVerification: challenge.userVerification || "required",
    }

    const credential = (await navigator.credentials.get({
      publicKey: publicKeyOptions,
    })) as PublicKeyCredential

    if (!credential) {
      throw new Error("Failed to get passkey")
    }

    const response = credential.response as AuthenticatorAssertionResponse

    // Log credential ID details for debugging
    console.log("[getPasskey] Credential ID from browser:", {
      id: credential.id,
      length: credential.id.length,
      first_20: credential.id.substring(0, 20),
      last_20: credential.id.substring(credential.id.length - 20),
      type: typeof credential.id,
      rawId_length: credential.rawId.byteLength
    })

    // Extract userHandle from response (contains user ID for decentralized auth)
    let userHandle: string | null = null
    if (response.userHandle) {
      // Decode userHandle from ArrayBuffer to string
      userHandle = new TextDecoder().decode(response.userHandle)
      console.log("[getPasskey] UserHandle extracted:", userHandle)
    } else {
      console.log("[getPasskey] No userHandle in response (may not be supported by authenticator)")
    }

    return {
      id: credential.id,
      rawId: arrayBufferToBase64URL(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: arrayBufferToBase64URL(response.clientDataJSON),
        authenticatorData: arrayBufferToBase64URL(response.authenticatorData),
        signature: arrayBufferToBase64URL(response.signature),
        userHandle: userHandle, // Store decoded userHandle as string
      },
    }
  } catch (error) {
    // Preserve DOMException errors (NotAllowedError, AbortError, etc.) so they can be handled properly
    if (error instanceof DOMException) {
      // Log but don't wrap - preserve the original error type
      console.log("[getPasskey] WebAuthn error:", error.name, error.message)
      throw error
    }
    
    // For other errors, provide better error messages
    if (error instanceof Error) {
      if (error.name === "NotAllowedError") {
        throw new Error("No passkey found. Please register first or check your device settings.")
      } else if (error.name === "SecurityError") {
        throw new Error("Security error. Please ensure you're using HTTPS or localhost.")
      } else if (error.name === "AbortError") {
        throw new Error("Operation cancelled.")
      } else if (error.name === "TimeoutError") {
        throw new Error("Operation timed out. Please try again.")
      }
      throw error
    }
    
    // If error is not an Error instance, wrap it
    throw new Error("Failed to get passkey: Unknown error occurred")
  }
}

// Utility functions
function arrayBufferToBase64URL(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

function base64URLToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/")
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

