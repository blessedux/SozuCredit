const SECP256R1_PUBLIC_KEY_SIZE = 65
const UNCOMPRESSED_PUBKEY_PREFIX = 0x04

/** COSE ES256 (P-256) prefix inside WebAuthn attestation objects. */
const COSE_ES256_PREFIX = new Uint8Array([
  0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20,
])

function decodeBase64Flexible(stored: string): Uint8Array {
  const trimmed = stored.trim()
  if (!trimmed) return new Uint8Array()
  const padded = trimmed.replace(/-/g, "+").replace(/_/g, "/")
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4))
  const bin =
    typeof atob !== "undefined"
      ? atob(padded + pad)
      : Buffer.from(padded + pad, "base64").toString("binary")
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function extractFromAttestationBytes(attestationObject: Uint8Array): Uint8Array | null {
  const buf = attestationObject
  let startIndex = -1
  for (let i = 0; i <= buf.length - COSE_ES256_PREFIX.length; i++) {
    let match = true
    for (let j = 0; j < COSE_ES256_PREFIX.length; j++) {
      if (buf[i + j] !== COSE_ES256_PREFIX[j]) {
        match = false
        break
      }
    }
    if (match) {
      startIndex = i + COSE_ES256_PREFIX.length
      break
    }
  }
  if (startIndex < 0 || startIndex + 64 > buf.length) return null
  const x = buf.slice(startIndex, startIndex + 32)
  const y = buf.slice(startIndex + 35, startIndex + 67)
  const publicKey = new Uint8Array(65)
  publicKey[0] = UNCOMPRESSED_PUBKEY_PREFIX
  publicKey.set(x, 1)
  publicKey.set(y, 33)
  return publicKey
}

function extractFromAuthenticatorData(authData: Uint8Array): Uint8Array | null {
  if (authData.length < 55) return null
  const credentialIdLength = (authData[53] << 8) | authData[54]
  const xStart = 55 + credentialIdLength
  const yStart = xStart + 32 + 3
  if (yStart + 32 > authData.length) return null
  const x = authData.slice(xStart, xStart + 32)
  const y = authData.slice(yStart, yStart + 32)
  const publicKey = new Uint8Array(65)
  publicKey[0] = UNCOMPRESSED_PUBKEY_PREFIX
  publicKey.set(x, 1)
  publicKey.set(y, 33)
  return publicKey
}

/**
 * Normalize passkeys.public_key DB values to 65-byte uncompressed secp256r1 (0x04…).
 * Legacy rows may store attestationObject / credential.id instead of raw 65 bytes.
 */
export function parsePasskeyPublicKey65(stored: string): Uint8Array {
  const raw = decodeBase64Flexible(stored)
  if (raw.length === SECP256R1_PUBLIC_KEY_SIZE && raw[0] === UNCOMPRESSED_PUBKEY_PREFIX) {
    return raw
  }
  if (raw.length > SECP256R1_PUBLIC_KEY_SIZE) {
    const tail = raw.slice(-SECP256R1_PUBLIC_KEY_SIZE)
    if (tail[0] === UNCOMPRESSED_PUBKEY_PREFIX) return tail
    const fromAtt = extractFromAttestationBytes(raw)
    if (fromAtt) return fromAtt
    const fromAuth = extractFromAuthenticatorData(raw)
    if (fromAuth) return fromAuth
  }
  throw new Error(
    "Passkey public key could not be parsed. Sign out, sign in again, or re-register your passkey.",
  )
}

export function publicKeyToBase64Url(publicKey: Uint8Array): string {
  const b64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(publicKey).toString("base64")
      : btoa(String.fromCharCode(...publicKey))
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

export function credentialIdToBuffer(credentialId: string): Buffer {
  const padded = credentialId.replace(/-/g, "+").replace(/_/g, "/")
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4))
  return Buffer.from(padded + pad, "base64")
}

/**
 * Credential id bytes for on-chain keyData suffix — prefer WebAuthn rawId when stored at login/register.
 */
export function resolveCredentialIdBytes(credentialId: string): Buffer {
  if (typeof window !== "undefined") {
    const raw = sessionStorage.getItem("credential_raw_id")?.trim()
    if (raw) {
      try {
        return credentialIdToBuffer(raw)
      } catch {
        /* fall through */
      }
    }
  }
  return credentialIdToBuffer(credentialId)
}

/** OZ External signer key blob: 65-byte uncompressed pubkey + raw WebAuthn credential id. */
export function buildExternalSignerKeyData(
  publicKey65: Uint8Array,
  credentialIdBytes: Buffer,
): Buffer {
  if (publicKey65.length !== SECP256R1_PUBLIC_KEY_SIZE) {
    throw new Error("Passkey public key must be 65 bytes.")
  }
  if (publicKey65[0] !== UNCOMPRESSED_PUBKEY_PREFIX) {
    throw new Error("Passkey public key must start with 0x04.")
  }
  return Buffer.concat([Buffer.from(publicKey65), credentialIdBytes])
}

/** Prefer rawId bytes from the assertion (matches smart-account-kit). */
export function credentialIdBytesFromAssertion(assertion: PublicKeyCredential): Buffer {
  const raw = new Uint8Array(assertion.rawId)
  if (raw.length > 0) {
    return Buffer.from(raw)
  }
  return credentialIdToBuffer(assertion.id)
}

export function extractCredentialIdFromKeyData(keyData: Uint8Array): Uint8Array {
  return keyData.slice(SECP256R1_PUBLIC_KEY_SIZE)
}

export function extractPublicKeyFromKeyData(keyData: Uint8Array): Uint8Array {
  return keyData.slice(0, SECP256R1_PUBLIC_KEY_SIZE)
}
