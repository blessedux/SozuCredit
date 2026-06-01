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
 * Address for deposit QR / copy — always prefer Soroban smart account (C…).
 * Syncs from server when storage only has legacy G.
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
      const { syncCanonicalWallet } = await import("@/lib/wallet/sync-canonical-wallet")
      const { publicKey, walletType } = await syncCanonicalWallet(userId, credId ?? undefined)
      const pk = publicKey.trim().toUpperCase()
      if (pk.startsWith("C")) {
        persistCanonicalWalletSession(pk, walletType, credId ?? undefined)
        return { address: pk, source: "sync" }
      }
    } catch (err) {
      console.warn("[Deposit] syncCanonicalWallet failed:", err)
    }

    let signerG: string | null = null
    try {
      const { deriveAndStoreKey } = await import("@/lib/storage/browser-keys")
      if (credId) {
        const { publicKey } = await deriveAndStoreKey(credId, userId)
        signerG = publicKey.trim().toUpperCase()
      }
    } catch {
      // ignore
    }
    if (signerG?.startsWith("G")) {
      try {
        const res = await fetch("/api/wallet/smart-account/provision", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": userId,
          },
          body: JSON.stringify({ signerPublicKey: signerG }),
        })
        const data = (await res.json().catch(() => ({}))) as { contractId?: string }
        const c = data.contractId?.trim().toUpperCase()
        if (c?.startsWith("C")) {
          persistCanonicalWalletSession(c, "factory", credId ?? undefined)
          return { address: c, source: "sync" }
        }
      } catch (provErr) {
        console.warn("[Deposit] factory provision failed:", provErr)
      }
    }
  }

  const legacy = walletAddressProp?.trim().toUpperCase()
  if (legacy?.startsWith("G") && legacy.length === 56) {
    return { address: legacy, source: "legacy" }
  }

  return { address: "", source: "legacy" }
}
