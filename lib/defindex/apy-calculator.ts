/**
 * DeFindex APY Calculator
 *
 * Source priority:
 *   1. Blend SDK live pool reserve (high confidence)
 *   2. DeFindex SDK vault APY endpoint
 *   3. Conservative static fallback (15.5%)
 *
 * The broken `api.blend.capital/yields` fetch has been removed.
 */

import type { StrategyId } from "./strategy-catalog"
import { getDeFindexConfig } from "./config"

export interface APYData {
  daily: number
  weekly: number
  monthly: number
  yearly: number
  precision: number
  source: "blend-sdk" | "defindex-sdk" | "fallback"
  lastUpdated: string
  confidence: "high" | "medium" | "low"
}

export interface APYCalculationResult {
  success: boolean
  data?: APYData
  error?: string
  strategyAddress: string
}

/** Derive period-specific rates from an annualised base APY. */
export function calculateAPYPeriods(
  baseAPY: number
): Omit<APYData, "source" | "lastUpdated" | "confidence"> {
  const dailyRate = baseAPY / 100 / 365
  return {
    daily: dailyRate * 100,
    weekly: (Math.pow(1 + dailyRate, 7) - 1) * 100,
    monthly: (Math.pow(1 + dailyRate, 30) - 1) * 100,
    yearly: (Math.pow(1 + dailyRate, 365) - 1) * 100,
    precision: 4,
  }
}

/** Get real-time APY for a strategy, trying Blend SDK first. */
export async function getRealTimeAPY(
  strategyId: StrategyId = "fixed",
  networkStr?: string | null
): Promise<APYCalculationResult> {
  const config = getDeFindexConfig(strategyId, networkStr)

  // ── Source 1: Blend SDK live pool reserve ─────────────────────────────────
  try {
    const { getBlendPoolApy } = await import("@/lib/blend/pool-apy")
    const blendApy = await getBlendPoolApy(strategyId, networkStr)

    if (blendApy.source === "blend-sdk" && blendApy.estSupplyApy > 0) {
      console.log(
        `[APY Calculator] Blend SDK APY for ${strategyId}: ${blendApy.estSupplyApy.toFixed(2)}%`
      )
      return {
        success: true,
        strategyAddress: config.defindexStrategyAddress,
        data: {
          ...calculateAPYPeriods(blendApy.estSupplyApy),
          source: "blend-sdk",
          lastUpdated: new Date().toISOString(),
          confidence: "high",
        },
      }
    }
  } catch (err) {
    console.warn("[APY Calculator] Blend SDK source failed:", err instanceof Error ? err.message : err)
  }

  // ── Source 2: DeFindex SDK vault APY ─────────────────────────────────────
  try {
    const { DefindexSDK, SupportedNetworks } = await import("@defindex/sdk")
    const sdk = new DefindexSDK({})
    const network = (networkStr ?? process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet") === "mainnet"
      ? SupportedNetworks.MAINNET
      : SupportedNetworks.TESTNET

    const vaultApy = await sdk.getVaultAPY(config.defindexVaultAddress, network)

    const apyValue = (vaultApy as any)?.apy ?? (vaultApy as any)?.yearlyApy ?? 0
    if (typeof apyValue === "number" && apyValue > 0) {
      const displayApy = apyValue > 1 ? apyValue : apyValue * 100
      console.log(`[APY Calculator] DeFindex SDK APY for ${strategyId}: ${displayApy.toFixed(2)}%`)
      return {
        success: true,
        strategyAddress: config.defindexStrategyAddress,
        data: {
          ...calculateAPYPeriods(displayApy),
          source: "defindex-sdk",
          lastUpdated: new Date().toISOString(),
          confidence: "medium",
        },
      }
    }
  } catch (err) {
    console.warn("[APY Calculator] DeFindex SDK source failed:", err instanceof Error ? err.message : err)
  }

  // ── Source 3: Conservative fallback ──────────────────────────────────────
  console.log("[APY Calculator] All sources failed, using 15.5% fallback")
  return getFallbackAPY(config.defindexStrategyAddress)
}

function getFallbackAPY(strategyAddress: string): APYCalculationResult {
  const baseAPY = 15.5
  return {
    success: true,
    strategyAddress,
    data: {
      ...calculateAPYPeriods(baseAPY),
      source: "fallback",
      lastUpdated: new Date().toISOString(),
      confidence: "low",
    },
  }
}

/** Format an APYData field as a string with given decimal places. */
export function formatAPY(
  apyData: APYData,
  period: keyof Pick<APYData, "daily" | "weekly" | "monthly" | "yearly"> = "yearly",
  decimals = 2
): string {
  const value = apyData[period]
  return typeof value === "number" ? value.toFixed(decimals) : "0.00"
}

export function getAPYWithPrecision(
  apyData: APYData,
  period: keyof Pick<APYData, "daily" | "weekly" | "monthly" | "yearly"> = "yearly",
  decimals = 4
): number {
  const value = apyData[period]
  return typeof value === "number" ? Number(value.toFixed(decimals)) : 0
}
