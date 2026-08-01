"use client"

import { persistCanonicalWalletSession } from "@/lib/wallet/persist-wallet-session"
import { discoverFirstContractIdSafe } from "@/lib/stellar/smartAccounts/discover-contracts"

export type LoadedCanonicalWallet = {
  publicKey: string
  walletType: "oz" | "factory"
}

function sessionC(): string | null {
  if (typeof window === "undefined") return null
  const pk = (
    sessionStorage.getItem("stellar_public_key") ?? localStorage.getItem("stellar_public_key")
  )
    ?.trim()
    .toUpperCase()
  return pk?.startsWith("C") && pk.length === 56 ? pk : null
}

/**
 * Read-only: resolve the user's Smart Account from DB / session.
 * Does **not** deploy. Home remounts use this. Provisioning is Auth / Finish setup.
 *
 * @see docs/adr/0001-auth-owned-oz-wallet-provisioning.md
 */
export async function loadCanonicalWallet(
  userId: string,
  loginCredentialId?: string,
): Promise<LoadedCanonicalWallet | null> {
  const credId =
    loginCredentialId?.trim() ||
    (typeof window !== "undefined"
      ? sessionStorage.getItem("credential_id") ?? localStorage.getItem("credential_id")
      : null) ||
    undefined

  const addrRes = await fetch("/api/wallet/stellar/address", {
    headers: { "x-user-id": userId },
  })

  let dbPk: string | null = null
  let dbWalletType: string | null = null
  if (addrRes.ok) {
    const data = (await addrRes.json()) as {
      publicKey?: string | null
      walletType?: string | null
      walletMustMigrate?: boolean
    }
    if (typeof data.publicKey === "string" && data.publicKey.length === 56) {
      dbPk = data.publicKey.trim().toUpperCase()
    }
    if (data.walletMustMigrate) {
      dbPk = null
    }
    if (typeof data.walletType === "string") {
      dbWalletType = data.walletType
    }
  }

  if (dbPk?.startsWith("C")) {
    const wt = (dbWalletType || sessionStorage.getItem("wallet_type") || "oz") === "factory"
      ? "factory"
      : "oz"
    const localC = sessionC()

    // Fast path: session matches DB — skip indexer.
    if (localC === dbPk) {
      persistCanonicalWalletSession(dbPk, wt, credId)
      return { publicKey: dbPk, walletType: wt }
    }

    // Best-effort drift hint only (ADR: Contract Indexer is not source of truth).
    if (credId && sessionStorage.getItem("wallet_sync_pending") !== "1") {
      try {
        const { getSmartAccountKit } = await import("@/lib/stellar/smartAccounts/client")
        const { kit } = await getSmartAccountKit()
        const onChain = await discoverFirstContractIdSafe(kit, credId, {
          logLabel: "loadCanonicalWallet",
        })
        if (onChain && onChain !== dbPk) {
          console.info("[loadCanonicalWallet] Indexer C differs from DB — keeping DB", {
            db: dbPk.slice(0, 12),
            onChain: onChain.slice(0, 12),
          })
        }
      } catch {
        /* ignore */
      }
    }

    persistCanonicalWalletSession(dbPk, wt, credId)
    return { publicKey: dbPk, walletType: wt }
  }

  // DB lag: Auth just provisioned — trust session C.
  const localC = sessionC()
  if (localC) {
    const wt = (sessionStorage.getItem("wallet_type") || "oz") === "factory" ? "factory" : "oz"
    return { publicKey: localC, walletType: wt }
  }

  return null
}

/**
 * @deprecated Prefer loadCanonicalWallet. Throws if no Smart Account (read-only).
 */
export async function syncCanonicalWallet(
  userId: string,
  loginCredentialId?: string,
): Promise<LoadedCanonicalWallet> {
  const loaded = await loadCanonicalWallet(userId, loginCredentialId)
  if (!loaded) {
    throw new Error("No smart account on file. Finish wallet setup.")
  }
  return loaded
}
