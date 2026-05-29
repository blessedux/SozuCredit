"use client"

import { memo, useId, useMemo } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { formatFiatAmount } from "@/lib/ledger/format-fiat"
import { buildPurchasingPowerSeries } from "@/lib/treasury/purchasing-power-series"
import type { TreasuryProjection } from "@/lib/treasury/types"
import { cn } from "@/lib/utils"
import { useWalletLanguage } from "@/lib/wallet-language"
import { formatWalletText } from "@/lib/wallet-texts"

type ChartConfig = {
  total: { label: string; color: string }
}

type PurchasingPowerPnlChartProps = {
  projection: TreasuryProjection | null
  loading?: boolean
  variant?: "full" | "compact" | "mini"
  className?: string
}

function PnlTooltip({
  active,
  payload,
  fiat,
  t,
}: {
  active?: boolean
  payload?: Array<{
    payload?: {
      day: number
      total: number
      totalPct: number
      dailyDelta: number
      yield: number
      inflation: number
      fx: number
    }
  }>
  fiat: string
  t: {
    chartToday: string
    chartDayLabel: string
    chartDailyDelta: string
    inflationAvoided: string
  }
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null

  return (
    <div className="rounded-lg border border-white/15 bg-black/90 px-3 py-2 text-xs shadow-xl backdrop-blur-md">
      <p className="font-medium text-white/90">
        {row.day === 0 ? t.chartToday : formatWalletText(t.chartDayLabel, { day: row.day })}
      </p>
      <p className="mt-1 tabular-nums text-emerald-300">
        {row.total >= 0 ? "+" : ""}
        {formatFiatAmount(row.total, fiat)}{" "}
        <span className="text-white/45">({row.totalPct >= 0 ? "+" : ""}{row.totalPct.toFixed(2)}%)</span>
      </p>
      {row.day > 0 ? (
        <p className="mt-0.5 text-[10px] tabular-nums text-white/45">
          {t.chartDailyDelta} {row.dailyDelta >= 0 ? "+" : ""}
          {formatFiatAmount(row.dailyDelta, fiat)}
        </p>
      ) : null}
      <div className="mt-2 space-y-1 text-[10px] text-white/55">
        <p className="flex justify-between gap-4">
          <span>DeFi</span>
          <span className="tabular-nums text-emerald-300/90">+{formatFiatAmount(row.yield, fiat)}</span>
        </p>
        <p className="flex justify-between gap-4">
          <span>{t.inflationAvoided}</span>
          <span className="tabular-nums text-sky-300/90">+{formatFiatAmount(row.inflation, fiat)}</span>
        </p>
        <p className="flex justify-between gap-4">
          <span>FX</span>
          <span className={cn("tabular-nums", row.fx >= 0 ? "text-violet-300/90" : "text-rose-300/90")}>
            {row.fx >= 0 ? "+" : ""}
            {formatFiatAmount(row.fx, fiat)}
          </span>
        </p>
      </div>
    </div>
  )
}

export const PurchasingPowerPnlChart = memo(function PurchasingPowerPnlChart({
  projection,
  loading = false,
  variant = "full",
  className,
}: PurchasingPowerPnlChartProps) {
  const { t } = useWalletLanguage()
  const chartConfig: ChartConfig = {
    total: { label: t.chartPurchasingPower, color: "#34d399" },
  }
  const chartId = useId().replace(/:/g, "")
  const fiat = projection?.referenceFiat ?? "CLP"
  const series = useMemo(
    () => (projection ? buildPurchasingPowerSeries(projection) : []),
    [projection],
  )

  const latest = series.length > 0 ? series[series.length - 1] : null
  const plotInset =
    variant === "mini"
      ? { left: 6, right: 6 }
      : variant === "compact"
        ? { left: 18, right: 18 }
        : { left: 28, right: 28 }
  const yDomain = useMemo(() => {
    if (series.length === 0) return [0, 1] as [number, number]
    const values = series.flatMap((p) => [p.total, 0])
    const min = Math.min(...values)
    const max = Math.max(...values)
    const pad = Math.max((max - min) * 0.12, max * 0.05, 1)
    return [Math.min(0, min - pad), max + pad] as [number, number]
  }, [series])

  if (loading) {
    return (
      <div
        className={cn(
          "animate-pulse rounded-xl border border-white/10 bg-white/[0.03]",
          variant === "mini" ? "h-[4.5rem] w-[5.5rem]" : variant === "compact" ? "h-16" : "h-52",
          className,
        )}
      />
    )
  }

  if (!projection || series.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] text-[11px] text-white/40",
          variant === "mini" ? "h-[4.5rem] w-[5.5rem] text-[8px]" : variant === "compact" ? "h-16" : "h-52",
          className,
        )}
      >
        {variant === "mini" ? "—" : t.chartNoProjection}
      </div>
    )
  }

  if (variant === "mini") {
    return (
      <div
        className={cn(
          "relative flex w-[5.75rem] shrink-0 flex-col items-stretch rounded-xl border border-white/10 bg-white/[0.03] px-1.5 pb-1.5 pt-1",
          className,
        )}
        aria-hidden
      >
        <span className="text-center text-[8px] uppercase tracking-wider text-white/30">
          PNL {projection.periodDays}d
        </span>
        <ChartContainer
          config={chartConfig}
          className="!aspect-auto h-[2.75rem] w-full [&_.recharts-cartesian-axis-tick_text]:hidden [&_.recharts-cartesian-grid]:hidden"
        >
          <AreaChart
            data={series}
            margin={{ top: 4, right: plotInset.right, left: plotInset.left, bottom: 0 }}
          >
            <defs>
              <linearGradient id={`ppPnlMiniFill-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`ppPnlMiniStroke-${chartId}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.1} />
                <stop offset="18%" stopColor="#6ee7b7" stopOpacity={1} />
                <stop offset="82%" stopColor="#6ee7b7" stopOpacity={1} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <YAxis hide domain={yDomain} />
            <Area
              type="monotone"
              dataKey="total"
              stroke={`url(#ppPnlMiniStroke-${chartId})`}
              strokeWidth={1.75}
              fill={`url(#ppPnlMiniFill-${chartId})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
        {latest ? (
          <p className="truncate text-center text-[9px] font-semibold tabular-nums leading-none text-emerald-300/95">
            {latest.total >= 0 ? "+" : ""}
            {formatFiatAmount(latest.total, fiat)}
          </p>
        ) : null}
      </div>
    )
  }

  if (variant === "compact") {
    return (
      <div className={cn("relative px-5 sm:px-8", className)}>
        <ChartContainer
          config={chartConfig}
          className="!aspect-auto mx-auto h-[4.25rem] w-full max-w-[82%] [&_.recharts-cartesian-axis-tick_text]:hidden [&_.recharts-cartesian-grid]:hidden"
        >
          <AreaChart
            data={series}
            margin={{ top: 16, right: plotInset.right, left: plotInset.left, bottom: 2 }}
          >
            <defs>
              <linearGradient id={`ppPnlCompactFill-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.42} />
                <stop offset="55%" stopColor="#34d399" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`ppPnlCompactStroke-${chartId}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.15} />
                <stop offset="12%" stopColor="#6ee7b7" stopOpacity={1} />
                <stop offset="88%" stopColor="#6ee7b7" stopOpacity={1} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0.15} />
              </linearGradient>
            </defs>
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
            <YAxis hide domain={yDomain} />
            <Area
              type="monotone"
              dataKey="total"
              stroke={`url(#ppPnlCompactStroke-${chartId})`}
              strokeWidth={2.25}
              fill={`url(#ppPnlCompactFill-${chartId})`}
              dot={false}
              activeDot={{ r: 3, fill: "#6ee7b7", stroke: "#052e1a", strokeWidth: 2 }}
              isAnimationActive
            />
          </AreaChart>
        </ChartContainer>
        {latest ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-1">
            <span className="text-[9px] uppercase tracking-wider text-white/35">PNL {projection.periodDays}d</span>
            <span className="text-[11px] font-semibold tabular-nums text-emerald-300">
              {latest.total >= 0 ? "+" : ""}
              {formatFiatAmount(latest.total, fiat)}
            </span>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-end justify-between gap-3 px-0.5">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/40">{t.chartPnlTitle}</p>
          <p className="mt-0.5 text-xs text-white/50">
            {formatWalletText(t.projectionHeading, {
              days: projection.periodDays,
              fiat,
            })}
          </p>
        </div>
        {latest ? (
          <div className="text-right">
            <p className="text-lg font-bold tabular-nums text-emerald-300">
              {latest.total >= 0 ? "+" : ""}
              {formatFiatAmount(latest.total, fiat)}
            </p>
            <p className="text-[10px] tabular-nums text-white/45">
              {formatWalletText(t.chartVsInitialBalance, {
                sign: latest.totalPct >= 0 ? "+" : "",
                pct: latest.totalPct.toFixed(2),
              })}
            </p>
          </div>
        ) : null}
      </div>

      <ChartContainer
        config={chartConfig}
        className="!aspect-auto mx-auto h-52 w-full max-w-[92%] [&_.recharts-cartesian-axis-tick_text]:fill-white/35 [&_.recharts-cartesian-grid_line]:stroke-white/[0.06]"
      >
        <AreaChart
          data={series}
          margin={{ top: 12, right: plotInset.right, left: plotInset.left, bottom: 6 }}
        >
          <defs>
            <linearGradient id={`ppPnlTotalFill-${chartId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.38} />
              <stop offset="45%" stopColor="#34d399" stopOpacity={0.14} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`ppPnlTotalStroke-${chartId}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.2} />
              <stop offset="10%" stopColor="#6ee7b7" stopOpacity={1} />
              <stop offset="90%" stopColor="#6ee7b7" stopOpacity={1} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={18}
          />
          <YAxis hide domain={yDomain} />
          <ChartTooltip content={<PnlTooltip fiat={fiat} t={t} />} cursor={{ stroke: "rgba(110,231,183,0.35)" }} />
          <Area
            type="monotone"
            dataKey="total"
            stroke={`url(#ppPnlTotalStroke-${chartId})`}
            strokeWidth={2.5}
            fill={`url(#ppPnlTotalFill-${chartId})`}
            dot={
              projection.periodDays <= 14
                ? { r: 2, fill: "#6ee7b7", stroke: "#052e1a", strokeWidth: 1 }
                : false
            }
            activeDot={{ r: 5, fill: "#6ee7b7", stroke: "#052e1a", strokeWidth: 2 }}
            isAnimationActive
          />
        </AreaChart>
      </ChartContainer>

      <p className="px-0.5 text-center text-[10px] leading-relaxed text-white/35">
        {t.chartFootnote}
      </p>
    </div>
  )
})
