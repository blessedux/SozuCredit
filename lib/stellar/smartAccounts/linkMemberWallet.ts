"use client"

import type { SmartAccountKit } from "smart-account-kit"
import { base64URLToBuffer } from "@/lib/webauthn/utils"
import { normalizeCredentialId } from "@/lib/webauthn/normalize-credential-id"
import { resolvePublicKeyFromServer } from "@/lib/stellar/smartAccounts/registerWalletClient"
import { getUserId } from "@/lib/wallet-utils"

type ConnectResult = {
  contractId: string | null
  credentialId: string | null
  publicKey?: Uint8Array | null
}

type ConnectFn = (opts?: {
  prompt?: boolean
  credentialId?: string
  contractId?: string
}) => Promise<ConnectResult>

function isNotDeployedError(message: string): boolean {
  return (
    message.includes("not found on-chain") ||
    message.includes("not deployed") ||
    message.includes("not been deployed")
  )
}

function extractContractId(entry: unknown): string | null {
  if (!entry || typeof entry !== "object") return null
  if ("contract_id" in entry && typeof entry.contract_id === "string") {
    return entry.contract_id
  }
  if ("contractId" in entry && typeof entry.contractId === "string") {
    return entry.contractId
  }
  return null
}

async function resolveLoginPasskeyPublicKey(credentialId: string): Promise<Uint8Array | null> {
  const userId = getUserId()
  if (!userId) return null
  const res = await fetch("/api/auth/passkeys/primary", {
    headers: { "x-user-id": userId },
  })
  const data = (await res.json().catch(() => ({}))) as {
    credentialId?: string
    publicKey65b?: string
  }
  if (!res.ok || !data.publicKey65b) return null
  if (
    data.credentialId &&
    normalizeCredentialId(data.credentialId) !== normalizeCredentialId(credentialId)
  ) {
    return null
  }
  const { parsePasskeyPublicKey65 } = await import("@/lib/stellar/smartAccounts/passkeyPublicKey")
  try {
    return parsePasskeyPublicKey65(data.publicKey65b)
  } catch {
    return new Uint8Array(base64URLToBuffer(data.publicKey65b))
  }
}

async function finishLink(
  linked: ConnectResult
): Promise<{ contractId: string; credentialId: string; publicKey: Uint8Array }> {
  if (!linked.contractId || !linked.credentialId) {
    throw new Error("PASSKEY_WALLET_NOT_LINKED")
  }
  let publicKey =
    linked.publicKey ??
    (await resolveLoginPasskeyPublicKey(linked.credentialId)) ??
    null
  if (!publicKey) {
    try {
      publicKey = await resolvePublicKeyFromServer({
        contractId: linked.contractId,
        credentialId: linked.credentialId,
      })
    } catch {
      const fromPrimary = await resolveLoginPasskeyPublicKey(linked.credentialId)
      if (fromPrimary) publicKey = fromPrimary
      else throw new Error("PASSKEY_PUBLIC_KEY_MISSING")
    }
  }
  return {
    contractId: linked.contractId,
    credentialId: linked.credentialId,
    publicKey,
  }
}

async function discoverFirstContractId(
  kit: SmartAccountKit,
  credentialId: string
): Promise<string | null> {
  // SDF's public indexer is best-effort. A 5xx must not block first-time deploy —
  // we already resolve user-scoped contracts on-chain before calling this.
  try {
    const contracts = await kit.discoverContractsByCredential(credentialId)
    return extractContractId(contracts?.[0]) ?? null
  } catch (e) {
    console.warn(
      "[linkMemberWallet] Indexer discovery failed; continuing with on-chain deploy path:",
      e instanceof Error ? e.message : e,
    )
    return null
  }
}

async function resolveDeployPublicKey(
  kit: SmartAccountKit,
  credentialId: string,
): Promise<Uint8Array> {
  const norm = normalizeCredentialId(credentialId)
  try {
    const all = await kit.credentials.getAll()
    const stored = all.find(
      (c) => normalizeCredentialId(c.credentialId) === norm && c.publicKey?.length === 65,
    )
    if (stored?.publicKey) return stored.publicKey
  } catch {
    /* fall through */
  }

  const userId = getUserId()
  if (!userId) throw new Error("PASSKEY_PUBLIC_KEY_MISSING")
  const res = await fetch("/api/auth/passkeys/primary", {
    headers: { "x-user-id": userId },
  })
  const primary = (await res.json().catch(() => ({}))) as { publicKey65b?: string }
  if (!res.ok || !primary.publicKey65b) {
    throw new Error("PASSKEY_PUBLIC_KEY_MISSING")
  }
  const { parsePasskeyPublicKey65 } = await import("@/lib/stellar/smartAccounts/passkeyPublicKey")
  return parsePasskeyPublicKey65(primary.publicKey65b)
}

type KitAddressInternals = {
  deployerKeypair: { publicKey(): string }
  networkPassphrase: string
  rpcUrl: string
  setConnectedState?: (contractId: string, credentialId: string) => void
  initializeWallet?: (contractId: string) => void
}

async function linkUserScopedContractIfDeployed(
  kit: SmartAccountKit,
  connect: ConnectFn,
  credentialId: string,
  userId: string,
): Promise<{ contractId: string; credentialId: string; publicKey: Uint8Array } | null> {
  const { deriveOzContractIdForUser, isOzContractDeployedOnChain } = await import(
    "@/lib/stellar/smartAccounts/deployOzForUser"
  )
  const internals = kit as unknown as KitAddressInternals
  const expected = deriveOzContractIdForUser({
    credentialId,
    userId,
    networkPassphrase: internals.networkPassphrase,
    deployerPublicKey: internals.deployerKeypair.publicKey(),
  })

  if (!(await isOzContractDeployedOnChain(internals.rpcUrl, expected))) {
    return null
  }

  try {
    return await finishLink(await connect({ credentialId, contractId: expected }))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!isNotDeployedError(msg)) throw e
    const publicKey = await resolveDeployPublicKey(kit, credentialId)
    await kit.credentials.save({ credentialId, publicKey, contractId: expected })
    internals.setConnectedState?.(expected, credentialId)
    internals.initializeWallet?.(expected)
    return { contractId: expected, credentialId, publicKey }
  }
}

async function deployMemberContract(
  kit: SmartAccountKit,
  credentialId: string,
  userId: string,
): Promise<{ contractId: string; publicKey: Uint8Array }> {
  const publicKey = await resolveDeployPublicKey(kit, credentialId)
  await kit.credentials.save({ credentialId, publicKey })

  const { deployOzSmartAccountForUser } = await import(
    "@/lib/stellar/smartAccounts/deployOzForUser"
  )
  const { contractId } = await deployOzSmartAccountForUser({
    kit,
    credentialId,
    publicKey65: publicKey,
    userId,
  })
  await kit.credentials.save({ credentialId, publicKey, contractId })
  return { contractId, publicKey }
}

export async function linkMemberWalletWithLoginPasskey(params: {
  kit: SmartAccountKit
  connect: ConnectFn
  loginCredentialId?: string
  userId?: string
}): Promise<{ contractId: string; credentialId: string; publicKey: Uint8Array }> {
  const { kit, connect, loginCredentialId: expectedLoginId } = params
  const userId = params.userId?.trim() || getUserId()
  if (!userId) throw new Error("PASSKEY_PUBLIC_KEY_MISSING")

  let credentialId = expectedLoginId?.trim() || null

  if (credentialId) {
    const existing = await linkUserScopedContractIfDeployed(kit, connect, credentialId, userId)
    if (existing) return existing

    const existingId = await discoverFirstContractId(kit, credentialId)
    if (existingId) {
      try {
        return await finishLink(await connect({ credentialId, contractId: existingId }))
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (!isNotDeployedError(msg)) throw e
      }
    }
  } else {
    const { credentialId: authedId } = await kit.authenticatePasskey()
    credentialId = authedId
    if (
      expectedLoginId &&
      normalizeCredentialId(credentialId) !== normalizeCredentialId(expectedLoginId)
    ) {
      throw new Error("WRONG_PASSKEY")
    }
    const existing = await linkUserScopedContractIfDeployed(kit, connect, credentialId, userId)
    if (existing) return existing

    const existingId = await discoverFirstContractId(kit, credentialId)
    if (existingId) {
      try {
        return await finishLink(await connect({ credentialId, contractId: existingId }))
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (!isNotDeployedError(msg)) throw e
      }
    }
  }

  if (!credentialId) throw new Error("PASSKEY_WALLET_NOT_LINKED")

  const { contractId: deployedContractId, publicKey } = await deployMemberContract(
    kit,
    credentialId,
    userId,
  )
  const linked = {
    contractId: deployedContractId,
    credentialId,
    publicKey,
  }

  await verifyDeployedPubkey(linked.contractId, linked.credentialId, linked.publicKey)

  return linked
}

async function verifyDeployedPubkey(
  contractId: string,
  credentialId: string,
  expectedPublicKey: Uint8Array,
): Promise<void> {
  const userId = getUserId()
  const q = new URLSearchParams({ contractId, credentialId })
  const res = await fetch(`/api/smart-accounts/resolve-key-data?${q}`, {
    headers: userId ? { "x-user-id": userId } : {},
  })
  if (!res.ok) return
  const data = (await res.json().catch(() => ({}))) as { keyDataBase64?: string }
  if (!data.keyDataBase64) return

  const onChainBytes = Uint8Array.from(
    atob(data.keyDataBase64.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  )
  const onChainPubkey = onChainBytes.slice(0, 65)
  const matches = onChainPubkey.length === 65 && onChainPubkey.every((b, i) => b === expectedPublicKey[i])
  if (!matches) {
    throw new Error(
      "Smart wallet was deployed with a public key that does not match this passkey. Sign out, register again at the same URL (http://localhost:3001), then complete wallet setup.",
    )
  }
}
