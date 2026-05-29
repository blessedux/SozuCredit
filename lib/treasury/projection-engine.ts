/**
 * Treasury Projection Engine — pure calculation functions.
 *
 * Computes estimated purchasing power impact across three layers:
 *   1. DeFi yield (from Blend/DeFindex strategy)
 *   2. Inflation avoided (vs holding local fiat)
 *   3. FX protection (USD strength vs local currency)
 *
 * All percentage outputs are in "percent" units (e.g. 1.21 = 1.21%).
 * Local amounts are in the reference fiat (CLP, ARS, BRL, COP).
 *
 * This module is intentionally side-effect free — all external data
 * (APY, FX, CPI) is injected as arguments so swapping mock → live data
 * in Phase 2 requires no changes here.
 */

import type { TreasuryProjection, TreasuryProjectionInput } from "./types"
import { getEffectiveApy, TREASURY_MODE_CONFIG } from "./treasury-modes"

const DISCLAIMER_ES =
  "Estimaciones basadas en tasas históricas y datos de mercado. No garantizado. No constituye asesoramiento financiero."

/**
 * Compute a full TreasuryProjection from raw inputs.
 *
 * Yield uses simple interest for the projection window
 * (daily compound approximation for periods > 30d, simple for ≤ 30d).
 */
export function computeTreasuryProjection(input: TreasuryProjectionInput): TreasuryProjection {
  const { balanceUsdc, prefs, protocolApy, spotFxRate, fxChangePct, annualInflation } = input
  const { mode, holdingDays, referenceFiat } = prefs

  const merchantApy = getEffectiveApy(protocolApy, mode)
  const balanceLocal = balanceUsdc * spotFxRate

  // --- Layer 1: DeFi yield ---
  // Simple interest for projection display; accurate enough at ≤ 90d windows
  const yieldUsd = balanceUsdc * (merchantApy / 100) * (holdingDays / 365)
  const yieldLocal = yieldUsd * spotFxRate
  const yieldPeriodPct = yieldUsd / (balanceUsdc || 1) * 100

  // --- Layer 2: Inflation avoided ---
  // How much local purchasing power was preserved by not holding local fiat
  const inflationAvoidedLocal = balanceLocal * (annualInflation / 100) * (holdingDays / 365)
  const inflationPeriodPct = inflationAvoidedLocal / (balanceLocal || 1) * 100

  // --- Layer 3: FX protection ---
  // Positive when local currency weakened against USD over the period
  const fxProtectionLocal = balanceLocal * (fxChangePct / 100)
  const fxPeriodPct = fxChangePct

  // --- Totals ---
  const totalAmountLocal = yieldLocal + inflationAvoidedLocal + fxProtectionLocal
  const totalPeriodPct = totalAmountLocal / (balanceLocal || 1) * 100
  const totalPeriodPctRounded = round(totalPeriodPct, 2)
  const totalAnnualizedPct = totalPeriodPctRounded * (365 / holdingDays)

  // --- Comparison: cost of holding local fiat over same period ---
  // Inflation is prorated from annual CPI; fxChangePct is already period-scaled.
  const inflationLossPct = annualInflation * (holdingDays / 365)
  const fxLossPct = fxChangePct
  const localFiatLossPct = -(inflationLossPct + fxLossPct)

  return {
    periodDays: holdingDays,
    referenceFiat,
    protocolApy,
    merchantApy,
    layers: {
      yield: {
        percent: round(yieldPeriodPct, 2),
        amountUsd: round(yieldUsd, 2),
        amountLocal: round(yieldLocal, 0),
      },
      inflationAvoided: {
        percent: round(inflationPeriodPct, 2),
        amountLocal: round(inflationAvoidedLocal, 0),
      },
      fxProtection: {
        percent: round(fxPeriodPct, 2),
        amountLocal: round(fxProtectionLocal, 0),
      },
    },
    total: {
      percentAnnualized: round(totalAnnualizedPct, 1),
      percentPeriod: totalPeriodPctRounded,
      amountLocal: round(totalAmountLocal, 0),
    },
    comparison: {
      localFiatLossPercent: round(localFiatLossPct, 2),
    },
    audit: {
      balanceUsdc,
      spotFxRate,
      annualInflationPct: annualInflation,
      fxChangePeriodPct: fxChangePct,
    },
    disclaimer: DISCLAIMER_ES,
    dataSource: "mock",
  }
}

/** Dev / QA checks — throws when projection math drifts. */
export function assertTreasuryProjectionInvariants(
  input: TreasuryProjectionInput,
  projection: TreasuryProjection,
): void {
  const { balanceUsdc, prefs, protocolApy, spotFxRate, fxChangePct, annualInflation } = input
  const { mode, holdingDays } = prefs
  const expectedMerchantApy = getEffectiveApy(protocolApy, mode)

  if (Math.abs(projection.merchantApy - expectedMerchantApy) > 0.001) {
    throw new Error(`merchantApy mismatch: ${projection.merchantApy} vs ${expectedMerchantApy}`)
  }

  const layerSum =
    projection.layers.yield.percent +
    projection.layers.inflationAvoided.percent +
    projection.layers.fxProtection.percent

  if (Math.abs(layerSum - projection.total.percentPeriod) > 0.05) {
    throw new Error(
      `period layer sum ${layerSum.toFixed(3)}% != total ${projection.total.percentPeriod.toFixed(3)}%`,
    )
  }

  const expectedAnnualized = round(projection.total.percentPeriod * (365 / holdingDays), 1)
  if (Math.abs(expectedAnnualized - projection.total.percentAnnualized) > 0.05) {
    throw new Error(
      `annualized mismatch: ${projection.total.percentAnnualized} vs ${expectedAnnualized.toFixed(1)}`,
    )
  }

  const expectedLocalLoss = -(
    annualInflation * (holdingDays / 365) +
    fxChangePct
  )
  if (Math.abs(projection.comparison.localFiatLossPercent - round(expectedLocalLoss, 2)) > 0.02) {
    throw new Error(
      `localFiatLoss mismatch: ${projection.comparison.localFiatLossPercent} vs ${round(expectedLocalLoss, 2)}`,
    )
  }

  const balanceLocal = balanceUsdc * spotFxRate
  const expectedYieldUsd = balanceUsdc * (expectedMerchantApy / 100) * (holdingDays / 365)
  const expectedYieldPct = (expectedYieldUsd / (balanceUsdc || 1)) * 100
  if (Math.abs(projection.layers.yield.percent - round(expectedYieldPct, 2)) > 0.02) {
    throw new Error(`yield percent mismatch: ${projection.layers.yield.percent} vs ${round(expectedYieldPct, 2)}`)
  }

  const expectedInflationPct = annualInflation * (holdingDays / 365)
  if (Math.abs(projection.layers.inflationAvoided.percent - round(expectedInflationPct, 2)) > 0.02) {
    throw new Error(
      `inflation percent mismatch: ${projection.layers.inflationAvoided.percent} vs ${round(expectedInflationPct, 2)}`,
    )
  }

  if (Math.abs(projection.layers.fxProtection.percent - round(fxChangePct, 2)) > 0.02) {
    throw new Error(
      `fx percent mismatch: ${projection.layers.fxProtection.percent} vs ${round(fxChangePct, 2)}`,
    )
  }

  const expectedTotalLocal =
    expectedYieldUsd * spotFxRate +
    balanceLocal * (annualInflation / 100) * (holdingDays / 365) +
    balanceLocal * (fxChangePct / 100)

  if (Math.abs(projection.total.amountLocal - round(expectedTotalLocal, 0)) > 2) {
    throw new Error(
      `total amountLocal mismatch: ${projection.total.amountLocal} vs ${round(expectedTotalLocal, 0)}`,
    )
  }
}

/** Zero-balance placeholder when no wallet is connected */
export function emptyProjection(referenceFiat: TreasuryProjectionInput["prefs"]["referenceFiat"] = "CLP"): TreasuryProjection {
  const zero = { percent: 0, amountLocal: 0 }
  return {
    periodDays: 30,
    referenceFiat,
    protocolApy: 0,
    merchantApy: 0,
    layers: {
      yield: { percent: 0, amountUsd: 0, amountLocal: 0 },
      inflationAvoided: zero,
      fxProtection: zero,
    },
    total: { percentAnnualized: 0, percentPeriod: 0, amountLocal: 0 },
    comparison: { localFiatLossPercent: 0 },
    audit: {
      balanceUsdc: 0,
      spotFxRate: 0,
      annualInflationPct: 0,
      fxChangePeriodPct: 0,
    },
    disclaimer: DISCLAIMER_ES,
    dataSource: "mock",
  }
}

/** Treasury mode config re-exported so UI components don't import treasury-modes directly */
export { TREASURY_MODE_CONFIG }

function round(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(n * factor) / factor
}
