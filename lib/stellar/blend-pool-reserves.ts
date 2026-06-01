import "server-only"

import { PoolV2 } from "@blend-capital/blend-sdk"
import type { Network } from "@blend-capital/blend-sdk"
import { getAssetByContractId } from "@/lib/stellar/asset-registry"
import type { SozuAsset, StellarNetwork } from "@/lib/stellar/asset-types"

function buildBlendNetwork(network: StellarNetwork): Network {
  const isTestnet = network === "testnet"
  return {
    rpc:
      process.env.SOROBAN_RPC_URL?.trim() ||
      process.env.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim() ||
      (isTestnet
        ? "https://soroban-testnet.stellar.org"
        : "https://soroban.stellar.org"),
    passphrase: isTestnet
      ? "Test SDF Network ; September 2015"
      : "Public Global Stellar Network ; September 2015",
  }
}

export type BlendPoolReserveAsset = {
  reserveKey: string
  assetContractId: string
  asset: SozuAsset | null
}

/**
 * Read Blend pool reserves and return each reserve's asset contractId.
 * Never assume USDC — use reserve.assetId from the pool.
 */
export async function getBlendPoolReserveAssets(
  poolContractId: string,
  network: StellarNetwork,
): Promise<BlendPoolReserveAsset[]> {
  const poolId = poolContractId.trim().toUpperCase()
  const pool = await PoolV2.load(buildBlendNetwork(network), poolId)
  const out: BlendPoolReserveAsset[] = []

  for (const [reserveKey, reserve] of pool.reserves) {
    const assetContractId = reserve.assetId.trim().toUpperCase()
    out.push({
      reserveKey,
      assetContractId,
      asset: getAssetByContractId(assetContractId, network) ?? null,
    })
  }

  return out
}
