"use client"

import { getSmartAccountKit } from "@/lib/stellar/smartAccounts/client"
import { linkMemberWalletWithLoginPasskey } from "@/lib/stellar/smartAccounts/linkMemberWallet"
import { registerOzSmartAccount } from "@/lib/stellar/smartAccounts/registerWalletClient"
import { getCurrentCredentialId } from "@/lib/storage/key-utils"
import { persistCanonicalWalletSession } from "@/lib/wallet/persist-wallet-session"

export type EnsureSmartWalletResult = {
  publicKey: string
  walletType: "oz" | "factory"
  credentialId?: string
}

async function resolveSignerPublicKey(
  userId: string,
  loginCredentialId?: string
): Promise<string> {
  const fromSession =
    typeof window !== "undefined"
      ? sessionStorage.getItem("stellar_public_key")?.trim().toUpperCase()
      : null
  if (fromSession?.startsWith("G") && fromSession.length === 56) {
    return fromSession
  }

  const credId =
    loginCredentialId?.trim() ||
    (typeof window !== "undefined" ? sessionStorage.getItem("credential_id") : null) ||
    (await getCurrentCredentialId(undefined))

  if (credId) {
    const { deriveAndStoreKey } = await import("@/lib/storage/browser-keys")
    const { publicKey } = await deriveAndStoreKey(credId, userId)
    return publicKey.trim().toUpperCase()
  }

  throw new Error("No passkey signer available for smart wallet setup.")
}

async function provisionFactorySmartAccount(
  userId: string,
  signerPublicKey: string
): Promise<{ contractId: string; walletType: "factory" }> {
  const g = signerPublicKey.trim().toUpperCase()
  const provRes = await fetch("/api/wallet/smart-account/provision", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId,
    },
    body: JSON.stringify({ signerPublicKey: g }),
  })
  const provData = (await provRes.json().catch(() => ({}))) as {
    contractId?: string
    error?: string
  }
  if (provRes.ok && provData.contractId?.startsWith("C")) {
    return { contractId: provData.contractId.trim().toUpperCase(), walletType: "factory" }
  }

  const createRes = await fetch("/api/wallet/stellar/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId,
    },
    body: JSON.stringify({ publicKey: g }),
  })
  const createData = (await createRes.json().catch(() => ({}))) as {
    publicKey?: string
    error?: string
    smartAccountProvisioned?: boolean
  }
  if (!createRes.ok) {
    throw new Error(createData.error ?? "Failed to register smart wallet")
  }
  const pk = typeof createData.publicKey === "string" ? createData.publicKey.trim().toUpperCase() : ""
  if (!pk.startsWith("C")) {
    throw new Error(
      createData.error ??
        "Smart account (C…) is required. Configure OpenZeppelin (OZ_*) or SMART_ACCOUNT_FACTORY_ID on the server.",
    )
  }
  return {
    contractId: pk,
    walletType: createData.smartAccountProvisioned ? "factory" : "oz",
  }
}

/**
 * Provision or link OpenZeppelin passkey smart account (C). Never returns a G address.
 */
export async function ensureSmartWallet(
  userId: string,
  loginCredentialId?: string
): Promise<EnsureSmartWalletResult> {
  const credId =
    loginCredentialId?.trim() ||
    (typeof window !== "undefined" ? sessionStorage.getItem("credential_id") : null) ||
    (await getCurrentCredentialId(undefined)) ||
    undefined

  const signerG = await resolveSignerPublicKey(userId, credId)

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
      signerPublicKey: signerG,
    })

    persistCanonicalWalletSession(linked.contractId, "oz", linked.credentialId)

    return {
      publicKey: linked.contractId.trim().toUpperCase(),
      walletType: "oz",
      credentialId: linked.credentialId,
    }
  } catch (ozErr) {
    console.warn("[ensureSmartWallet] OZ smart account path failed:", ozErr)
  }

  const { contractId, walletType } = await provisionFactorySmartAccount(userId, signerG)
  persistCanonicalWalletSession(contractId, walletType, credId)

  return {
    publicKey: contractId,
    walletType,
    credentialId: credId,
  }
}
