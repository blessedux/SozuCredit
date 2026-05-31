/**
 * After passkey login/register, provision the canonical C smart wallet (never persist G as primary).
 */

"use client"

import { syncCanonicalWallet } from "@/lib/wallet/sync-canonical-wallet"
import { storeCredentialIdInSession } from "./key-utils"

export async function alignWalletMaterialAfterLogin(
  userId: string,
  credentialId: string
): Promise<{ publicKey: string; needsWalletSync: boolean }> {
  storeCredentialIdInSession(credentialId)

  try {
    const { deriveAndStoreKey } = await import("./browser-keys")
    await deriveAndStoreKey(credentialId, userId)
  } catch (e) {
    console.warn("[alignWalletMaterialAfterLogin] signer key derive failed:", e)
  }

  const { publicKey } = await syncCanonicalWallet(userId, credentialId)

  if (!publicKey.startsWith("C") || publicKey.length !== 56) {
    throw new Error(
      "Smart wallet (C…) was not created. Sign out and sign in again, or contact support if this persists.",
    )
  }

  if (typeof window !== "undefined") {
    sessionStorage.removeItem("wallet_sync_pending")
  }

  return { publicKey, needsWalletSync: false }
}
