/**
 * Treasury mode presets.
 *
 * Each mode models a different merchant cash-flow pattern and
 * applies a haircut to the protocol APY to reflect reduced
 * time-in-strategy when cashing out more frequently.
 *
 * Phase 2: calibrate haircuts against real deposit/withdrawal data
 * from the email ledger transaction history.
 */

import type { TreasuryMode } from "./types"

interface TreasuryModeConfig {
  /** Human label (ES) */
  label: string
  /** Short description (ES) */
  description: string
  /** Fraction of APY retained (0–1) */
  apyRetentionFactor: number
  /** Suggested cashout cadence in days */
  suggestedCashoutDays: number
  /** % of balance kept in DeFi strategy (informational) */
  strategyAllocationPct: number
}

export const TREASURY_MODE_CONFIG: Record<TreasuryMode, TreasuryModeConfig> = {
  efficient: {
    label: "Eficiente",
    description: "Maximiza el rendimiento. Retiros espaciados.",
    apyRetentionFactor: 1.0,
    suggestedCashoutDays: 90,
    strategyAllocationPct: 100,
  },
  balanced: {
    label: "Balanceado",
    description: "Buen balance entre rendimiento y liquidez mensual.",
    apyRetentionFactor: 0.9,
    suggestedCashoutDays: 30,
    strategyAllocationPct: 80,
  },
  fast: {
    label: "Rápido",
    description: "Liquidez semanal. Menor optimización de tesorería.",
    apyRetentionFactor: 0.7,
    suggestedCashoutDays: 7,
    strategyAllocationPct: 55,
  },
}

/** Return effective APY after mode haircut */
export function getEffectiveApy(protocolApy: number, mode: TreasuryMode): number {
  return protocolApy * TREASURY_MODE_CONFIG[mode].apyRetentionFactor
}
