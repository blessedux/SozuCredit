/**
 * Auth-boundary Wallet Provisioning (ADR 0001).
 * Load existing Smart Account; if missing, provision OZ once.
 */

"use client"

import { persistWalletPublicKey } from "@/lib/client-wallet-session"
import { ensureSmartWallet } from "@/lib/wallet/ensure-smart-wallet"
import { loadCanonicalWallet } from "@/lib/wallet/sync-canonical-wallet"
import { storeCredentialIdInSession } from "./key-utils"

type AlignResult = {
  publicKey: string
  needsWalletSync: boolean
  setupError?: string
}

/** Dedup concurrent Auth + Home calls during signup (onboarding overlaps provision). */
let inFlightAlign: Promise<AlignResult> | null = null

async function alignWalletMaterialAfterLoginImpl(
  userId: string,
  credentialId: string,
): Promise<AlignResult> {
  storeCredentialIdInSession(credentialId)

  try {
    const existing = await loadCanonicalWallet(userId, credentialId)
    if (existing?.publicKey.startsWith("C") && existing.publicKey.length === 56) {
      persistWalletPublicKey(existing.publicKey)
      if (typeof window !== "undefined") {
        sessionStorage.setItem("wallet_type", existing.walletType)
        sessionStorage.removeItem("wallet_sync_pending")
        sessionStorage.removeItem("wallet_setup_error")
      }
      return { publicKey: existing.publicKey, needsWalletSync: false }
    }

    const { publicKey, walletType } = await ensureSmartWallet(userId, credentialId)
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
    console.warn("[alignWalletMaterialAfterLogin] provisioning failed:", msg)
    if (typeof window !== "undefined") {
      sessionStorage.setItem("wallet_setup_error", msg)
      sessionStorage.setItem("wallet_sync_pending", "1")
    }
    return { publicKey: "", needsWalletSync: true, setupError: msg }
  }

  return {
    publicKey: "",
    needsWalletSync: true,
    setupError: "Smart wallet address was not returned after provisioning.",
  }
}

export async function alignWalletMaterialAfterLogin(
  userId: string,
  credentialId: string,
): Promise<AlignResult> {
  if (inFlightAlign) return inFlightAlign
  inFlightAlign = alignWalletMaterialAfterLoginImpl(userId, credentialId).finally(() => {
    inFlightAlign = null
  })
  return inFlightAlign
}
