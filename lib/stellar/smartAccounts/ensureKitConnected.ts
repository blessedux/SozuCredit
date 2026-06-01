"use client"

import type { SmartAccountKit } from "smart-account-kit"
import { isOzContractDeployedOnChain } from "@/lib/stellar/smartAccounts/deployOzForUser"
import { parsePasskeyPublicKey65 } from "@/lib/stellar/smartAccounts/passkeyPublicKey"
import { normalizeCredentialId } from "@/lib/webauthn/normalize-credential-id"
import { getUserId } from "@/lib/wallet-utils"

type KitInternals = {
  rpcUrl: string
  setConnectedState?: (contractId: string, credentialId: string) => void
  initializeWallet?: (contractId: string) => void
}

/**
 * smart-account-kit connectWallet overwrites the passed contractId with IndexedDB
 * credential.contractId (often empty → kit derives hash(credentialId) only).
 * Before signing, pin the funded user-scoped C on the credential and connect.
 */
export async function ensureKitConnectedForSend(
  kit: SmartAccountKit,
  credentialId: string,
  contractId: string,
): Promise<void> {
  const c = contractId.trim().toUpperCase()
  const cred = credentialId.trim()
  if (!c.startsWith("C") || c.length !== 56) {
    throw new Error("Smart account contract id (C…) required for signing.")
  }

  const internals = kit as unknown as KitInternals
  // Guard with a short timeout so a slow/unreachable RPC doesn't block the passkey.
  // kit.connectWallet will surface a clearer error if the account truly isn't deployed.
  try {
    const deployed = await Promise.race<boolean>([
      isOzContractDeployedOnChain(internals.rpcUrl, c),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 3_000)),
    ])
    if (!deployed) {
      throw new Error(
        `Smart account ${c.slice(0, 12)}… is not on Soroban RPC for this network. ` +
          "Finish wallet setup on the same URL you used to register, then retry.",
      )
    }
  } catch (deployCheckErr) {
    const msg = deployCheckErr instanceof Error ? deployCheckErr.message : ""
    if (msg.includes("is not on Soroban RPC")) throw deployCheckErr
    // Network/timeout error — proceed and let kit.connectWallet handle it.
    if (process.env.NODE_ENV === "development") {
      console.warn("[ensureKitConnectedForSend] isOzContractDeployedOnChain check failed (proceeding):", msg)
    }
  }

  const norm = normalizeCredentialId(cred)
  let publicKey: Uint8Array | null = null
  try {
    const all = await kit.credentials.getAll()
    const stored = all.find((x) => normalizeCredentialId(x.credentialId) === norm)
    if (stored?.publicKey?.length === 65) publicKey = stored.publicKey
  } catch {
    /* optional */
  }

  if (!publicKey) {
    const userId = getUserId()
    if (userId) {
      const res = await fetch("/api/auth/passkeys/primary", {
        headers: { "x-user-id": userId },
      })
      const data = (await res.json().catch(() => ({}))) as { publicKey65b?: string }
      if (data.publicKey65b) {
        publicKey = parsePasskeyPublicKey65(data.publicKey65b)
      }
    }
  }

  if (!publicKey) {
    throw new Error("Passkey public key missing. Sign in again.")
  }

  await kit.credentials.save({ credentialId: cred, publicKey, contractId: c })

  try {
    await kit.connectWallet({ prompt: false, credentialId: cred, contractId: c })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!msg.includes("not found on-chain")) throw e
    internals.setConnectedState?.(c, cred)
    internals.initializeWallet?.(c)
  }
}
