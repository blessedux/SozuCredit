/**
 * Live Blend pool APY reader.
 *
 * Uses @blend-capital/blend-sdk to load a PoolV2 reserve and read
 * the real-time supply APR/APY for a USDC reserve.
 *
 * Results are cached for 60 s per (poolId + reserveId) pair to avoid
 * hammering the Soroban RPC on every wallet load.
 */

import { PoolV2 } from "@blend-capital/blend-sdk"
import type { Network } from "@blend-capital/blend-sdk"
import type { StrategyId } from "@/lib/defindex/strategy-catalog"
import { getStrategyConfig, resolveNetwork } from "@/lib/defindex/strategy-catalog"

export interface BlendPoolApy {
  /** Annualised supply APR from the reserve (0–100 scale) */
  supplyApr: number
  /** Estimated supply APY with weekly compounding (0–100 scale) */
  estSupplyApy: number
  /** Pool ID that was queried */
  poolId: string
  /** Strategy this reading applies to */
  strategyId: StrategyId
  source: "blend-sdk" | "fallback"
  fetchedAt: number
}

const CACHE_TTL_MS = 60_000

// Module-level LRU-lite: keeps the last entry per (poolId + reserveId).
const cache = new Map<string, BlendPoolApy>()

function buildNetwork(networkStr: "testnet" | "mainnet"): Network {
  const isTestnet = networkStr === "testnet"
  return {
    rpc: isTestnet
      ? process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org"
      : process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban.stellar.org",
    passphrase: isTestnet
      ? "Test SDF Network ; September 2015"
      : "Public Global Stellar Network ; September 2015",
  }
}

/**
 * Fetch live supply APY for a given strategy's USDC reserve.
 *
 * Falls back to the supplied `fallbackApy` value (default 15.5) if the
 * Blend RPC call fails or returns an unexpected result.
 */
export async function getBlendPoolApy(
  strategyId: StrategyId = "fixed",
  networkStr?: string | null,
  fallbackApy = 15.5
): Promise<BlendPoolApy> {
  const network = resolveNetwork(networkStr)
  const strategy = getStrategyConfig(strategyId, network)
  const cacheKey = `${strategy.blendPoolId}:${strategy.blendUsdcReserve}`

  // Return cached value if still fresh.
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached
  }

  try {
    const blendNetwork = buildNetwork(network)
    const pool = await PoolV2.load(blendNetwork, strategy.blendPoolId)

    const reserve = pool.reserves.get(strategy.blendUsdcReserve)

    if (!reserve) {
      console.warn(
        `[Blend APY] Reserve ${strategy.blendUsdcReserve} not found in pool ${strategy.blendPoolId}; using fallback`
      )
      return makeFallback(strategyId, strategy.blendPoolId, fallbackApy)
    }

    // supplyApr is already a decimal fraction (e.g. 0.0843 = 8.43%).
    // Convert to percent for our display layer.
    const supplyApr = reserve.supplyApr * 100
    const estSupplyApy = reserve.estSupplyApy * 100

    const result: BlendPoolApy = {
      supplyApr,
      estSupplyApy,
      poolId: strategy.blendPoolId,
      strategyId,
      source: "blend-sdk",
      fetchedAt: Date.now(),
    }

    cache.set(cacheKey, result)
    console.log(
      `[Blend APY] Live APY for ${strategyId} (${network}): ${estSupplyApy.toFixed(2)}% APY`
    )
    return result
  } catch (err) {
    console.warn(
      `[Blend APY] Failed to load pool; using fallback ${fallbackApy}%`,
      err instanceof Error ? err.message : err
    )
    return makeFallback(strategyId, strategy.blendPoolId, fallbackApy)
  }
}

function makeFallback(
  strategyId: StrategyId,
  poolId: string,
  fallbackApy: number
): BlendPoolApy {
  return {
    supplyApr: fallbackApy,
    estSupplyApy: fallbackApy,
    poolId,
    strategyId,
    source: "fallback",
    fetchedAt: Date.now(),
  }
}
