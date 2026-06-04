/**
 * GET /api/wallet/treasury/projection
 *
 * Returns a TreasuryProjection for the given balance and user preferences.
 *
 * Phase 1: uses mock inflation/FX data. APY is fetched live from Blend
 * when available (via getRealTimeAPY), otherwise falls back to 15.5%.
 *
 * Query params:
 *   balance       — USDC balance (number, required)
 *   referenceFiat — CLP | ARS | BRL | COP | USD  (default: CLP)
 *   mode          — efficient | balanced | fast  (default: balanced)
 *   holdingDays   — 7 | 14 | 30 | 90  (default: 30)
 */

import { NextRequest, NextResponse } from "next/server"
import { resolveWalletUserId } from "@/lib/wallet/resolve-wallet-user-id"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { getRealTimeAPY } from "@/lib/defindex/apy-calculator"
import { computeTreasuryProjection, emptyProjection } from "@/lib/treasury/projection-engine"
import { getInflationRate } from "@/lib/treasury/mock-inflation"
import { getFxSpotRate, getFxPeriodChange } from "@/lib/treasury/mock-rates"
import type { ReferenceFiat, TreasuryMode, TreasuryPrefs } from "@/lib/treasury/types"
import { REFERENCE_FIAT_OPTIONS, TREASURY_PREFS_DEFAULTS } from "@/lib/treasury/types"

export const dynamic = "force-dynamic"

const VALID_FIATS: ReferenceFiat[] = [...REFERENCE_FIAT_OPTIONS]
const VALID_MODES: TreasuryMode[] = ["efficient", "balanced", "fast"]
const VALID_DAYS: Array<7 | 14 | 30 | 90> = [7, 14, 30, 90]

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveWalletUserId(request)
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders(request) }
      )
    }

    const url = new URL(request.url)
    const rawBalance = parseFloat(url.searchParams.get("balance") ?? "0")
    const balance = isFinite(rawBalance) && rawBalance >= 0 ? rawBalance : 0

    const rawFiat = url.searchParams.get("referenceFiat")?.toUpperCase() as ReferenceFiat
    const referenceFiat: ReferenceFiat = VALID_FIATS.includes(rawFiat)
      ? rawFiat
      : TREASURY_PREFS_DEFAULTS.referenceFiat

    const rawMode = url.searchParams.get("mode") as TreasuryMode
    const mode: TreasuryMode = VALID_MODES.includes(rawMode)
      ? rawMode
      : TREASURY_PREFS_DEFAULTS.mode

    const rawDays = parseInt(url.searchParams.get("holdingDays") ?? "30")
    const holdingDays = (VALID_DAYS.includes(rawDays as 7 | 14 | 30 | 90)
      ? rawDays
      : 30) as 7 | 14 | 30 | 90

    if (balance === 0) {
      return NextResponse.json(
        { success: true, projection: emptyProjection(referenceFiat) },
        { headers: corsHeaders(request) }
      )
    }

    // Try live APY — fall back to 15.5% on failure
    const rawStrategyId = url.searchParams.get("strategyId")
    const strategyId = rawStrategyId === "yieldblox" ? "yieldblox" : "fixed"

    let protocolApy = 15.5
    try {
      const apyResult = await getRealTimeAPY(strategyId)
      if (apyResult.success && apyResult.data) {
        protocolApy = apyResult.data.yearly
      }
    } catch {
      // non-fatal — use fallback
    }

    const prefs: TreasuryPrefs = { referenceFiat, mode, holdingDays }
    const spotFxRate = getFxSpotRate(referenceFiat)
    const fxChangePct = getFxPeriodChange(referenceFiat, holdingDays)
    const annualInflation = getInflationRate(referenceFiat)

    const projection = computeTreasuryProjection({
      balanceUsdc: balance,
      prefs,
      protocolApy,
      spotFxRate,
      fxChangePct,
      annualInflation,
    })

    return NextResponse.json(
      { success: true, projection },
      { headers: corsHeaders(request) }
    )
  } catch (error) {
    console.error("[Treasury Projection API] Unexpected error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}
