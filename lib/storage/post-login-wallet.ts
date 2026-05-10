/**
 * After passkey login, align IndexedDB wallet material with the canonical on-chain wallet
 * (avoids storing a different Stellar key when logging in with a second passkey before wallet sync).
 */

"use client"

import { deriveStellarKeypair } from "@/lib/webauthn/key-derivation"
import { deriveAndStoreKey } from "./browser-keys"
import { storeCredentialIdInSession } from "./key-utils"

export async function alignWalletMaterialAfterLogin(
  userId: string,
  credentialId: string
): Promise<{ publicKey: string; needsWalletSync: boolean }> {
  storeCredentialIdInSession(credentialId)

  let serverPk: string | null = null
  try {
    const res = await fetch("/api/wallet/stellar/address", {
      headers: { "x-user-id": userId },
    })
    if (res.ok) {
      const data = (await res.json()) as { publicKey?: string | null }
      serverPk = typeof data.publicKey === "string" && data.publicKey.startsWith("G") ? data.publicKey : null
    }
  } catch {
    // fall through to local derive
  }

  if (!serverPk) {
    const { publicKey } = await deriveAndStoreKey(credentialId, userId)
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("wallet_sync_pending")
    }
    return { publicKey, needsWalletSync: false }
  }

  const derived = await deriveStellarKeypair(credentialId, userId)
  if (derived.publicKey() === serverPk) {
    await deriveAndStoreKey(credentialId, userId)
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("wallet_sync_pending")
    }
    return { publicKey: serverPk, needsWalletSync: false }
  }

  if (typeof window !== "undefined") {
    sessionStorage.setItem("stellar_public_key", serverPk)
    sessionStorage.setItem("wallet_sync_pending", "1")
  }

  return { publicKey: serverPk, needsWalletSync: true }
}
