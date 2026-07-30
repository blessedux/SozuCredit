"use client"

import { checkAccountStatus } from "@/lib/stellar/wallet-creator"
import { getUserId } from "@/lib/wallet-utils"

const ACTIVATION_COMPLETE_KEY = "sozu_wallet_activation_complete"
const WELCOME_ONBOARDING_KEY_PREFIX = "sozu_welcome_onboarding_v1_"

export function isSmartContractWalletAddress(
  publicKey: string | null | undefined,
): boolean {
  const pk = publicKey?.trim().toUpperCase()
  return !!pk && pk.startsWith("C") && pk.length === 56
}

export function welcomeOnboardingStorageKey(userId: string): string {
  return `${WELCOME_ONBOARDING_KEY_PREFIX}${userId.trim()}`
}

export function hasCompletedWelcomeOnboarding(userId?: string | null): boolean {
  if (typeof window === "undefined") return true
  const id = userId?.trim() || getUserId()
  if (!id) return false
  return localStorage.getItem(welcomeOnboardingStorageKey(id)) === "1"
}

export function markWelcomeOnboardingComplete(userId?: string | null): void {
  if (typeof window === "undefined") return
  const id = userId?.trim() || getUserId()
  if (!id) return
  localStorage.setItem(welcomeOnboardingStorageKey(id), "1")
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
 * First-time welcome slides (testnet). Shown once per user id — independent of C vs G.
 * Already-funded wallets skip: mark complete and return false so Home + Pay are immediate.
 */
export function needsWelcomeOnboarding(params: {
  walletNetwork: string
  userId?: string | null
  /** When true, skip slides and persist completion. */
  hasFunds?: boolean
}): boolean {
  if (params.walletNetwork !== "testnet") return false
  const userId = params.userId?.trim() || getUserId()
  if (!userId) return false
  if (params.hasFunds) {
    markWelcomeOnboardingComplete(userId)
    return false
  }
  return !hasCompletedWelcomeOnboarding(userId)
}

/**
 * Classic G testnet activation (friendbot + USDC trustline).
 * Smart accounts (C…) skip this; they use welcome slides only.
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
  }

  if (isSmartContractWalletAddress(pk)) {
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
      return false
    }
  }

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
