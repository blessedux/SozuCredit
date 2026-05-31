"use client"

import { checkAccountStatus } from "@/lib/stellar/wallet-creator"

const ACTIVATION_COMPLETE_KEY = "sozu_wallet_activation_complete"

export function isSmartContractWalletAddress(
  publicKey: string | null | undefined,
): boolean {
  const pk = publicKey?.trim().toUpperCase()
  return !!pk && pk.startsWith("C") && pk.length === 56
}

export function markWalletActivationComplete(): void {
  if (typeof window === "undefined") return
  localStorage.setItem(ACTIVATION_COMPLETE_KEY, "1")
  sessionStorage.removeItem("sozu_auto_activate")
}

async function fetchDbWalletPublicKey(userId: string): Promise<{
  publicKey: string | null
  walletType: string | null
}> {
  try {
    const res = await fetch("/api/wallet/stellar/address", {
      headers: { "x-user-id": userId },
    })
    if (!res.ok) return { publicKey: null, walletType: null }
    const data = (await res.json()) as {
      publicKey?: string | null
      walletType?: string | null
    }
    const pk =
      typeof data.publicKey === "string" ? data.publicKey.trim().toUpperCase() : null
    return {
      publicKey: pk && pk.length === 56 ? pk : null,
      walletType: typeof data.walletType === "string" ? data.walletType : null,
    }
  } catch {
    return { publicKey: null, walletType: null }
  }
}

/**
 * Classic G testnet activation slides (friendbot + USDC trustline).
 * Smart accounts (C…) are provisioned at passkey login — never show this flow.
 */
export async function needsWalletActivationOnboarding(params: {
  walletAddress: string | null | undefined
  walletNetwork: string
  userId?: string | null
}): Promise<boolean> {
  const { walletAddress, walletNetwork, userId } = params

  if (walletNetwork !== "testnet") return false
  if (!walletAddress?.trim()) return false

  const pk = walletAddress.trim().toUpperCase()

  if (typeof window !== "undefined") {
    if (localStorage.getItem(ACTIVATION_COMPLETE_KEY) === "1") return false

    const stored =
      localStorage.getItem("stellar_public_key") ??
      sessionStorage.getItem("stellar_public_key")
    if (isSmartContractWalletAddress(stored)) {
      markWalletActivationComplete()
      return false
    }
  }

  if (isSmartContractWalletAddress(pk)) {
    markWalletActivationComplete()
    return false
  }

  if (userId) {
    const db = await fetchDbWalletPublicKey(userId)
    if (isSmartContractWalletAddress(db.publicKey)) {
      if (typeof window !== "undefined" && db.publicKey) {
        localStorage.setItem("stellar_public_key", db.publicKey)
        sessionStorage.setItem("stellar_public_key", db.publicKey)
        if (db.walletType) sessionStorage.setItem("wallet_type", db.walletType)
        sessionStorage.removeItem("wallet_sync_pending")
      }
      markWalletActivationComplete()
      return false
    }
  }

  // Legacy G only: Horizon account + Circle USDC trustline
  if (!pk.startsWith("G") || pk.length !== 56) return false

  try {
    const info = await checkAccountStatus(pk)
    const needed = !(info.exists && info.hasUSDCTrustline)
    if (!needed) markWalletActivationComplete()
    return needed
  } catch {
    return true
  }
}
