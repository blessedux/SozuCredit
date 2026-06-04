/**
 * Treasury Purchasing Power Engine — shared types
 *
 * USDC is canonical state. Reference fiats (CLP, ARS, BRL, COP, USD) are
 * display/context layers only — never source of truth.
 */

export const REFERENCE_FIAT_OPTIONS = ["CLP", "ARS", "BRL", "COP", "USD"] as const
export type ReferenceFiat = (typeof REFERENCE_FIAT_OPTIONS)[number]

export type TreasuryMode = "efficient" | "balanced" | "fast"

export interface TreasuryPrefs {
  referenceFiat: ReferenceFiat
  mode: TreasuryMode
  holdingDays: 7 | 14 | 30 | 90
}

export const TREASURY_PREFS_DEFAULTS: TreasuryPrefs = {
  referenceFiat: "CLP",
  mode: "balanced",
  holdingDays: 30,
}

export interface TreasuryLayerBreakdown {
  /** Period percent contribution (e.g. 0.60 = 0.60%) */
  percent: number
  /** Amount in USDC (yield layer only) */
  amountUsd?: number
  /** Amount in reference fiat */
  amountLocal: number
}

export interface TreasuryProjection {
  periodDays: number
  referenceFiat: ReferenceFiat
  /** Raw Blend/DeFindex protocol APY, percent */
  protocolApy: number
  /** After mode haircut, percent */
  merchantApy: number
  layers: {
    yield: TreasuryLayerBreakdown & { amountUsd: number }
    inflationAvoided: TreasuryLayerBreakdown
    fxProtection: TreasuryLayerBreakdown
  }
  total: {
    percentAnnualized: number
    percentPeriod: number
    amountLocal: number
  }
  comparison: {
    /** Estimated % loss if held in local fiat (negative = loss) */
    localFiatLossPercent: number
  }
  /** Raw inputs used for this projection — for audit / UI breakdown */
  audit: {
    balanceUsdc: number
    spotFxRate: number
    /** Annual CPI % for reference fiat */
    annualInflationPct: number
    /** USD/local FX change over the holding window (already period-scaled) */
    fxChangePeriodPct: number
  }
  disclaimer: string
  dataSource: "mock" | "live"
}

/** Inputs consumed by computeTreasuryProjection */
export interface TreasuryProjectionInput {
  balanceUsdc: number
  prefs: TreasuryPrefs
  /** Annual yield from protocol, percent */
  protocolApy: number
  /** Current spot rate: 1 USD = X local fiat */
  spotFxRate: number
  /** % change in USDXXX over the holding period — positive = local currency weakened */
  fxChangePct: number
  /** Annual CPI for reference fiat, percent */
  annualInflation: number
}
