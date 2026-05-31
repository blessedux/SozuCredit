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
  const contracts = await kit.discoverContractsByCredential(credentialId)
  return extractContractId(contracts?.[0]) ?? null
}

async function deployMemberContract(kit: SmartAccountKit, credentialId: string): Promise<void> {
  const userId = getUserId()
  if (!userId) throw new Error("PASSKEY_PUBLIC_KEY_MISSING")
  const res = await fetch("/api/auth/passkeys/primary", {
    headers: { "x-user-id": userId },
  })
  const primary = (await res.json().catch(() => ({}))) as { publicKey65b?: string }
  if (!res.ok || !primary.publicKey65b) {
    throw new Error("PASSKEY_PUBLIC_KEY_MISSING")
  }
  const publicKey = new Uint8Array(base64URLToBuffer(primary.publicKey65b))
  await kit.credentials.save({ credentialId, publicKey })
  await kit.credentials.deploy(credentialId, { autoSubmit: true })
}

export async function linkMemberWalletWithLoginPasskey(params: {
  kit: SmartAccountKit
  connect: ConnectFn
  loginCredentialId?: string
}): Promise<{ contractId: string; credentialId: string; publicKey: Uint8Array }> {
  const { kit, connect, loginCredentialId: expectedLoginId } = params
  let credentialId = expectedLoginId?.trim() || null

  if (credentialId) {
    try {
      return await finishLink(await connect({ credentialId }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!isNotDeployedError(msg)) throw e
    }
    const existingId = await discoverFirstContractId(kit, credentialId)
    if (existingId) {
      return await finishLink(await connect({ credentialId, contractId: existingId }))
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
    try {
      return await finishLink(await connect({ credentialId }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!isNotDeployedError(msg)) throw e
    }
    const existingId = await discoverFirstContractId(kit, credentialId)
    if (existingId) {
      return await finishLink(await connect({ credentialId, contractId: existingId }))
    }
  }

  if (!credentialId) throw new Error("PASSKEY_WALLET_NOT_LINKED")

  await deployMemberContract(kit, credentialId)
  return await finishLink(await connect({ credentialId }))
}
