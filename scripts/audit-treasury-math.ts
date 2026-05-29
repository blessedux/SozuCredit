/**
 * Treasury projection math audit — run: pnpm exec tsx scripts/audit-treasury-math.ts
 */

import {
  assertTreasuryProjectionInvariants,
  computeTreasuryProjection,
} from "../lib/treasury/projection-engine"
import { getInflationRate } from "../lib/treasury/mock-inflation"
import { getFxSpotRate, getFxPeriodChange } from "../lib/treasury/mock-rates"
import type { ReferenceFiat, TreasuryMode } from "../lib/treasury/types"

const FIATS: ReferenceFiat[] = ["CLP", "ARS", "BRL", "COP"]
const MODES: TreasuryMode[] = ["efficient", "balanced", "fast"]
const DAYS = [7, 14, 30, 90] as const
const PROTOCOL_APY = 16.76
const BALANCE = 1000

function runScenario(
  fiat: ReferenceFiat,
  mode: TreasuryMode,
  holdingDays: (typeof DAYS)[number],
) {
  const input = {
    balanceUsdc: BALANCE,
    prefs: { referenceFiat: fiat, mode, holdingDays },
    protocolApy: PROTOCOL_APY,
    spotFxRate: getFxSpotRate(fiat),
    fxChangePct: getFxPeriodChange(fiat, holdingDays),
    annualInflation: getInflationRate(fiat),
  }

  const projection = computeTreasuryProjection(input)
  assertTreasuryProjectionInvariants(input, projection)

  return { input, projection }
}

console.log("Treasury math audit\n" + "=".repeat(72))

let passed = 0
for (const fiat of FIATS) {
  for (const mode of MODES) {
    for (const holdingDays of DAYS) {
      const { projection: p } = runScenario(fiat, mode, holdingDays)
      passed++
      if (fiat === "CLP" && mode === "balanced" && holdingDays === 30) {
        console.log(`\nReference scenario: ${BALANCE} USDC · ${fiat} · ${mode} · ${holdingDays}d`)
        console.log(`  Protocol APY:     ${p.protocolApy.toFixed(2)}%`)
        console.log(`  Effective APY:    ${p.merchantApy.toFixed(2)}% (mode haircut)`)
        console.log(`  DeFi yield:       +${p.layers.yield.percent.toFixed(2)}%  (+$${p.layers.yield.amountUsd.toFixed(2)} USD)`)
        console.log(`  Inflation avoided:+${p.layers.inflationAvoided.percent.toFixed(2)}%`)
        console.log(`  FX protection:    +${p.layers.fxProtection.percent.toFixed(2)}%`)
        console.log(`  Total period:     +${p.total.percentPeriod.toFixed(2)}%  (sum of layers ✓)`)
        console.log(`  Annualized total: +${p.total.percentAnnualized.toFixed(1)}%  (NOT Blend APY)`)
        console.log(`  vs holding ${fiat}: ${p.comparison.localFiatLossPercent.toFixed(2)}%`)
        console.log(`  Mock inputs: CPI ${p.audit.annualInflationPct}%/yr · FX ${p.audit.fxChangePeriodPct}%/${holdingDays}d`)
      }
    }
  }
}

console.log(`\n${"=".repeat(72)}`)
console.log(`✅ ${passed} scenarios passed invariant checks`)
