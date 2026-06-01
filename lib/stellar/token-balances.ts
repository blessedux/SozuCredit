import "server-only"

import { getSorobanTokenBalance } from "@/lib/stellar/soroban-token"
import { getAssetRegistry } from "@/lib/stellar/asset-registry"
import type { HolderTokenBalance, StellarNetwork } from "@/lib/stellar/asset-types"
import { normalizeHolderAddress } from "@/lib/stellar/stellar-holder"

export async function getHolderTokenBalances(
  holderAddress: string,
  network: StellarNetwork,
): Promise<HolderTokenBalance[]> {
  const holder = normalizeHolderAddress(holderAddress)
  const registry = getAssetRegistry(network)
  const rows: HolderTokenBalance[] = []
  const seenContractIds = new Set<string>()

  await Promise.all(
    registry.map(async (asset) => {
      const contractId = asset.contractId.trim().toUpperCase()
      if (seenContractIds.has(contractId)) return
      seenContractIds.add(contractId)

      const balance = await getSorobanTokenBalance(
        contractId,
        holder,
        network,
      )
      rows.push({ asset, balance })
    }),
  )

  rows.sort((a, b) => a.asset.sendPriority - b.asset.sendPriority)
  return rows
}

/** Sum per unique contractId (avoids double-count when registry lists the same token twice). */
export function sumRegistryBalances(balances: HolderTokenBalance[]): number {
  const byContract = new Map<string, number>()
  for (const row of balances) {
    const id = row.asset.contractId.trim().toUpperCase()
    byContract.set(id, Math.max(byContract.get(id) ?? 0, row.balance))
  }
  return [...byContract.values()].reduce((sum, n) => sum + n, 0)
}
