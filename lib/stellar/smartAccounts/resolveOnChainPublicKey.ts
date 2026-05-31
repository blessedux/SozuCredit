import "server-only"

import { Client as SmartAccountClient } from "smart-account-kit-bindings"
import { Networks } from "@stellar/stellar-sdk"
import {
  credentialIdToBuffer,
  extractCredentialIdFromKeyData,
  extractPublicKeyFromKeyData,
  publicKeyToBase64Url,
} from "@/lib/stellar/smartAccounts/passkeyPublicKey"

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

export async function resolveOnChainPasskeyPublicKey(params: {
  contractId: string
  credentialId: string
}): Promise<string | null> {
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

  const targetCredential = credentialIdToBuffer(credentialId)

  try {
    const tx = await client.get_context_rules({
      context_rule_type: { tag: "Default", values: undefined },
    })
    await tx.simulate()
    const rules = tx.result
    if (!Array.isArray(rules)) return null

    for (const rule of rules) {
      for (const signer of rule.signers ?? []) {
        if (signer.tag !== "External") continue
        const keyData = signer.values[1]
        if (!keyData || keyData.length < 66) continue
        const keyDataBytes = keyData instanceof Uint8Array ? keyData : new Uint8Array(keyData)
        const credBytes = extractCredentialIdFromKeyData(keyDataBytes)
        if (Buffer.compare(Buffer.from(credBytes), Buffer.from(targetCredential)) !== 0) continue
        return publicKeyToBase64Url(extractPublicKeyFromKeyData(keyDataBytes))
      }
    }
  } catch {
    return null
  }

  return null
}
