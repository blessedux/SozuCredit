/**
 * Network-aware Blend pool deep links for APY verification.
 *
 * Supports per-strategy links (Fixed vs YieldBlox), deriving pool/asset IDs
 * from the strategy catalog rather than standalone constants.
 */

import { getStrategyConfig, resolveNetwork } from "./strategy-catalog"
import type { StrategyId } from "./strategy-catalog"

export type StellarNetwork = "testnet" | "mainnet"

export type BlendStrategyLink = {
  network: StellarNetwork
  poolId: string
  assetId: string
  /** e.g. "Blend · Fixed Pool USDC" */
  poolLabel: string
  url: string
}

export function resolveStellarNetwork(network?: string | null): StellarNetwork {
  return resolveNetwork(network)
}

/**
 * Get the Blend pool deep link for a specific strategy.
 *
 * @param network   - "testnet" | "mainnet" (or env default)
 * @param strategyId - "fixed" | "yieldblox" (default "fixed")
 */
export function getBlendStrategyLink(
  network?: string | null,
  strategyId: StrategyId = "fixed"
): BlendStrategyLink {
  const resolved = resolveStellarNetwork(network)
  const strategy = getStrategyConfig(strategyId, resolved)

  const baseUrl =
    resolved === "mainnet"
      ? "https://mainnet.blend.capital/asset"
      : "https://testnet.blend.capital/asset"

  const url = `${baseUrl}/?poolId=${strategy.blendPoolId}&assetId=${strategy.blendUsdcReserve}`
  const networkLabel = resolved === "mainnet" ? "Blend" : "Blend Testnet"
  const poolLabel = `${networkLabel} · ${strategy.label} USDC`

  return {
    network: resolved,
    poolId: strategy.blendPoolId,
    assetId: strategy.blendUsdcReserve,
    poolLabel,
    url,
  }
}

export function openBlendStrategyAsset(
  network?: string | null,
  strategyId: StrategyId = "fixed"
): BlendStrategyLink {
  const link = getBlendStrategyLink(network, strategyId)
  if (typeof window !== "undefined") {
    window.open(link.url, "_blank", "noopener,noreferrer")
  }
  return link
}
