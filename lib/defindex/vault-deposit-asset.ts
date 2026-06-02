/**
 * Resolve which Soroban token contract(s) a DeFindex vault accepts for deposit.
 * Source of truth: on-chain `get_assets` on the vault contract.
 */

import { Contract, TransactionBuilder, Account, BASE_FEE, Networks, rpc, scValToNative } from "@stellar/stellar-sdk"

function makeSorobanRpc(network: "testnet" | "mainnet"): rpc.Server {
  const url =
    network === "mainnet"
      ? (process.env.SOROBAN_RPC_URL_MAINNET ?? "https://soroban.stellar.org")
      : (process.env.SOROBAN_RPC_URL ??
          process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
          "https://soroban-testnet.stellar.org")
  return new rpc.Server(url, { allowHttp: network === "testnet" })
}

export type VaultDepositAsset = {
  contractId: string
  strategyAddresses: string[]
}

const CACHE_TTL_MS = 5 * 60_000
const cache = new Map<string, { at: number; assets: VaultDepositAsset[] }>()

function cacheKey(vaultAddress: string, network: "testnet" | "mainnet"): string {
  return `${network}:${vaultAddress}`
}

/**
 * Read vault `get_assets` via Soroban simulation.
 * Returns empty array on RPC/contract errors (caller should fall back to catalog).
 */
export async function resolveVaultDepositAssets(
  vaultAddress: string,
  network: "testnet" | "mainnet" = "testnet",
): Promise<VaultDepositAsset[]> {
  const key = cacheKey(vaultAddress, network)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.assets
  }

  try {
    const server = makeSorobanRpc(network)
    const temp = new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0")
    const passphrase = network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET
    const contract = new Contract(vaultAddress)
    const tx = new TransactionBuilder(temp, { fee: BASE_FEE, networkPassphrase: passphrase })
      .addOperation(contract.call("get_assets"))
      .setTimeout(30)
      .build()

    const sim = await server.simulateTransaction(tx)
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) {
      return []
    }

    const native = scValToNative(sim.result.retval)
    if (!Array.isArray(native)) {
      return []
    }

    const assets: VaultDepositAsset[] = []
    for (const row of native) {
      if (!row || typeof row !== "object") continue
      const address = String((row as { address?: string }).address ?? "").trim().toUpperCase()
      if (!address.startsWith("C") || address.length !== 56) continue
      const strategiesRaw = (row as { strategies?: unknown[] }).strategies
      const strategyAddresses = Array.isArray(strategiesRaw)
        ? strategiesRaw
            .map((s) =>
              s && typeof s === "object"
                ? String((s as { address?: string }).address ?? "").trim().toUpperCase()
                : "",
            )
            .filter((a) => a.startsWith("C") && a.length === 56)
        : []
      assets.push({ contractId: address, strategyAddresses })
    }

    cache.set(key, { at: Date.now(), assets })
    return assets
  } catch (err) {
    console.warn(
      "[VaultDepositAsset] get_assets failed:",
      err instanceof Error ? err.message : err,
    )
    return []
  }
}

/** Primary deposit token for a vault (first asset in get_assets). */
export async function resolvePrimaryVaultDepositAsset(
  vaultAddress: string,
  network: "testnet" | "mainnet" = "testnet",
): Promise<string | null> {
  const assets = await resolveVaultDepositAssets(vaultAddress, network)
  return assets[0]?.contractId ?? null
}
