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
      throw new Error(error.error || "Failed to generate registration challenge")
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
        referralCode, // Pass referral code if provided
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
 */
export async function createPasskey(challenge: PasskeyChallenge): Promise<PasskeyCredential | null> {
  try {
    if (!window.PublicKeyCredential) {
      throw new Error("WebAuthn is not supported in this browser")
    }

    const publicKeyOptions: PublicKeyCredentialCreationOptions = {
      challenge: base64URLToArrayBuffer(challenge.challenge),
      rp: challenge.rp || {
        name: "Sozu Credit Platform",
        id: challenge.rpId,
      },
      user: challenge.user ? {
        id: new TextEncoder().encode(challenge.user.id),
        name: challenge.user.name,
        displayName: challenge.user.displayName,
      } : {
        id: new TextEncoder().encode("user"),
        name: "user",
        displayName: "User",
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" }, // ES256
        { alg: -257, type: "public-key" }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        requireResidentKey: true,
        residentKey: "required",
        userVerification: "required",
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
      rawId_length: credential.rawId.byteLength
    })

    // userHandle is typically not available in registration response
    // It will be available during authentication
    return {
      id: credential.id,
      rawId: arrayBufferToBase64URL(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: arrayBufferToBase64URL(response.clientDataJSON),
        attestationObject: arrayBufferToBase64URL(response.attestationObject),
        userHandle: null,
      },
    }
  } catch (error) {
    console.error("Error creating passkey:", error)
    
    // Provide better error messages
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
        transports: cred.transports,
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

    return {
      id: credential.id,
      rawId: arrayBufferToBase64URL(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: arrayBufferToBase64URL(response.clientDataJSON),
        authenticatorData: arrayBufferToBase64URL(response.authenticatorData),
        signature: arrayBufferToBase64URL(response.signature),
        userHandle: response.userHandle ? arrayBufferToBase64URL(response.userHandle) : null,
      },
    }
  } catch (error) {
    console.error("Error getting passkey:", error)
    
    // Provide better error messages
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

