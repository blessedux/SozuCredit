import "server-only"

import { isRegisteredSendAsset } from "@/lib/stellar/asset-registry"
import type {
  HolderTokenBalance,
  PickedSendToken,
  StellarNetwork,
} from "@/lib/stellar/asset-types"

export function pickSendToken(params: {
  balances: HolderTokenBalance[]
  amountRequired: number
  /** Explicit contractId from client — must be registered and sufficient. */
  preferredContractId?: string | null
  network: StellarNetwork
}): PickedSendToken | null {
  const { balances, amountRequired, preferredContractId, network } = params
  const need = amountRequired

  if (preferredContractId) {
    const contractId = preferredContractId.trim().toUpperCase()
    if (!isRegisteredSendAsset(contractId, network)) {
      return null
    }
    const row = balances.find((b) => b.asset.contractId === contractId)
    if (row && row.balance >= need) {
      return { asset: row.asset, balance: row.balance }
    }
    return null
  }

  const sorted = [...balances].sort(
    (a, b) => a.asset.sendPriority - b.asset.sendPriority,
  )

  for (const row of sorted) {
    if (row.balance >= need) {
      return { asset: row.asset, balance: row.balance }
    }
  }

  return null
}

export function formatInsufficientBalanceMessage(
  balances: HolderTokenBalance[],
  amountRequired: number,
): string {
  const parts = balances
    .filter((b) => b.balance > 0)
    .map((b) => `${b.asset.displayName} ${b.balance.toFixed(2)}`)
  const total = balances.reduce((s, b) => s + b.balance, 0)
  const breakdown =
    parts.length > 0 ? ` (${parts.join(", ")})` : ""
  return `Insufficient balance. You need ${amountRequired.toFixed(2)} in one token contract but have ${total.toFixed(2)} total${breakdown}. Each transfer uses a single contractId.`
}
