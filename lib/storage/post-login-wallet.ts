/**
 * After passkey login/register, provision the canonical C smart wallet.
 * Auth identity is persisted separately so login never loops back to /auth.
 */

"use client"

import { persistWalletPublicKey } from "@/lib/client-wallet-session"
import { syncCanonicalWallet } from "@/lib/wallet/sync-canonical-wallet"
import { storeCredentialIdInSession } from "./key-utils"

export async function alignWalletMaterialAfterLogin(
  userId: string,
  credentialId: string,
): Promise<{ publicKey: string; needsWalletSync: boolean; setupError?: string }> {
  storeCredentialIdInSession(credentialId)

  try {
    const { publicKey, walletType } = await syncCanonicalWallet(userId, credentialId)
    if (publicKey.startsWith("C") && publicKey.length === 56) {
      persistWalletPublicKey(publicKey)
      if (typeof window !== "undefined") {
        sessionStorage.setItem("wallet_type", walletType)
        sessionStorage.removeItem("wallet_sync_pending")
        sessionStorage.removeItem("wallet_setup_error")
      }
      return { publicKey, needsWalletSync: false }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn("[alignWalletMaterialAfterLogin] sync failed:", msg)
    if (typeof window !== "undefined") {
      sessionStorage.setItem("wallet_setup_error", msg)
      sessionStorage.setItem("wallet_sync_pending", "1")
    }
    return { publicKey: "", needsWalletSync: true, setupError: msg }
  }

  return {
    publicKey: "",
    needsWalletSync: true,
    setupError: "Smart wallet address was not returned after sync.",
  }
}
