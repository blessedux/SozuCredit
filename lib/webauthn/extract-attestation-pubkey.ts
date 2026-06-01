import {
  parsePasskeyPublicKey65,
  publicKeyToBase64Url,
} from "@/lib/stellar/smartAccounts/passkeyPublicKey"

const SECP256R1_PUBLIC_KEY_SIZE = 65
const UNCOMPRESSED_PUBKEY_PREFIX = 0x04

/** COSE ES256 (P-256) prefix — same as smart-account-kit. */
const COSE_ES256_PREFIX = Buffer.from([
  0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20,
])

/**
 * Extract 65-byte secp256r1 public key from WebAuthn registration material.
 * Logic aligned with smart-account-kit extractPublicKeyFromAttestation so deploy matches signing.
 */
export function extractPasskeyPublicKey65ForStorage(credential: {
  response?: {
    publicKey?: string
    attestationObject?: string
    authenticatorData?: string
  }
  id?: string
}): string {
  const response = credential.response
  if (!response) {
    throw new Error("Missing WebAuthn credential response.")
  }

  const extracted = extractPublicKey65FromRegistrationResponse(response)
  return publicKeyToBase64Url(extracted)
}

/**
 * Prefer COSE in authenticatorData / attestationObject (matches smart-account-kit deploy).
 * Avoid taking the last 65 bytes of SPKI from getPublicKey() — that often ≠ the signing key.
 */
export function extractPublicKey65FromRegistrationResponse(response: {
  publicKey?: string
  attestationObject?: string
  authenticatorData?: string
}): Uint8Array {
  if (response.authenticatorData) {
    const parsed = parseAuthenticatorDataKit(response.authenticatorData)
    if (parsed) return parsed
  }

  if (response.attestationObject) {
    const parsed = parseAttestationObjectKit(response.attestationObject)
    if (parsed) return parsed
  }

  if (response.publicKey) {
    const buf = decodeB64Url(response.publicKey)
    if (buf.length === SECP256R1_PUBLIC_KEY_SIZE && buf[0] === UNCOMPRESSED_PUBKEY_PREFIX) {
      return new Uint8Array(buf)
    }
  }

  throw new Error("Could not extract passkey public key from registration.")
}

function decodeB64Url(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/")
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4))
  return Buffer.from(padded + pad, "base64")
}

/** smart-account-kit offsets for registration authenticatorData. */
function parseAuthenticatorDataKit(authenticatorData: string): Uint8Array | null {
  const authData = decodeB64Url(authenticatorData)
  if (authData.length < 55) return null
  const credentialIdLength = (authData[53] << 8) | authData[54]
  const xStart = 65 + credentialIdLength
  const yStart = 100 + credentialIdLength
  if (yStart + 32 > authData.length) return null
  const out = new Uint8Array(SECP256R1_PUBLIC_KEY_SIZE)
  out[0] = UNCOMPRESSED_PUBKEY_PREFIX
  out.set(authData.subarray(xStart, xStart + 32), 1)
  out.set(authData.subarray(yStart, yStart + 32), 33)
  return out
}

/** smart-account-kit attestationObject scan. */
function parseAttestationObjectKit(attestationObject: string): Uint8Array | null {
  const buf = decodeB64Url(attestationObject)
  const prefixAt = buf.indexOf(COSE_ES256_PREFIX)
  if (prefixAt < 0) return null
  const xStart = prefixAt + COSE_ES256_PREFIX.length
  if (xStart + 32 > buf.length) return null
  const x = buf.subarray(xStart, xStart + 32)
  const y = buf.subarray(35 + xStart, 67 + xStart)
  const out = new Uint8Array(SECP256R1_PUBLIC_KEY_SIZE)
  out[0] = UNCOMPRESSED_PUBKEY_PREFIX
  out.set(x, 1)
  out.set(y, 33)
  return out
}
