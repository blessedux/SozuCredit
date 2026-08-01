"use client"

import { persistCanonicalWalletSession } from "@/lib/wallet/persist-wallet-session"

const STELLAR_KEY = "stellar_public_key"

/** C smart account from local/session storage (never returns G). */
export function getStoredSmartAccountAddress(): string | null {
  if (typeof window === "undefined") return null
  for (const store of [sessionStorage, localStorage]) {
    const pk = store.getItem(STELLAR_KEY)?.trim().toUpperCase()
    if (pk?.startsWith("C") && pk.length === 56) return pk
  }
  return null
}

function pickBestAddress(
  prop?: string | null,
  stored?: string | null,
): string | null {
  const p = prop?.trim().toUpperCase()
  const s = stored?.trim().toUpperCase()
  if (p?.startsWith("C") && p.length === 56) return p
  if (s?.startsWith("C") && s.length === 56) return s
  return null
}

/**
 * Address for deposit QR / copy — prefer Soroban smart account (C…).
 * Read-only: does not provision. Setup Incomplete owns create.
 */
export async function resolveDepositReceiveAddress(
  walletAddressProp?: string | null,
  userId?: string | null,
): Promise<{ address: string; source: "prop" | "storage" | "sync" | "legacy" }> {
  const stored = getStoredSmartAccountAddress()
  const fromPropOrStore = pickBestAddress(walletAddressProp, stored)
  if (fromPropOrStore) {
    return {
      address: fromPropOrStore,
      source: walletAddressProp?.trim().toUpperCase().startsWith("C") ? "prop" : "storage",
    }
  }

  if (userId) {
    const credId =
      sessionStorage.getItem("credential_id") ?? localStorage.getItem("credential_id")
    try {
      const { loadCanonicalWallet } = await import("@/lib/wallet/sync-canonical-wallet")
      const loaded = await loadCanonicalWallet(userId, credId ?? undefined)
      const pk = loaded?.publicKey.trim().toUpperCase()
      if (pk?.startsWith("C") && loaded) {
        persistCanonicalWalletSession(pk, loaded.walletType, credId ?? undefined)
        return { address: pk, source: "sync" }
      }
    } catch (err) {
      console.info("[Deposit] No Smart Account to show yet:", err instanceof Error ? err.message : err)
    }
  }

  return { address: "", source: "legacy" }
}
