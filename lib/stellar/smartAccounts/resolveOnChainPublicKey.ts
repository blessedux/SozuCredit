import "server-only"

import { Client as SmartAccountClient } from "smart-account-kit-bindings"
import { Networks } from "@stellar/stellar-sdk"
import { buildContextRuleTypesFromAuthEntry } from "@/lib/stellar/smartAccounts/contextRuleTypes"
import {
  credentialIdToBuffer,
  extractCredentialIdFromKeyData,
  extractPublicKeyFromKeyData,
  publicKeyToBase64Url,
} from "@/lib/stellar/smartAccounts/passkeyPublicKey"
import { normalizeCredentialId } from "@/lib/webauthn/normalize-credential-id"
import type { xdr } from "@stellar/stellar-sdk"

function getRpcUrl(): string {
  return (
    process.env.SOROBAN_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim() ||
    (process.env.STELLAR_NETWORK === "public"
      ? "https://soroban-mainnet.stellar.org"
      : "https://soroban-testnet.stellar.org")
  )
}

function getNetworkPassphrase(): string {
  return process.env.STELLAR_NETWORK === "public" ? Networks.PUBLIC : Networks.TESTNET
}

function credentialSuffixMatches(suffix: Uint8Array, credentialId: string): boolean {
  const norm = normalizeCredentialId(credentialId)
  try {
    const b64 = Buffer.from(suffix).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
    if (normalizeCredentialId(b64) === norm) return true
  } catch {
    /* ignore */
  }
  try {
    return Buffer.compare(Buffer.from(suffix), credentialIdToBuffer(credentialId)) === 0
  } catch {
    return false
  }
}

function findKeyDataInRules(
  rules: unknown,
  credentialId: string,
): Buffer | null {
  if (!Array.isArray(rules)) return null
  for (const rule of rules) {
    const signers = (rule as { signers?: Array<{ tag: string; values: unknown[] }> }).signers ?? []
    for (const signer of signers) {
      if (signer.tag !== "External") continue
      const raw = signer.values[1]
      if (!raw) continue
      const keyDataBytes =
        raw instanceof Uint8Array ? Buffer.from(raw) : Buffer.from(raw as ArrayLike<number>)
      if (keyDataBytes.length <= 65) continue
      const suffix = keyDataBytes.subarray(65)
      if (credentialSuffixMatches(suffix, credentialId)) {
        return keyDataBytes
      }
    }
  }
  return null
}

/**
 * Full External signer keyData (65-byte pubkey + credential id suffix) from chain.
 */
export async function resolveOnChainSignerKeyData(params: {
  contractId: string
  credentialId: string
  authEntry?: xdr.SorobanAuthorizationEntry
}): Promise<Buffer | null> {
  const contractId = params.contractId.trim()
  const credentialId = params.credentialId.trim()
  if (!contractId.startsWith("C") || !credentialId) return null

  const rpcUrl = getRpcUrl()
  const client = new SmartAccountClient({
    contractId,
    networkPassphrase: getNetworkPassphrase(),
    rpcUrl,
    allowHttp: rpcUrl.startsWith("http://"),
  })

  const contextTypes = params.authEntry
    ? buildContextRuleTypesFromAuthEntry(params.authEntry)
    : [{ tag: "Default" as const, values: undefined }]

  try {
    for (const contextRuleType of contextTypes) {
      const tx = await client.get_context_rules({ context_rule_type: contextRuleType })
      await tx.simulate()
      const found = findKeyDataInRules(tx.result, credentialId)
      if (found) return found
    }
  } catch {
    return null
  }

  return null
}

export async function resolveOnChainPasskeyPublicKey(params: {
  contractId: string
  credentialId: string
  authEntry?: xdr.SorobanAuthorizationEntry
}): Promise<string | null> {
  const keyData = await resolveOnChainSignerKeyData(params)
  if (!keyData || keyData.length < 66) return null
  return publicKeyToBase64Url(extractPublicKeyFromKeyData(keyData))
}
