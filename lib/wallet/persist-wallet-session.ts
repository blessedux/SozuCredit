"use client"

/** Keep local + session storage aligned on the canonical wallet (C…). */
export function persistCanonicalWalletSession(
  publicKey: string,
  walletType: string,
  credentialId?: string
) {
  if (typeof window === "undefined") return
  const pk = publicKey.trim().toUpperCase()
  localStorage.setItem("stellar_public_key", pk)
  sessionStorage.setItem("stellar_public_key", pk)
  sessionStorage.setItem("wallet_type", walletType)
  if (credentialId) {
    sessionStorage.setItem("credential_id", credentialId)
    localStorage.setItem("credential_id", credentialId)
  }
}
