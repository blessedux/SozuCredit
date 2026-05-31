import {
  parsePasskeyPublicKey65,
  publicKeyToBase64Url,
} from "@/lib/stellar/smartAccounts/passkeyPublicKey"

const SECP256R1_PUBLIC_KEY_SIZE = 65
const UNCOMPRESSED_PUBKEY_PREFIX = 0x04

const COSE_ES256_PREFIX = Buffer.from([
  0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20,
])

/**
 * Extract 65-byte secp256r1 public key from WebAuthn registration material for DB storage.
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

  if (response.publicKey) {
    try {
      return publicKeyToBase64Url(parsePasskeyPublicKey65(response.publicKey))
    } catch {
      /* try attestation */
    }
  }

  if (response.attestationObject) {
    const parsed = parseAttestationObject(response.attestationObject)
    if (parsed) return publicKeyToBase64Url(parsed)
  }

  if (response.authenticatorData) {
    const parsed = parseAuthenticatorData(response.authenticatorData)
    if (parsed) return publicKeyToBase64Url(parsed)
  }

  throw new Error("Could not extract passkey public key from registration.")
}

function decodeB64Url(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/")
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4))
  return Buffer.from(padded + pad, "base64")
}

function parseAttestationObject(attestationObject: string): Uint8Array | null {
  const buf = decodeB64Url(attestationObject)
  const startIndex = buf.indexOf(COSE_ES256_PREFIX)
  if (startIndex < 0) return null
  const xStart = startIndex + COSE_ES256_PREFIX.length
  if (xStart + 64 > buf.length) return null
  const x = buf.subarray(xStart, xStart + 32)
  const y = buf.subarray(xStart + 35, xStart + 67)
  const out = new Uint8Array(65)
  out[0] = UNCOMPRESSED_PUBKEY_PREFIX
  out.set(x, 1)
  out.set(y, 33)
  return out
}

function parseAuthenticatorData(authenticatorData: string): Uint8Array | null {
  const authData = decodeB64Url(authenticatorData)
  if (authData.length < 55) return null
  const credentialIdLength = (authData[53] << 8) | authData[54]
  const xStart = 55 + credentialIdLength
  const yStart = xStart + 32 + 3
  if (yStart + 32 > authData.length) return null
  const out = new Uint8Array(65)
  out[0] = UNCOMPRESSED_PUBKEY_PREFIX
  out.set(authData.subarray(xStart, xStart + 32), 1)
  out.set(authData.subarray(yStart, yStart + 32), 33)
  return out
}
