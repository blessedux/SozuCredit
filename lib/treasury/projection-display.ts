import type { TreasuryProjection } from "@/lib/treasury/types"
import { formatWalletText, type WalletTexts } from "@/lib/wallet-texts"

/** True when projection came from the treasury API with a real protocol APY (not empty placeholder). */
export function hasComputedTreasuryProjection(projection: TreasuryProjection | null): boolean {
  return Boolean(projection && projection.protocolApy > 0)
}

/** Blend / strategy APY for badges and rings — never the annualized purchasing-power total. */
export function treasuryYieldDisplayApy(
  projection: TreasuryProjection | null,
  protocolApy: number | null,
): number | null {
  if (hasComputedTreasuryProjection(projection)) {
    return projection!.merchantApy
  }
  if (typeof protocolApy === "number" && Number.isFinite(protocolApy) && protocolApy > 0) {
    return protocolApy
  }
  return null
}

/** Period purchasing-power gain (all layers) for the selected holding window. */
export function treasuryPeriodDisplayPct(projection: TreasuryProjection | null): number | null {
  if (!hasComputedTreasuryProjection(projection)) return null
  return projection!.total.percentPeriod
}

/** Annualized purchasing-power extrapolation — informational only, not Blend APY. */
export function treasuryAnnualizedDisplayPct(projection: TreasuryProjection | null): number | null {
  if (!hasComputedTreasuryProjection(projection)) return null
  return projection!.total.percentAnnualized
}

/** Strategy ring / badge APY: effective Blend yield after treasury mode, else live protocol APY. */
export function strategyDisplayApy(
  projection: TreasuryProjection | null,
  protocolApy: number | null,
): number | null {
  return treasuryYieldDisplayApy(projection, protocolApy)
}

export type TreasuryMathLine = {
  label: string
  detail: string
  value: string
}

/** Human-readable formula lines for the audit panel. */
export function treasuryMathBreakdown(
  projection: TreasuryProjection,
  t: WalletTexts,
): TreasuryMathLine[] {
  const days = projection.periodDays
  const fiat = projection.referenceFiat
  const { annualInflationPct, fxChangePeriodPct, spotFxRate, balanceUsdc } = projection.audit

  return [
    {
      label: t.mathBaseBalance,
      detail: formatWalletText(t.mathBaseBalanceDetail, {
        balance: balanceUsdc.toFixed(2),
        rate: String(spotFxRate),
        fiat,
      }),
      value: formatLocalEquivalent(balanceUsdc, spotFxRate, fiat),
    },
    {
      label: t.mathAnnualCpi,
      detail: formatWalletText(t.mathAnnualCpiDetail, { fiat, days }),
      value: `${annualInflationPct.toFixed(1)}% ${t.mathPerYear}`,
    },
    {
      label: t.mathFxPeriod,
      detail: formatWalletText(t.mathFxPeriodDetail, { fiat, days }),
      value: `${fxChangePeriodPct >= 0 ? "+" : ""}${fxChangePeriodPct.toFixed(2)}%`,
    },
    {
      label: t.mathProtocolApy,
      detail: t.mathProtocolApyDetail,
      value: `${projection.protocolApy.toFixed(2)}%`,
    },
    {
      label: t.mathEffectiveApy,
      detail: t.mathEffectiveApyDetail,
      value: `${projection.merchantApy.toFixed(2)}%`,
    },
    {
      label: t.mathDefiYield,
      detail: formatWalletText(t.mathDefiYieldDetail, {
        apy: projection.merchantApy.toFixed(2),
        days,
      }),
      value: `+${projection.layers.yield.percent.toFixed(2)}%`,
    },
    {
      label: t.inflationAvoided,
      detail: formatWalletText(t.mathInflationAvoidedDetail, { fiat, days }),
      value: `+${projection.layers.inflationAvoided.percent.toFixed(2)}%`,
    },
    {
      label: t.fxProtection,
      detail: formatWalletText(t.mathFxProtectionDetail, { fiat, days }),
      value: `${projection.layers.fxProtection.percent >= 0 ? "+" : ""}${projection.layers.fxProtection.percent.toFixed(2)}%`,
    },
    {
      label: t.mathPeriodTotal,
      detail: formatWalletText(t.mathPeriodTotalDetail, { days }),
      value: `${projection.total.percentPeriod >= 0 ? "+" : ""}${projection.total.percentPeriod.toFixed(2)}%`,
    },
    {
      label: t.mathAnnualized,
      detail: formatWalletText(t.mathAnnualizedDetail, {
        days,
        apy: projection.merchantApy.toFixed(2),
      }),
      value: `${projection.total.percentAnnualized >= 0 ? "+" : ""}${projection.total.percentAnnualized.toFixed(1)}%`,
    },
    {
      label: formatWalletText(t.mathVsLocalFiat, { fiat }),
      detail: t.mathVsLocalFiatDetail,
      value: `${projection.comparison.localFiatLossPercent.toFixed(2)}%`,
    },
  ]
}

function formatLocalEquivalent(balanceUsdc: number, spotFxRate: number, fiat: TreasuryProjection["referenceFiat"]): string {
  const local = balanceUsdc * spotFxRate
  if (fiat === "CLP" || fiat === "ARS") return `${Math.round(local).toLocaleString("es-CL")} ${fiat}`
  return `${local.toFixed(2)} ${fiat}`
}
