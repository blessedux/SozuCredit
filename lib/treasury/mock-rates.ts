/**
 * Mock FX rates and period change estimates.
 *
 * Phase 1 (mock): static values representing approximate current spot rates
 * and estimated recent 30-day USD appreciation vs each local currency.
 *
 * Phase 2 (live): replace getFxSpotRate() and getFxPeriodChange() with:
 *   - Spot rate: lib/ledger/fx-fetch.ts → fetchFxRateToUsd() → inverted to USDXXX
 *   - Period change: store first-seen rate in localStorage/Supabase, compute
 *     delta vs current; or use Frankfurter historical endpoint.
 */

import type { ReferenceFiat } from "./types"

interface MockFxEntry {
  /** 1 USD = X local fiat (spot) */
  spotRate: number
  /** % change in USDXXX over roughly 30 days — positive = local weakened vs USD */
  change30dPct: number
}

/** Illustrative spot + ~30d USD/local drift. Percentages drive projections; spot affects CLP amounts only. */
const MOCK_FX: Record<ReferenceFiat, MockFxEntry> = {
  CLP: { spotRate: 950, change30dPct: 0.9 }, // ~11% annualized if linear (illustrative)
  ARS: { spotRate: 1100, change30dPct: 4.5 }, // high-volatility regime (illustrative)
  BRL: { spotRate: 5.65, change30dPct: 0.6 },
  COP: { spotRate: 4200, change30dPct: 0.8 },
}

/**
 * Return mock spot rate: 1 USD = X local fiat.
 *
 * @phase2 — use fetchFxRateToUsd(fiat) from lib/ledger/fx-fetch.ts and invert.
 */
export function getFxSpotRate(fiat: ReferenceFiat): number {
  return MOCK_FX[fiat]?.spotRate ?? 1
}

/**
 * Return estimated % change in USDXXX over the holding period.
 * Positive = local currency weakened (USDC holder gained purchasing power).
 * Scales the 30-day mock linearly for other periods.
 *
 * @phase2 — compute from stored FX snapshot delta.
 */
export function getFxPeriodChange(fiat: ReferenceFiat, days: number): number {
  const entry = MOCK_FX[fiat]
  if (!entry) return 0
  return entry.change30dPct * (days / 30)
}
