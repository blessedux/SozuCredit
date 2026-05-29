"use client"

import { memo, useCallback, useMemo, useState } from "react"
import { CashflowSummarySkeleton } from "@/components/wallet/wallet-skeleton-parts"
import { MetricRing } from "@/components/wallet/metric-ring"
import { formatFiatAmount } from "@/lib/ledger/format-fiat"
import { TREASURY_MODE_CONFIG } from "@/lib/treasury/treasury-modes"
import { strategyDisplayApy } from "@/lib/treasury/projection-display"
import type { TreasuryProjection, TreasuryPrefs } from "@/lib/treasury/types"
import type { CreditAccessSnapshot, LedgerSummarySnapshot } from "@/hooks/use-cashflow-summary"
import { useAppHaptics } from "@/hooks/use-app-haptics"
import { cn } from "@/lib/utils"

type MetricId = "runway" | "burn" | "credit" | "strategy"

const DETAIL_PANEL_CLASS: Record<MetricId, string> = {
  runway: "left-[calc(50%+0.375rem)] inset-y-0 right-0",
  burn: "left-0 inset-y-0 right-[calc(50%+0.375rem)]",
  credit: "left-[calc(50%+0.375rem)] inset-y-0 right-0",
  strategy: "left-0 inset-y-0 right-[calc(50%+0.375rem)]",
}

function runwayLabel(months: number | null): string {
  if (months == null || !Number.isFinite(months)) return "—"
  if (months >= 240) return "240+"
  if (months >= 10) return `${Math.round(months)}m`
  if (months >= 1) return `${months.toLocaleString("es-CL", { maximumFractionDigits: 1 })}m`
  return `${Math.max(0, Math.round(months * 30))}d`
}

function runwayLabelLong(months: number | null): string {
  if (months == null || !Number.isFinite(months)) return "—"
  if (months >= 240) return "240+ meses"
  if (months >= 1) {
    return `${months.toLocaleString("es-CL", { maximumFractionDigits: 1 })} meses`
  }
  return `${Math.max(0, Math.round(months * 30))} días`
}

function runwayProgress(months: number | null): number {
  if (months == null || !Number.isFinite(months) || months <= 0) return 0
  return Math.min(1, months / 12)
}

function burnProgress(expense: number, planned: number): number {
  if (expense <= 0) return 0
  const cap = Math.max(planned, expense, 1)
  return Math.min(1, expense / cap)
}

function formatCompactFiat(value: number, currency: string): string {
  if (!Number.isFinite(value) || value <= 0) return "—"
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })}M`
  }
  if (value >= 10_000) {
    return `${Math.round(value / 1000)}k`
  }
  return formatFiatAmount(value, currency).replace(/\s/g, "")
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.06] py-2 last:border-0">
      <span className="text-[10px] text-white/45">{label}</span>
      <span className="text-right text-[11px] font-medium tabular-nums text-white/85">{value}</span>
    </div>
  )
}

type CashflowSummaryCardProps = {
  summary: LedgerSummarySnapshot | null
  credit: CreditAccessSnapshot | null
  loading?: boolean
  treasuryProjection: TreasuryProjection | null
  treasuryPrefs: TreasuryPrefs
  protocolApy: number | null
}

export const CashflowSummaryCard = memo(function CashflowSummaryCard({
  summary,
  credit,
  loading = false,
  treasuryProjection,
  treasuryPrefs,
  protocolApy,
}: CashflowSummaryCardProps) {
  const { play: haptic } = useAppHaptics()
  const [focused, setFocused] = useState<MetricId | null>(null)
  const cur = summary?.primaryCurrency ?? treasuryPrefs.referenceFiat
  const br = summary?.burnRunway

  const metrics = useMemo(() => {
    const runwayMonths = br?.runwayMonths ?? null
    const grossBurn = br?.avgMonthlyGrossExpensePrimary ?? 0
    const plannedBurn = br?.plannedMonthlyBurnPrimary ?? 0
    const liquid = br?.liquidPrimaryEquivalent ?? 0

    const creditProgress = credit ? Math.min(1, credit.trustworthyVouchesCount / 5) : 0
    const preApproved = credit?.eligible
      ? Math.max(liquid * 0.35, grossBurn * 2)
      : credit
        ? Math.max(liquid * 0.12, grossBurn * 0.5)
        : liquid * 0.15

    const strategyPct = strategyDisplayApy(treasuryProjection, protocolApy) ?? 0
    const strategyProgress = Math.min(1, Math.max(0, strategyPct / 25))
    const modeLabel = TREASURY_MODE_CONFIG[treasuryPrefs.mode].label

    return {
      runway: {
        progress: runwayProgress(runwayMonths),
        value: runwayLabel(runwayMonths),
        label: "Runway",
        sublabel: runwayMonths != null ? "liquidez ÷ gasto" : "sin datos",
        accent: "rgba(56,189,248,0.95)",
      },
      burn: {
        progress: burnProgress(grossBurn, plannedBurn),
        value: grossBurn > 0 ? formatCompactFiat(grossBurn, cur) : "—",
        label: "Burn rate",
        sublabel: "prom. mensual",
        accent: "rgba(251,146,60,0.95)",
      },
      credit: {
        progress: credit?.eligible ? 1 : creditProgress,
        value: formatCompactFiat(preApproved, cur),
        label: "Crédito",
        sublabel: credit?.eligible ? "pre-aprobado" : `${credit?.trustworthyVouchesCount ?? 0}/5 confianza`,
        accent: "rgba(167,139,250,0.95)",
      },
      strategy: {
        progress: strategyProgress,
        value: strategyPct > 0 ? `+${strategyPct.toFixed(1)}%` : "—",
        label: "Estrategia",
        sublabel: modeLabel,
        accent: "rgba(52,211,153,0.95)",
      },
      preApproved,
      strategyPct,
      grossBurn,
      plannedBurn,
      runwayMonths,
    }
  }, [br, credit, cur, protocolApy, treasuryPrefs.mode, treasuryProjection])

  const handleSelect = useCallback(
    (id: MetricId) => {
      haptic()
      setFocused((prev) => (prev === id ? null : id))
    },
    [haptic],
  )

  const handleDismiss = useCallback(() => {
    if (!focused) return
    haptic()
    setFocused(null)
  }, [focused, haptic])

  const ringItems: { id: MetricId; metric: (typeof metrics)["runway"] }[] = [
    { id: "runway", metric: metrics.runway },
    { id: "burn", metric: metrics.burn },
    { id: "credit", metric: metrics.credit },
    { id: "strategy", metric: metrics.strategy },
  ]

  const modeConfig = TREASURY_MODE_CONFIG[treasuryPrefs.mode]

  const detailPanel = focused ? (
    <div
      className={cn(
        "absolute z-10 overflow-y-auto overscroll-contain no-scrollbar rounded-lg border border-white/10 bg-black/50 px-2.5 py-2 backdrop-blur-sm",
        DETAIL_PANEL_CLASS[focused],
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {focused === "runway" && (
        <>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-sky-200/70">Runway</p>
          <DetailRow label="Horizonte estimado" value={runwayLabelLong(metrics.runwayMonths)} />
          <DetailRow
            label="Recursos (liquidez + ingreso)"
            value={br ? formatFiatAmount(br.runwayResourcePrimary, cur) : "—"}
          />
          <DetailRow
            label="Liquidez disponible"
            value={br ? formatFiatAmount(br.liquidPrimaryEquivalent, cur) : "—"}
          />
          <DetailRow
            label="Ingreso bruto prom./mes"
            value={br ? formatFiatAmount(br.avgMonthlyGrossIncomePrimary, cur) : "—"}
          />
        </>
      )}

      {focused === "burn" && (
        <>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-orange-200/70">
            Burn rate
          </p>
          <DetailRow
            label="Gasto bruto prom./mes"
            value={metrics.grossBurn > 0 ? formatFiatAmount(metrics.grossBurn, cur) : "—"}
          />
          <DetailRow
            label="Plan mensual (obligaciones)"
            value={metrics.plannedBurn > 0 ? formatFiatAmount(metrics.plannedBurn, cur) : "—"}
          />
          <DetailRow
            label="Gastos este mes"
            value={summary ? formatFiatAmount(summary.expensesThisMonth, cur) : "—"}
          />
          <DetailRow
            label="Ingresos este mes"
            value={summary ? formatFiatAmount(summary.incomeThisMonth, cur) : "—"}
          />
        </>
      )}

      {focused === "credit" && (
        <>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-violet-200/70">
            Crédito
          </p>
          <DetailRow
            label="Acceso pre-aprobado (est.)"
            value={formatFiatAmount(metrics.preApproved, cur)}
          />
          <DetailRow label="Elegible" value={credit?.eligible ? "Sí" : "Aún no"} />
          <DetailRow
            label="Vouches confiables"
            value={`${credit?.trustworthyVouchesCount ?? 0} / 5`}
          />
          <DetailRow label="Puntos de confianza" value={`${credit?.totalTrustPoints ?? 0}`} />
        </>
      )}

      {focused === "strategy" && (
        <>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-emerald-200/70">
            Estrategia personal
          </p>
          <DetailRow
            label="Poder adquisitivo (anual)"
            value={metrics.strategyPct > 0 ? `+${metrics.strategyPct.toFixed(2)}%` : "—"}
          />
          <DetailRow
            label="APY protocolo"
            value={protocolApy != null ? `${protocolApy.toFixed(2)}%` : "—"}
          />
          <DetailRow label="Modo" value={modeConfig.label} />
          <DetailRow label="Enfoque" value={modeConfig.description} />
          {treasuryProjection ? (
            <DetailRow
              label="Rendimiento DeFindex (capa)"
              value={`+${treasuryProjection.layers.yield.percent.toFixed(2)}%`}
            />
          ) : null}
        </>
      )}
    </div>
  ) : null

  if (loading) {
    return <CashflowSummarySkeleton />
  }

  return (
    <section
      className={cn(
        "rounded-xl border border-white/10 bg-black/20 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-md transition-colors",
        focused && "cursor-pointer",
      )}
      onClick={focused ? handleDismiss : undefined}
      onKeyDown={
        focused
          ? (e) => {
              if (e.key === "Escape") handleDismiss()
            }
          : undefined
      }
      role={focused ? "button" : undefined}
      tabIndex={focused ? 0 : undefined}
      aria-label={focused ? "Volver al resumen de cashflow" : undefined}
    >
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
          Cashflow summary
        </h2>
        {focused ? (
          <span className="text-[9px] text-white/35">Toca fuera para volver</span>
        ) : (
          <span className="text-[9px] tabular-nums text-white/30">
            {summary ? `${formatCompactFiat(summary.netCashflow, cur)} neto` : "Vista previa"}
          </span>
        )}
      </div>

      <div className="relative min-h-[11.5rem]">
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-4">
          {ringItems.map(({ id, metric }) => {
            const isFocused = focused === id
            const isDimmed = focused !== null && !isFocused

            return (
              <button
                key={id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleSelect(id)
                }}
                className={cn(
                  "relative z-20 flex min-w-0 flex-col items-center rounded-xl border border-transparent p-1 transition-all duration-300 ease-out",
                  "active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25",
                  isFocused && "border-white/10 bg-white/[0.04]",
                  isDimmed && "pointer-events-none opacity-[0.12] scale-[0.92]",
                )}
                aria-pressed={isFocused}
                aria-label={`${metric.label}${isFocused ? ", expandido" : ""}`}
                aria-hidden={isDimmed ? true : undefined}
                tabIndex={isDimmed ? -1 : 0}
              >
                <MetricRing
                  progress={metric.progress}
                  value={metric.value}
                  label={metric.label}
                  sublabel={isFocused ? undefined : metric.sublabel}
                  accent={metric.accent}
                  size={84}
                />
              </button>
            )
          })}
        </div>

        {detailPanel}
      </div>

      {!focused ? (
        <p className="mt-4 text-[9px] leading-relaxed text-white/28">
          Toca un indicador para ver detalle. Estrategia personal — no solo DeFindex.
        </p>
      ) : null}
    </section>
  )
})
