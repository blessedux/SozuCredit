"use client"

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { formatFiatAmount } from "@/lib/ledger/format-fiat"
import { cn } from "@/lib/utils"

export type DonutDatum = {
  name: string
  value: number
  pct: number
  /** Extra line in tooltip */
  meta?: string
  /** Stable key for filtering (e.g. ledger category slug); optional display uses `name`. */
  filterKey?: string
}

const COLORS = [
  "#38bdf8",
  "#a78bfa",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#fb923c",
  "#2dd4bf",
  "#818cf8",
  "#f87171",
  "#e879f9",
  "#94a3b8",
  "#22d3ee",
]

type Props = {
  data: DonutDatum[]
  currency: string
  /** rose = expenses, emerald = income tint on strokes */
  tint?: "rose" | "emerald" | "sky"
  selectedFilterKey?: string | null
  /** Category / drill-down: clicking a slice or legend row invokes this. */
  onFilterClick?: (datum: DonutDatum) => void
  /** Shown when there is no positive slice data (default assumes expenses). */
  emptyMessage?: string
  /** Chart stacked above legend (narrow columns / side panels). */
  stackLegend?: boolean
}

export function ExpenseBreakdownDonut({
  data,
  currency,
  tint = "sky",
  selectedFilterKey,
  onFilterClick,
  emptyMessage = "Sin gastos en esta ventana y moneda.",
  stackLegend = false,
}: Props) {
  const positive = data.filter((d) => d.value > 0)
  if (positive.length === 0) {
    return (
      <p className={cn("text-sm text-white/45 text-center", stackLegend ? "py-6" : "py-10")}>{emptyMessage}</p>
    )
  }

  const stroke =
    tint === "rose"
      ? "rgba(251,113,133,0.12)"
      : tint === "emerald"
        ? "rgba(52,211,153,0.12)"
        : "rgba(56,189,248,0.12)"

  return (
    <div
      className={cn(
        "flex w-full gap-4",
        stackLegend
          ? "flex-col items-center"
          : "flex-col items-center lg:flex-row lg:items-start lg:justify-between lg:gap-6"
      )}
    >
      <div
        className={cn(
          "mx-auto w-full shrink-0 [&_.recharts-wrapper]:outline-none",
          stackLegend
            ? "h-[200px] max-w-[220px]"
            : "h-[240px] max-w-[280px] lg:mx-0 lg:h-[260px] lg:w-[240px] lg:max-w-none"
        )}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={positive}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="54%"
              outerRadius="84%"
              paddingAngle={2.5}
              stroke={stroke}
              strokeWidth={1}
              isAnimationActive
              animationDuration={320}
              animationEasing="ease-out"
              cursor={onFilterClick ? "pointer" : "default"}
              onClick={
                onFilterClick
                  ? (_entry: unknown, index: number) => {
                      const d = positive[index]
                      if (d?.filterKey) onFilterClick(d)
                    }
                  : undefined
              }
            >
              {positive.map((entry, i) => {
                const active =
                  Boolean(selectedFilterKey && entry.filterKey && selectedFilterKey === entry.filterKey)
                return (
                  <Cell
                    key={`${entry.filterKey ?? entry.name}-${i}`}
                    fill={COLORS[i % COLORS.length]}
                    stroke={active ? "rgba(255,255,255,0.85)" : stroke}
                    strokeWidth={active ? 2 : 1}
                  />
                )
              })}
            </Pie>
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as DonutDatum
                return (
                  <div className="rounded-lg border border-white/15 bg-neutral-950/95 px-3 py-2 text-xs shadow-xl backdrop-blur-md">
                    <p className="font-medium text-white">{p.name}</p>
                    <p className="text-white/80 tabular-nums mt-0.5">{formatFiatAmount(p.value, currency)}</p>
                    <p className="text-white/45">
                      {p.meta ? `${p.pct}% del total · ${p.meta}` : `${p.pct}% del total`}
                    </p>
                    {onFilterClick && p.filterKey ? (
                      <p className="text-white/35 mt-1">Clic para filtrar movimientos</p>
                    ) : null}
                  </div>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul
        className={cn(
          "w-full overflow-y-auto space-y-1.5 px-1 text-[11px] text-white/65",
          stackLegend ? "max-h-32 w-full max-w-[260px]" : "max-h-36 lg:max-h-52 lg:flex-1 lg:min-w-0 lg:self-center lg:px-0"
        )}
      >
        {positive.map((d, i) => {
          const active =
            Boolean(selectedFilterKey && d.filterKey && selectedFilterKey === d.filterKey)
          const Row = (
            <>
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className={`truncate ${active ? "text-white font-medium" : ""}`}>{d.name}</span>
              </span>
              <span className="text-white/85 tabular-nums shrink-0">{d.pct}%</span>
            </>
          )
          return (
            <li key={`${d.filterKey ?? d.name}-${i}`}>
              {onFilterClick && d.filterKey ? (
                <button
                  type="button"
                  onClick={() => onFilterClick(d)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-white/[0.07] focus-visible:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 ${active ? "bg-white/[0.06]" : ""}`}
                >
                  {Row}
                </button>
              ) : (
                <div className="flex items-center justify-between gap-2 px-1 py-0.5">{Row}</div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
