"use client"

import { ensureSmartWallet } from "@/lib/wallet/ensure-smart-wallet"
import { persistCanonicalWalletSession } from "@/lib/wallet/persist-wallet-session"

/**
 * Canonical wallet = OpenZeppelin passkey smart account (C…).
 * Migrates legacy G rows via ensureSmartWallet + server registration.
 */
export async function syncCanonicalWallet(
  userId: string,
  loginCredentialId?: string
): Promise<{ publicKey: string; walletType: "oz" | "factory" }> {
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
    persistCanonicalWalletSession(dbPk, wt, credId ?? undefined)
    return {
      publicKey: dbPk,
      walletType: wt === "factory" ? "factory" : "oz",
    }
  }

  const ensured = await ensureSmartWallet(userId, credId ?? undefined)
  persistCanonicalWalletSession(ensured.publicKey, ensured.walletType, ensured.credentialId)
  return ensured
}
