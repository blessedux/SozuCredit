"use client"

import { ensureSmartWallet } from "@/lib/wallet/ensure-smart-wallet"

function persistWalletSession(publicKey: string, walletType: string, credentialId?: string) {
  if (typeof window === "undefined") return
  localStorage.setItem("stellar_public_key", publicKey)
  sessionStorage.setItem("stellar_public_key", publicKey)
  sessionStorage.setItem("wallet_type", walletType)
  if (credentialId) {
    sessionStorage.setItem("credential_id", credentialId)
    localStorage.setItem("credential_id", credentialId)
  }
}

/**
 * Canonical wallet = OpenZeppelin passkey smart account (C…).
 * Migrates legacy G rows via ensureSmartWallet + server registration.
 */
export async function syncCanonicalWallet(
  userId: string,
  loginCredentialId?: string
): Promise<{ publicKey: string; walletType: "oz" | "factory" | "legacy" }> {
  const credId =
    loginCredentialId?.trim() ||
    (typeof window !== "undefined"
      ? sessionStorage.getItem("credential_id") ?? localStorage.getItem("credential_id")
      : null) ||
    undefined

  const addrRes = await fetch("/api/wallet/stellar/address", {
    headers: { "x-user-id": userId },
  })
  let dbPk: string | null = null
  let dbWalletType: string | null = null
  if (addrRes.ok) {
    const data = (await addrRes.json()) as {
      publicKey?: string | null
      walletType?: string | null
    }
    if (typeof data.publicKey === "string" && data.publicKey.length === 56) {
      dbPk = data.publicKey.trim().toUpperCase()
    }
    if (typeof data.walletType === "string") {
      dbWalletType = data.walletType
    }
  }

  if (dbPk?.startsWith("C")) {
    const wt = dbWalletType || sessionStorage.getItem("wallet_type") || "oz"
    persistWalletSession(dbPk, wt, credId ?? undefined)
    return {
      publicKey: dbPk,
      walletType: (wt === "factory" || wt === "legacy" ? wt : "oz") as "oz" | "factory" | "legacy",
    }
  }

  const ensured = await ensureSmartWallet(userId, credId ?? undefined)
  persistWalletSession(ensured.publicKey, ensured.walletType, ensured.credentialId)
  return ensured
}
