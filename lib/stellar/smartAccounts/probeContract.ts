import "server-only"

import { Client as SmartAccountClient } from "smart-account-kit-bindings"
import { Networks } from "@stellar/stellar-sdk"
import { contractIsFactoryForSigner } from "@/lib/stellar/factory-smart-account"
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

export type SmartAccountProbe = {
  contractId: string
  hasGetContextRules: boolean
  hasGetContextRuleById: boolean
  ozConfigPresent: boolean
  isFactoryForSigner: boolean | null
  recommendedPath:
    | "oz_kit"
    | "oz_passkey_local"
    | "factory_g_signer"
    | "stuck_needs_recovery"
  notes: string[]
}

async function simulatesOk(run: () => Promise<{ simulate: () => Promise<unknown> }>): Promise<boolean> {
  try {
    const tx = await run()
    await tx.simulate()
    return true
  } catch {
    return false
  }
}

/**
 * Probe which Soroban methods exist on a C wallet (read-only simulations).
 */
export async function probeSmartAccountContract(
  contractId: string,
  signerG?: string | null,
): Promise<SmartAccountProbe> {
  const id = contractId.trim().toUpperCase()
  const notes: string[] = []
  if (!id.startsWith("C")) {
    return {
      contractId: id,
      hasGetContextRules: false,
      hasGetContextRuleById: false,
      ozConfigPresent: false,
      isFactoryForSigner: null,
      recommendedPath: "stuck_needs_recovery",
      notes: ["Not a contract address (C…)."],
    }
  }

  let ozConfigPresent = false
  try {
    getOzSmartAccountConfig()
    ozConfigPresent = true
  } catch {
    notes.push("OZ env (verifier / WASM hash) not fully configured on server.")
  }

  const rpcUrl = sorobanRpcUrl()
  const client = new SmartAccountClient({
    contractId: id,
    networkPassphrase: networkPassphrase(),
    rpcUrl,
    allowHttp: rpcUrl.startsWith("http://"),
  })

  const hasGetContextRules = await simulatesOk(() =>
    client.get_context_rules({
      context_rule_type: { tag: "Default", values: undefined },
    }),
  )

  const hasGetContextRuleById = await simulatesOk(() =>
    client.get_context_rule({ context_rule_id: 0 }),
  )

  let isFactoryForSigner: boolean | null = null
  if (signerG?.startsWith("G")) {
    isFactoryForSigner = await contractIsFactoryForSigner(id, signerG)
  }

  let recommendedPath: SmartAccountProbe["recommendedPath"]
  if (isFactoryForSigner === true) {
    recommendedPath = "factory_g_signer"
    notes.push("Factory mapping: this C is tied to your G signer — use ed25519 G signing, not WebAuthn kit.")
  } else if (hasGetContextRules) {
    recommendedPath = "oz_kit"
    notes.push("Full OZ kit API available (get_context_rules).")
  } else if (ozConfigPresent) {
    recommendedPath = "oz_passkey_local"
    notes.push(
      "Legacy OZ passkey WASM (no get_context_rules). Signing must use passkey keyData aligned at deploy; no DB-only migration.",
    )
    if (hasGetContextRuleById) {
      notes.push("get_context_rule(0) works — support can read signers; add_signer still needs one valid existing signature.")
    }
  } else {
    recommendedPath = "stuck_needs_recovery"
    notes.push("Unknown contract type; contact support with this contract id.")
  }

  if (!hasGetContextRules && !isFactoryForSigner) {
    notes.push(
      "USDC on this C cannot be moved by a server-side migration. Outbound transfer requires a valid on-chain passkey signature from a registered signer.",
    )
    notes.push(
      "A new C address only helps for future deposits; moving balance off CBNHZ still requires signing as CBNHZ once.",
    )
  }

  return {
    contractId: id,
    hasGetContextRules,
    hasGetContextRuleById,
    ozConfigPresent,
    isFactoryForSigner,
    recommendedPath,
    notes,
  }
}
