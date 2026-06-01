import "server-only"

import { Client as SmartAccountClient } from "smart-account-kit-bindings"
import { Networks } from "@stellar/stellar-sdk"
import { Api } from "@stellar/stellar-sdk/rpc"
import { getOzSmartAccountConfig } from "@/lib/stellar/smartAccounts/ozConfig"

function sorobanRpcUrl(): string {
  return (
    process.env.SOROBAN_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim() ||
    (process.env.STELLAR_NETWORK === "public"
      ? "https://soroban-mainnet.stellar.org"
      : "https://soroban-testnet.stellar.org")
  )
}

function networkPassphrase(): string {
  return process.env.STELLAR_NETWORK === "public" ? Networks.PUBLIC : Networks.TESTNET
}

/** In-memory TTL cache so we don't re-simulate on every send for the same C account. */
const _cache = new Map<string, { result: boolean; expiresAt: number }>()
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

/**
 * True only for OpenZeppelin smart-account-kit contracts that expose get_context_rules.
 * Factory-deployed C wallets (no such method) must use G-signer + authorizeEntry instead.
 *
 * NOTE: tx.simulate() does NOT throw on Soroban contract-level errors (e.g. WasmVm.MissingValue
 * when the method doesn't exist). We must check Api.isSimulationError on the result to know
 * whether the method is actually present and callable.
 */
export async function contractSupportsOzKitSigning(contractId: string): Promise<boolean> {
  const id = contractId.trim().toUpperCase()
  if (!id.startsWith("C") || id.length !== 56) return false

  try {
    getOzSmartAccountConfig()
  } catch {
    return false
  }

  const cached = _cache.get(id)
  if (cached && Date.now() < cached.expiresAt) return cached.result

  const rpcUrl = sorobanRpcUrl()
  let result: boolean
  try {
    const client = new SmartAccountClient({
      contractId: id,
      networkPassphrase: networkPassphrase(),
      rpcUrl,
      allowHttp: rpcUrl.startsWith("http://"),
    })
    const tx = await client.get_context_rules({
      context_rule_type: { tag: "Default", values: undefined },
    })
    const assembled = await tx.simulate()
    // A simulation error (e.g. WasmVm.MissingValue) means the method does NOT exist.
    // Only return true if the simulation genuinely succeeded.
    const sim = assembled.simulation
    result = !(!sim || Api.isSimulationError(sim))
  } catch {
    result = false
  }
  _cache.set(id, { result, expiresAt: Date.now() + CACHE_TTL_MS })
  return result
}
