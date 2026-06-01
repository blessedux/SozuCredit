import { p256 } from "@noble/curves/p256"
import { extractPublicKeyFromKeyData } from "@/lib/stellar/smartAccounts/passkeyPublicKey"

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(data))
  return new Uint8Array(digest)
}

/**
 * Verify WebAuthn assertion the same way OZ stellar-contracts webauthn::verify does.
 */
export async function verifyWebAuthnAssertionForOz(params: {
  publicKey65: Uint8Array
  authenticatorData: Uint8Array
  clientData: Uint8Array
  signature64: Uint8Array
}): Promise<boolean> {
  if (params.publicKey65.length !== 65 || params.publicKey65[0] !== 0x04) return false
  if (params.signature64.length !== 64) return false

  const clientHash = await sha256(params.clientData)
  const message = new Uint8Array(params.authenticatorData.length + 32)
  message.set(params.authenticatorData, 0)
  message.set(clientHash, params.authenticatorData.length)
  const digest = await sha256(message)

  try {
    const hex = Buffer.from(params.publicKey65).toString("hex")
    const point = p256.ProjectivePoint.fromHex(hex)
    return p256.verify(params.signature64, digest, point.toRawBytes(false))
  } catch {
    return false
  }
}

export async function verifyWebAuthnAssertionForKeyData(params: {
  keyData: Buffer
  authenticatorData: Buffer
  clientData: Buffer
  signature64: Uint8Array
}): Promise<boolean> {
  const pub = extractPublicKeyFromKeyData(params.keyData)
  return verifyWebAuthnAssertionForOz({
    publicKey65: pub,
    authenticatorData: new Uint8Array(params.authenticatorData),
    clientData: new Uint8Array(params.clientData),
    signature64: params.signature64,
  })
}
