const SECP256R1_PUBLIC_KEY_SIZE = 65

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

export function extractCredentialIdFromKeyData(keyData: Uint8Array): Uint8Array {
  return keyData.slice(SECP256R1_PUBLIC_KEY_SIZE)
}

export function extractPublicKeyFromKeyData(keyData: Uint8Array): Uint8Array {
  return keyData.slice(0, SECP256R1_PUBLIC_KEY_SIZE)
}
