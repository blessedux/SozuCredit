import "server-only"

import { Client as SmartAccountClient } from "smart-account-kit-bindings"
import { Networks, scValToNative } from "@stellar/stellar-sdk"
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

/**
 * True only for OpenZeppelin smart-account-kit contracts that expose get_context_rules.
 * Factory-deployed C wallets (no such method) must use G-signer + authorizeEntry instead.
 */
export async function contractSupportsOzKitSigning(contractId: string): Promise<boolean> {
  const id = contractId.trim().toUpperCase()
  if (!id.startsWith("C") || id.length !== 56) return false

  try {
    getOzSmartAccountConfig()
  } catch {
    return false
  }

  const rpcUrl = sorobanRpcUrl()
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
    const sim = assembled.simulation
    if (sim == null || Api.isSimulationError(sim) || !sim.result?.retval) return false
    const rules = scValToNative(sim.result.retval)
    return Array.isArray(rules)
  } catch {
    return false
  }
}
