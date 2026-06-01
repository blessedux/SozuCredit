"use client"

import { ensureSmartWallet } from "@/lib/wallet/ensure-smart-wallet"
import { persistCanonicalWalletSession } from "@/lib/wallet/persist-wallet-session"

/**
 * Canonical wallet = OpenZeppelin passkey smart account (C…).
 * Migrates legacy G rows via ensureSmartWallet + server registration.
 */
export async function syncCanonicalWallet(
  userId: string,
  loginCredentialId?: string
): Promise<{ publicKey: string; walletType: "oz" | "factory" }> {
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
      signerPublicKey?: string | null
    }
    if (typeof data.publicKey === "string" && data.publicKey.length === 56) {
      dbPk = data.publicKey.trim().toUpperCase()
    } else if (
      data.walletMustMigrate &&
      typeof data.signerPublicKey === "string" &&
      data.signerPublicKey.startsWith("G")
    ) {
      dbPk = null
    }
    if (typeof data.walletType === "string") {
      dbWalletType = data.walletType
    }
  }

  if (dbPk?.startsWith("C") && credId) {
    try {
      const { getSmartAccountKit } = await import("@/lib/stellar/smartAccounts/client")
      const { kit } = await getSmartAccountKit()
      const contracts = await kit.discoverContractsByCredential(credId)
      const first = contracts?.[0] as { contract_id?: string; contractId?: string } | undefined
      const onChain =
        (typeof first?.contract_id === "string" ? first.contract_id : first?.contractId)
          ?.trim()
          .toUpperCase() ?? null
      if (onChain?.startsWith("C") && onChain.length === 56 && onChain !== dbPk) {
        console.warn("[syncCanonicalWallet] DB C ≠ passkey C — updating", {
          db: dbPk.slice(0, 12),
          onChain: onChain.slice(0, 12),
        })
        const { registerOzSmartAccount } = await import(
          "@/lib/stellar/smartAccounts/registerWalletClient"
        )
        const { deriveAndStoreKey } = await import("@/lib/storage/browser-keys")
        const { publicKey: signerG } = await deriveAndStoreKey(credId, userId)
        const { parsePasskeyPublicKey65 } = await import(
          "@/lib/stellar/smartAccounts/passkeyPublicKey"
        )
        const primaryRes = await fetch("/api/auth/passkeys/primary", {
          headers: { "x-user-id": userId },
        })
        const primary = (await primaryRes.json().catch(() => ({}))) as {
          publicKey65b?: string
        }
        if (primary.publicKey65b) {
          await registerOzSmartAccount({
            contractId: onChain,
            credentialId: credId,
            publicKey: parsePasskeyPublicKey65(primary.publicKey65b),
            signerPublicKey: signerG,
          })
        }
        persistCanonicalWalletSession(onChain, "oz", credId)
        return { publicKey: onChain, walletType: "oz" }
      }
    } catch (e) {
      console.warn("[syncCanonicalWallet] passkey C verify skipped:", e)
    }

    const wt = dbWalletType || sessionStorage.getItem("wallet_type") || "oz"
    persistCanonicalWalletSession(dbPk, wt === "factory" ? "factory" : "oz", credId ?? undefined)
    return {
      publicKey: dbPk,
      walletType: wt === "factory" ? "factory" : "oz",
    }
  }

  if (dbPk?.startsWith("G")) {
    console.warn("[syncCanonicalWallet] DB still has legacy G — provisioning factory C")
  }

  const ensured = await ensureSmartWallet(userId, credId ?? undefined)
  persistCanonicalWalletSession(ensured.publicKey, ensured.walletType, ensured.credentialId)
  return ensured
}
