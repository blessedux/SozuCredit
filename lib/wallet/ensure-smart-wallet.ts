"use client"

import { getSmartAccountKit } from "@/lib/stellar/smartAccounts/client"
import { linkMemberWalletWithLoginPasskey } from "@/lib/stellar/smartAccounts/linkMemberWallet"
import { registerOzSmartAccount } from "@/lib/stellar/smartAccounts/registerWalletClient"
import { getCurrentCredentialId } from "@/lib/storage/key-utils"
import { persistCanonicalWalletSession } from "@/lib/wallet/persist-wallet-session"

export type EnsureSmartWalletResult = {
  publicKey: string
  walletType: "oz"
  credentialId?: string
}

async function resolveSignerPublicKey(
  userId: string,
  loginCredentialId?: string,
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

/**
 * Wallet Provisioning — OpenZeppelin passkey Smart Account only (ADR 0001).
 * Call from Auth or an explicit Finish setup CTA. Never from Home remount.
 */
export async function ensureSmartWallet(
  userId: string,
  loginCredentialId?: string,
): Promise<EnsureSmartWalletResult> {
  const credId =
    loginCredentialId?.trim() ||
    (typeof window !== "undefined" ? sessionStorage.getItem("credential_id") : null) ||
    (await getCurrentCredentialId(undefined)) ||
    undefined

  const signerG = await resolveSignerPublicKey(userId, credId)
  const { kit } = await getSmartAccountKit()

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

  try {
    const linked = await linkMemberWalletWithLoginPasskey({
      kit,
      connect,
      loginCredentialId: credId ?? undefined,
      userId,
    })

    await registerOzSmartAccount({
      contractId: linked.contractId,
      credentialId: linked.credentialId,
      publicKey: linked.publicKey,
      signerPublicKey: signerG,
    })

    const contractId = linked.contractId.trim().toUpperCase()
    persistCanonicalWalletSession(contractId, "oz", linked.credentialId)

    return {
      publicKey: contractId,
      walletType: "oz",
      credentialId: linked.credentialId,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(
      `Could not create smart wallet (C…). ${msg}. Check OZ_* env and Soroban RPC, then use Finish setup.`,
    )
  }
}
