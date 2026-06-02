/**
 * DeFindex strategy catalog.
 *
 * Each entry describes one yield strategy available to users:
 *   - `id`              — stable key used in user prefs and DB records
 *   - `vaultAddress`    — DeFindex vault contract (target for depositToVault)
 *   - `strategyAddress` — underlying Blend strategy contract (for DB / deep links)
 *   - `blendPoolId`     — Blend pool ID for APY reads and verify link
 *   - `assetAddress`    — Fallback deposit token; prefer getResolvedDeFindexConfig() (on-chain get_assets)
 *   - `blendUsdcReserve`— USDC reserve ID inside the Blend pool
 *   - `label`           — short UI label
 *   - `description`     — risk/composition blurb shown in settings
 */

export type StrategyId = "fixed" | "yieldblox"

export interface StrategyConfig {
  id: StrategyId
  vaultAddress: string
  strategyAddress: string
  blendPoolId: string
  assetAddress: string
  blendUsdcReserve: string
  label: string
  description: string
}

import { getDefaultBlendUsdcContractId } from "@/lib/stellar/asset-registry-core"

// ─── Testnet ─────────────────────────────────────────────────────────────────
// Public DeFindex vault (CBMVK2JK…) accepts Blend pool USDC (CAQCFVLO…), not Circle SAC.
// Circle SAC on C (CBIELTK6…) is the default receive token (faucet / SozuPay).
// When Paltalabs deploys a SAC-native vault, set DEFINDEX_FIXED_VAULT_ADDRESS + optional
// DEFINDEX_VAULT_DEPOSIT_ASSET_CONTRACT — getResolvedDeFindexConfig reads get_assets on-chain.

const TESTNET_BLEND_USDC = getDefaultBlendUsdcContractId("testnet")
const TESTNET_BLEND_USDC_RESERVE = TESTNET_BLEND_USDC

const TESTNET_STRATEGIES: Record<StrategyId, StrategyConfig> = {
  fixed: {
    id: "fixed",
    vaultAddress:
      process.env.DEFINDEX_FIXED_VAULT_ADDRESS ??
      "CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN",
    strategyAddress:
      process.env.DEFINDEX_FIXED_STRATEGY_ADDRESS ??
      "CALLOM5I7XLQPPOPQMYAHUWW4N7O3JKT42KQ4ASEEVBXDJQNJOALFSUY",
    // Testnet blend pool — use testnet.blend.capital to look up current ID
    blendPoolId:
      process.env.NEXT_PUBLIC_BLEND_TESTNET_POOL_ID ??
      "CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF",
    assetAddress: TESTNET_BLEND_USDC,
    blendUsdcReserve: TESTNET_BLEND_USDC_RESERVE,
    label: "Fixed Pool",
    description:
      "Blend Fixed Pool — USDC lending with conservative collateral requirements. Lower risk, stable yield.",
  },
  yieldblox: {
    id: "yieldblox",
    vaultAddress:
      process.env.DEFINDEX_YIELDBLOX_VAULT_ADDRESS ??
      // YieldBlox vault — confirm from DeFindex testnet deployments before mainnet
      "CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN",
    strategyAddress:
      process.env.DEFINDEX_YIELDBLOX_STRATEGY_ADDRESS ??
      "CALLOM5I7XLQPPOPQMYAHUWW4N7O3JKT42KQ4ASEEVBXDJQNJOALFSUY",
    blendPoolId:
      process.env.NEXT_PUBLIC_BLEND_TESTNET_YIELDBLOX_POOL_ID ??
      "CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF",
    assetAddress: TESTNET_BLEND_USDC,
    blendUsdcReserve: TESTNET_BLEND_USDC_RESERVE,
    label: "YieldBlox Pool",
    description:
      "Blend YieldBlox Pool — USDC + multi-asset pool with BLND emissions. Higher potential yield; more complex risk profile.",
  },
}

// ─── Mainnet ──────────────────────────────────────────────────────────────────
// DeFindex mainnet Fixed Pool USDC:  CDB2WMKQQNVZMEBY7Q7GZ5C7E7IAFSNMZ7GGVD6WKTCEWK7XOIAVZSAP
// DeFindex mainnet YieldBlox USDC:   CCSRX5E4337QMCMC3KO3RDFYI57T5NZV5XB3W3TWE4USCASKGL5URKJL
// Circle USDC mainnet:               CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75
// Blend mainnet Fixed pool:          CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD

const MAINNET_USDC = getDefaultBlendUsdcContractId("mainnet")

const MAINNET_STRATEGIES: Record<StrategyId, StrategyConfig> = {
  fixed: {
    id: "fixed",
    vaultAddress:
      process.env.DEFINDEX_FIXED_VAULT_ADDRESS ??
      "CDB2WMKQQNVZMEBY7Q7GZ5C7E7IAFSNMZ7GGVD6WKTCEWK7XOIAVZSAP",
    strategyAddress:
      process.env.DEFINDEX_FIXED_STRATEGY_ADDRESS ??
      "CDB2WMKQQNVZMEBY7Q7GZ5C7E7IAFSNMZ7GGVD6WKTCEWK7XOIAVZSAP",
    blendPoolId:
      process.env.NEXT_PUBLIC_BLEND_MAINNET_POOL_ID ??
      "CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD",
    assetAddress: MAINNET_USDC,
    blendUsdcReserve:
      process.env.NEXT_PUBLIC_BLEND_MAINNET_USDC_RESERVE ??
      "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
    label: "Fixed Pool",
    description:
      "Blend Fixed Pool — USDC lending with conservative collateral requirements. Lower risk, stable yield.",
  },
  yieldblox: {
    id: "yieldblox",
    vaultAddress:
      process.env.DEFINDEX_YIELDBLOX_VAULT_ADDRESS ??
      "CCSRX5E4337QMCMC3KO3RDFYI57T5NZV5XB3W3TWE4USCASKGL5URKJL",
    strategyAddress:
      process.env.DEFINDEX_YIELDBLOX_STRATEGY_ADDRESS ??
      "CCSRX5E4337QMCMC3KO3RDFYI57T5NZV5XB3W3TWE4USCASKGL5URKJL",
    blendPoolId:
      process.env.NEXT_PUBLIC_BLEND_MAINNET_YIELDBLOX_POOL_ID ??
      "CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD",
    assetAddress: MAINNET_USDC,
    blendUsdcReserve:
      process.env.NEXT_PUBLIC_BLEND_MAINNET_USDC_RESERVE ??
      "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
    label: "YieldBlox Pool",
    description:
      "Blend YieldBlox Pool — USDC + multi-asset pool with BLND emissions. Higher potential yield; more complex risk profile.",
  },
}

/** Resolve the canonical network string to testnet | mainnet. */
export function resolveNetwork(raw?: string | null): "testnet" | "mainnet" {
  return (raw ?? process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet") === "mainnet"
    ? "mainnet"
    : "testnet"
}

/** Return the full strategy catalog for the given network. */
export function getStrategyCatalog(network?: string | null): Record<StrategyId, StrategyConfig> {
  return resolveNetwork(network) === "mainnet" ? MAINNET_STRATEGIES : TESTNET_STRATEGIES
}

/** Return config for a single strategy. Defaults to 'fixed'. */
export function getStrategyConfig(
  strategyId: StrategyId = "fixed",
  network?: string | null
): StrategyConfig {
  return getStrategyCatalog(network)[strategyId]
}
