/**
 * After passkey login/register, provision the canonical C smart wallet when possible.
 * Auth identity is persisted separately so login never loops back to /auth.
 */

"use client"

import { persistWalletPublicKey } from "@/lib/client-wallet-session"
import { syncCanonicalWallet } from "@/lib/wallet/sync-canonical-wallet"
import { storeCredentialIdInSession } from "./key-utils"

export async function alignWalletMaterialAfterLogin(
  userId: string,
  credentialId: string
): Promise<{ publicKey: string; needsWalletSync: boolean }> {
  storeCredentialIdInSession(credentialId)

  let signerG: string | null = null
  try {
    const { deriveAndStoreKey } = await import("./browser-keys")
    const { publicKey } = await deriveAndStoreKey(credentialId, userId)
    signerG = publicKey.trim().toUpperCase()
  } catch (e) {
    console.warn("[alignWalletMaterialAfterLogin] signer key derive failed:", e)
  }

  try {
    const { publicKey, walletType } = await syncCanonicalWallet(userId, credentialId)
    if (publicKey.startsWith("C") && publicKey.length === 56) {
      persistWalletPublicKey(publicKey)
      if (typeof window !== "undefined") {
        sessionStorage.setItem("wallet_type", walletType)
        sessionStorage.removeItem("wallet_sync_pending")
      }
      return { publicKey, needsWalletSync: false }
    }
  } catch (e) {
    console.warn("[alignWalletMaterialAfterLogin] smart wallet sync failed:", e)
  }

  if (signerG?.startsWith("G") && signerG.length === 56) {
    persistWalletPublicKey(signerG)
    if (typeof window !== "undefined") {
      sessionStorage.setItem("wallet_sync_pending", "1")
      sessionStorage.setItem("wallet_type", "legacy")
    }
    return { publicKey: signerG, needsWalletSync: true }
  }

  throw new Error("Could not resolve wallet address after login.")
}
