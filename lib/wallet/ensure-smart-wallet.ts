"use client"

import { getSmartAccountKit } from "@/lib/stellar/smartAccounts/client"
import { linkMemberWalletWithLoginPasskey } from "@/lib/stellar/smartAccounts/linkMemberWallet"
import { registerOzSmartAccount } from "@/lib/stellar/smartAccounts/registerWalletClient"
import { getCurrentCredentialId } from "@/lib/storage/key-utils"

export type EnsureSmartWalletResult = {
  publicKey: string
  walletType: "oz" | "factory" | "legacy"
  credentialId?: string
}

/**
 * Prefer OpenZeppelin passkey smart account (C); fall back to factory + G signer.
 */
export async function ensureSmartWallet(
  userId: string,
  loginCredentialId?: string
): Promise<EnsureSmartWalletResult> {
  const credId =
    loginCredentialId?.trim() ||
    (typeof window !== "undefined" ? sessionStorage.getItem("credential_id") : null) ||
    (await getCurrentCredentialId(undefined))

  try {
    const { kit, config } = await getSmartAccountKit()
    const connect = async (opts?: {
      prompt?: boolean
      credentialId?: string
      contractId?: string
    }) => {
      const res = await kit.connectWallet(opts)
      if (!res?.contractId) {
        return { contractId: null, credentialId: null, publicKey: null }
      }
      return {
        contractId: res.contractId,
        credentialId: res.credentialId ?? null,
        publicKey: res.credential?.publicKey ?? null,
      }
    }

    const linked = await linkMemberWalletWithLoginPasskey({
      kit,
      connect,
      loginCredentialId: credId ?? undefined,
    })

    await registerOzSmartAccount({
      contractId: linked.contractId,
      credentialId: linked.credentialId,
      publicKey: linked.publicKey,
    })

    if (typeof window !== "undefined") {
      sessionStorage.setItem("stellar_public_key", linked.contractId)
      sessionStorage.setItem("credential_id", linked.credentialId)
      sessionStorage.setItem("wallet_type", "oz")
    }

    return {
      publicKey: linked.contractId,
      walletType: "oz",
      credentialId: linked.credentialId,
    }
  } catch (ozErr) {
    console.warn("[ensureSmartWallet] OZ smart account skipped:", ozErr)
  }

  const g =
    typeof window !== "undefined" ? sessionStorage.getItem("stellar_public_key")?.trim() : null
  if (!g?.startsWith("G")) {
    throw new Error("No Stellar signer key available for wallet provisioning.")
  }

  const createRes = await fetch("/api/wallet/stellar/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId,
    },
    body: JSON.stringify({ publicKey: g }),
  })
  const createData = await createRes.json().catch(() => ({}))
  if (!createRes.ok) {
    throw new Error(createData.error ?? "Failed to register wallet")
  }

  const pk = typeof createData.publicKey === "string" ? createData.publicKey : g
  const walletType: EnsureSmartWalletResult["walletType"] = pk.startsWith("C")
    ? createData.smartAccountProvisioned
      ? "factory"
      : "oz"
    : "legacy"

  if (typeof window !== "undefined") {
    sessionStorage.setItem("stellar_public_key", pk)
    sessionStorage.setItem("wallet_type", walletType)
  }

  return { publicKey: pk, walletType, credentialId: credId ?? undefined }
}
