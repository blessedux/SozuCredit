import "server-only"

import { Client as SmartAccountClient } from "smart-account-kit-bindings"
import { Networks, scValToNative } from "@stellar/stellar-sdk"
import { Api } from "@stellar/stellar-sdk/rpc"
import { buildContextRuleTypesFromAuthEntry } from "@/lib/stellar/smartAccounts/contextRuleTypes"
import {
  credentialIdToBuffer,
  extractPublicKeyFromKeyData,
  publicKeyToBase64Url,
} from "@/lib/stellar/smartAccounts/passkeyPublicKey"

const SECP256R1_PUBLIC_KEY_SIZE = 65
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

function simulationSucceeded(
  sim: Api.SimulateTransactionResponse | undefined,
): sim is Api.SimulateTransactionSuccessResponse {
  return sim != null && !Api.isSimulationError(sim)
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

function credentialIdAppearsInKeyData(keyData: Buffer, credentialId: string): boolean {
  if (keyData.length > 65 && credentialSuffixMatches(keyData.subarray(65), credentialId)) {
    return true
  }
  let needle: Buffer
  try {
    needle = credentialIdToBuffer(credentialId)
  } catch {
    return false
  }
  return keyData.includes(needle)
}

function externalKeyDataFromSigner(signer: unknown): Buffer | null {
  if (!Array.isArray(signer) || signer[0] !== "External" || !signer[2]) return null
  const raw = signer[2] as { data?: number[] } | Uint8Array | Buffer
  const bytes =
    raw instanceof Uint8Array
      ? Buffer.from(raw)
      : Buffer.isBuffer(raw)
        ? raw
        : Buffer.from((raw as { data: number[] }).data ?? [])
  return bytes.length > 0 ? bytes : null
}

function pickExternalKeyData(signers: unknown, credentialId: string): Buffer | null {
  if (!Array.isArray(signers)) return null
  const external: Buffer[] = []
  for (const signer of signers) {
    const keyData = externalKeyDataFromSigner(signer)
    if (keyData) external.push(keyData)
  }
  if (external.length === 0) return null

  for (const keyData of external) {
    if (credentialIdAppearsInKeyData(keyData, credentialId)) return keyData
  }

  return null
}

function findKeyDataInRules(
  rules: unknown,
  credentialId: string,
): Buffer | null {
  if (!Array.isArray(rules)) return null
  for (const rule of rules) {
    const signers = (rule as { signers?: unknown }).signers
    const found = pickExternalKeyData(signers, credentialId)
    if (found) return found
  }
  return null
}

function findKeyDataInContextRule(
  rule: unknown,
  credentialId: string,
): Buffer | null {
  if (!rule || typeof rule !== "object") return null
  const signers = (rule as { signers?: unknown }).signers
  return pickExternalKeyData(signers, credentialId)
}

async function readContextRuleById(
  client: SmartAccountClient,
  contextRuleId: number,
  credentialId: string,
): Promise<Buffer | null> {
  const tx = await client.get_context_rule({ context_rule_id: contextRuleId })
  const assembled = await tx.simulate()
  const sim = assembled.simulation
  if (!simulationSucceeded(sim) || !sim.result?.retval) return null
  const rule = scValToNative(sim.result.retval)
  return findKeyDataInContextRule(rule, credentialId)
}

/** True when get_context_rule(0) simulates (legacy OZ wallets without get_context_rules). */
export async function contractCanReadOnChainSignerKeyData(contractId: string): Promise<boolean> {
  const id = contractId.trim().toUpperCase()
  if (!id.startsWith("C") || id.length !== 56) return false
  const rpcUrl = getRpcUrl()
  try {
    const client = new SmartAccountClient({
      contractId: id,
      networkPassphrase: getNetworkPassphrase(),
      rpcUrl,
      allowHttp: rpcUrl.startsWith("http://"),
    })
    const tx = await client.get_context_rule({ context_rule_id: 0 })
    const assembled = await tx.simulate()
    return simulationSucceeded(assembled.simulation)
  } catch {
    return false
  }
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

  try {
    const fromRule0 = await readContextRuleById(client, 0, credentialId)
    if (fromRule0) return fromRule0
  } catch {
    /* try plural API */
  }

  const contextTypes = params.authEntry
    ? buildContextRuleTypesFromAuthEntry(params.authEntry)
    : [{ tag: "Default" as const, values: undefined }]

  try {
    for (const contextRuleType of contextTypes) {
      const tx = await client.get_context_rules({ context_rule_type: contextRuleType })
      const assembled = await tx.simulate()
      const sim = assembled.simulation
      if (!simulationSucceeded(sim) || !sim.result?.retval) continue
      const rules = scValToNative(sim.result.retval)
      const found = findKeyDataInRules(rules, credentialId)
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
