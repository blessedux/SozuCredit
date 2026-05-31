/**
 * After passkey login, align IndexedDB wallet material with the canonical on-chain wallet
 * (avoids storing a different Stellar key when logging in with a second passkey before wallet sync).
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
    const { publicKey } = await syncCanonicalWallet(userId, credentialId)
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("wallet_sync_pending")
    }
    return { publicKey, needsWalletSync: false }
  } catch (e) {
    console.warn("[alignWalletMaterialAfterLogin] syncCanonicalWallet failed:", e)
    const { deriveAndStoreKey } = await import("./browser-keys")
    const { publicKey } = await deriveAndStoreKey(credentialId, userId)
    return { publicKey, needsWalletSync: true }
  }
}
