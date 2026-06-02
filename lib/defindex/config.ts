/**
 * DeFindex Configuration
 *
 * Central config resolver used by vault, APY, and API layers.
 * Strategy addresses are now per-pool via strategy-catalog.ts; this module
 * retains backward-compat exports and adds the active-strategy resolver.
 */

import type { StrategyId } from "./strategy-catalog"
import { getStrategyConfig } from "./strategy-catalog"
import { resolvePrimaryVaultDepositAsset } from "./vault-deposit-asset"

export interface DeFindexConfig {
  network: "testnet" | "mainnet"
  rpcUrl: string
  /** Active DeFindex vault address (target for depositToVault). */
  defindexVaultAddress: string
  /** Active underlying strategy address (for DB records / Blend links). */
  defindexStrategyAddress: string
  /** USDC asset contract used by the active strategy. */
  assetAddress: string
  /** Minimum USDC to trigger a deposit. */
  minDepositAmount: number
  /** XLM buffer kept in wallet for network fees. */
  networkFeeBuffer: number
}

/**
 * Get DeFindex configuration for a specific strategy + network.
 *
 * @param strategyId - "fixed" | "yieldblox" (default "fixed")
 * @param networkOverride - optional network string; falls back to
 *   NEXT_PUBLIC_STELLAR_NETWORK env var.
 */
export function getDeFindexConfig(
  strategyId: StrategyId = "fixed",
  networkOverride?: string | null
): DeFindexConfig {
  const network =
    ((networkOverride ?? process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet") as string) ===
    "mainnet"
      ? "mainnet"
      : "testnet"

  const rpcUrl =
    network === "testnet"
      ? process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org"
      : process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban.stellar.org"

  const strategy = getStrategyConfig(strategyId, network)

  return {
    network,
    rpcUrl,
    defindexVaultAddress: strategy.vaultAddress,
    defindexStrategyAddress: strategy.strategyAddress,
    assetAddress: strategy.assetAddress,
    minDepositAmount: Number(process.env.VAULT_MIN_DEPOSIT ?? "10"),
    networkFeeBuffer: Number(process.env.VAULT_NETWORK_FEE_BUFFER ?? "0.4"),
  }
}

/** Validate that mandatory addresses are populated. */
export function validateDeFindexConfig(config: DeFindexConfig): boolean {
  return !!(
    config.rpcUrl &&
    config.defindexVaultAddress &&
    config.defindexStrategyAddress &&
    config.assetAddress
  )
}

/**
 * Catalog config with `assetAddress` aligned to the vault's on-chain deposit token.
 * Falls back to strategy-catalog when `get_assets` is unavailable.
 */
export async function getResolvedDeFindexConfig(
  strategyId: StrategyId = "fixed",
  networkOverride?: string | null,
): Promise<DeFindexConfig> {
  const config = getDeFindexConfig(strategyId, networkOverride)
  const override = process.env.DEFINDEX_VAULT_DEPOSIT_ASSET_CONTRACT?.trim().toUpperCase()
  if (override?.startsWith("C") && override.length === 56) {
    return { ...config, assetAddress: override }
  }

  const onChain = await resolvePrimaryVaultDepositAsset(
    config.defindexVaultAddress,
    config.network,
  )
  if (onChain) {
    return { ...config, assetAddress: onChain }
  }
  return config
}
