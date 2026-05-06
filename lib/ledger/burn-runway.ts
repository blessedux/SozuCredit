import {
  dedupeExpenseRowsForAggregation,
  type DedupeExpenseRow,
} from "@/lib/ledger/expense-dedupe"
import { fetchFxRateToUsd } from "@/lib/ledger/fx-fetch"
import {
  type MonthlyObligationLine,
  sumMonthlyObligations,
} from "@/lib/ledger/monthly-obligations-plan"
import { transactionInstantMs } from "@/lib/ledger/transaction-date"

export type BurnRunwayBasis = "avg_completed_3utc" | "partial_month"

export type BurnRunwayPayload = {
  /** Net outflow (gastos − ingresos), floored at 0 — used for vs-plan and legacy «quema neta». */
  burnRateMonthlyPrimary: number
  basis: BurnRunwayBasis
  completedMonthsSampled: number
  runwayMonths: number | null
  /** Liquidez + ingreso bruto mensual típico (misma ventana que el promedio de gasto). */
  runwayResourcePrimary: number
  liquidPrimaryEquivalent: number
  walletUsdc: number | null
  walletPrimaryEquivalent: number | null
  vaultAssetsPrimaryEquivalent: number
  /** Mean gross monthly expenses (primary), same UTC window as `basis`. */
  avgMonthlyGrossExpensePrimary: number
  /** Mean gross monthly income + refunds (primary), same window. */
  avgMonthlyGrossIncomePrimary: number
  /** Mes UTC en curso: gastos brutos MTD proyectados a fin de mes (lineal). */
  projectedGrossExpenseThisMonthPrimary: number
  /** Sum of user-entered monthly obligations (primary fiat). */
  plannedMonthlyBurnPrimary: number
  obligationLines: MonthlyObligationLine[]
  /** Actual − plan; positive = spending faster than plan. Null when no obligation rows. */
  burnVsPlanDelta: number | null
  /** (runwayResourcePrimary) ÷ planned monthly obligations (months). Null when plan sum ≤ 0. */
  runwayMonthsAtPlannedBurn: number | null
}

function utcMonthBounds(year: number, monthIndex: number): { startMs: number; endMs: number } {
  const startMs = Date.UTC(year, monthIndex, 1, 0, 0, 0, 0)
  const endMs = Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999)
  return { startMs, endMs }
}

function filterRowsMonth<T extends { date: string }>(
  rows: T[],
  year: number,
  monthIndex: number
): T[] {
  const { startMs, endMs } = utcMonthBounds(year, monthIndex)
  return rows.filter((r) => {
    const t = transactionInstantMs(r.date)
    return t != null && t >= startMs && t <= endMs
  })
}

/** First instant (UTC) of the calendar month N months before `now`’s UTC month (used for burn history fetch). */
export function ledgerBurnHistoryRangeLowMs(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1, 0, 0, 0, 0)
}

function shiftUtcMonth(y: number, m: number, delta: number): { y: number; m: number } {
  const d = new Date(Date.UTC(y, m + delta, 1))
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() }
}

export function monthlyNetBurnPrimary(
  dedupedMonthRows: DedupeExpenseRow[],
  primary: string
): number {
  const p = primary.toUpperCase()
  let income = 0
  let expenses = 0
  for (const r of dedupedMonthRows) {
    if (r.currency.toUpperCase() !== p) continue
    const amt = Math.abs(r.amount)
    if (r.type === "income" || r.type === "refund") income += amt
    else if (r.type === "expense") expenses += amt
  }
  return Math.max(0, expenses - income)
}

export function monthlyGrossExpensePrimary(
  dedupedMonthRows: DedupeExpenseRow[],
  primary: string
): number {
  const p = primary.toUpperCase()
  let expenses = 0
  for (const r of dedupedMonthRows) {
    if (r.currency.toUpperCase() !== p) continue
    if (r.type === "expense") expenses += Math.abs(r.amount)
  }
  return expenses
}

export function monthlyGrossIncomePrimary(
  dedupedMonthRows: DedupeExpenseRow[],
  primary: string
): number {
  const p = primary.toUpperCase()
  let income = 0
  for (const r of dedupedMonthRows) {
    if (r.currency.toUpperCase() !== p) continue
    if (r.type === "income" || r.type === "refund") income += Math.abs(r.amount)
  }
  return income
}

async function rateToUsd(cur: string, cache: Map<string, number>): Promise<number> {
  const c = cur.toUpperCase()
  if (c === "USD" || c === "USDC") return 1
  const hit = cache.get(c)
  if (hit != null) return hit
  const { rate } = await fetchFxRateToUsd(c)
  cache.set(c, rate)
  return rate
}

/** Convert any supported fiat/stable-ish code into primary fiat using USD as hub (same MVP as /api/fx). */
export async function convertToPrimaryViaUsd(
  amount: number,
  fromCurrency: string,
  primaryCurrency: string,
  cache: Map<string, number>
): Promise<number> {
  const from = fromCurrency.toUpperCase()
  const pri = primaryCurrency.toUpperCase()
  if (!Number.isFinite(amount) || amount === 0) return 0
  if (from === pri) return amount
  const usd = amount * (await rateToUsd(from, cache))
  const priUsd = await rateToUsd(pri, cache)
  if (!priUsd || !Number.isFinite(priUsd)) return 0
  return usd / priUsd
}

export async function sumVaultAssetsPrimaryEquivalent(
  vaultRows: { balance_amount: string | number; currency: string; kind: string }[],
  primaryCurrency: string
): Promise<number> {
  const cache = new Map<string, number>()
  let sum = 0
  for (const v of vaultRows) {
    if (String(v.kind) !== "asset") continue
    const amt = Number(v.balance_amount)
    if (!Number.isFinite(amt) || amt === 0) continue
    sum += await convertToPrimaryViaUsd(amt, String(v.currency || "USD"), primaryCurrency, cache)
  }
  return sum
}

/**
 * Burn = monthly net outflow in primary currency (expenses − income, floored at 0).
 * Prefers average of up to 3 completed UTC months; falls back to current partial month if none.
 */
export function computeAverageMonthlyBurnPrimary(
  parsed: DedupeExpenseRow[],
  primary: string,
  now: Date
): { burn: number; basis: BurnRunwayBasis; completedMonthsSampled: number } {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()

  const burns: number[] = []
  let completedMonthsWithTx = 0
  for (let i = 1; i <= 3; i++) {
    const { y: yy, m: mm } = shiftUtcMonth(y, m, -i)
    const monthRows = filterRowsMonth(parsed, yy, mm)
    if (monthRows.length > 0) completedMonthsWithTx++
    const deduped = dedupeExpenseRowsForAggregation(monthRows)
    burns.push(monthlyNetBurnPrimary(deduped, primary))
  }

  if (completedMonthsWithTx > 0) {
    const avg = burns.reduce((a, b) => a + b, 0) / burns.length
    return { burn: avg, basis: "avg_completed_3utc", completedMonthsSampled: 3 }
  }

  const mtdRows = filterRowsMonth(parsed, y, m)
  const mtdDeduped = dedupeExpenseRowsForAggregation(mtdRows)
  const mtdBurn = monthlyNetBurnPrimary(mtdDeduped, primary)
  return { burn: mtdBurn, basis: "partial_month", completedMonthsSampled: 0 }
}

/**
 * Same UTC month sampling as net burn: up to 3 completed months averaged (including zeros),
 * else current partial month MTD values.
 */
export function computeAverageMonthlyGrossExpenseAndIncome(
  parsed: DedupeExpenseRow[],
  primary: string,
  now: Date
): {
  avgMonthlyGrossExpensePrimary: number
  avgMonthlyGrossIncomePrimary: number
  basis: BurnRunwayBasis
  completedMonthsSampled: number
} {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const expensesSeries: number[] = []
  const incomeSeries: number[] = []
  let completedMonthsWithTx = 0
  for (let i = 1; i <= 3; i++) {
    const { y: yy, m: mm } = shiftUtcMonth(y, m, -i)
    const monthRows = filterRowsMonth(parsed, yy, mm)
    if (monthRows.length > 0) completedMonthsWithTx++
    const deduped = dedupeExpenseRowsForAggregation(monthRows)
    expensesSeries.push(monthlyGrossExpensePrimary(deduped, primary))
    incomeSeries.push(monthlyGrossIncomePrimary(deduped, primary))
  }

  if (completedMonthsWithTx > 0) {
    const avgE = expensesSeries.reduce((a, b) => a + b, 0) / expensesSeries.length
    const avgI = incomeSeries.reduce((a, b) => a + b, 0) / incomeSeries.length
    return {
      avgMonthlyGrossExpensePrimary: avgE,
      avgMonthlyGrossIncomePrimary: avgI,
      basis: "avg_completed_3utc",
      completedMonthsSampled: 3,
    }
  }

  const mtdRows = filterRowsMonth(parsed, y, m)
  const mtdDeduped = dedupeExpenseRowsForAggregation(mtdRows)
  return {
    avgMonthlyGrossExpensePrimary: monthlyGrossExpensePrimary(mtdDeduped, primary),
    avgMonthlyGrossIncomePrimary: monthlyGrossIncomePrimary(mtdDeduped, primary),
    basis: "partial_month",
    completedMonthsSampled: 0,
  }
}

/** Linear projection of gross expenses for the in-progress UTC month (primary). */
export function projectedGrossExpenseLinearCurrentUtcMonth(
  parsed: DedupeExpenseRow[],
  primary: string,
  now: Date
): number {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const mtdRows = filterRowsMonth(parsed, y, m)
  const mtdDeduped = dedupeExpenseRowsForAggregation(mtdRows)
  const mtd = monthlyGrossExpensePrimary(mtdDeduped, primary)
  const elapsed = now.getUTCDate()
  const monthLen = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  if (elapsed <= 0) return 0
  return (mtd / elapsed) * monthLen
}

export async function buildBurnRunwayPayload(opts: {
  parsed: DedupeExpenseRow[]
  primaryCurrency: string
  now: Date
  vaultRows: { balance_amount: string | number; currency: string; kind: string }[]
  walletUsdc: number | null
  obligationLines?: MonthlyObligationLine[]
}): Promise<BurnRunwayPayload> {
  const { parsed, primaryCurrency, now, vaultRows, walletUsdc } = opts
  const obligationLines = opts.obligationLines ?? []
  const primary = primaryCurrency.toUpperCase()
  const { burn, basis, completedMonthsSampled } = computeAverageMonthlyBurnPrimary(
    parsed,
    primary,
    now
  )
  const gross = computeAverageMonthlyGrossExpenseAndIncome(parsed, primary, now)
  const projectedGrossExpenseThisMonthPrimary = projectedGrossExpenseLinearCurrentUtcMonth(
    parsed,
    primary,
    now
  )

  const cache = new Map<string, number>()
  const vaultAssetsPrimaryEquivalent = await sumVaultAssetsPrimaryEquivalent(vaultRows, primary)

  let walletPrimaryEquivalent: number | null = null
  if (walletUsdc != null && Number.isFinite(walletUsdc) && walletUsdc > 0) {
    walletPrimaryEquivalent = await convertToPrimaryViaUsd(walletUsdc, "USDC", primary, cache)
  }

  const liquidPrimaryEquivalent =
    vaultAssetsPrimaryEquivalent + (walletPrimaryEquivalent ?? 0)

  const runwayResourcePrimary =
    liquidPrimaryEquivalent + gross.avgMonthlyGrossIncomePrimary

  const avgGrossExp = gross.avgMonthlyGrossExpensePrimary
  let runwayMonths: number | null = null
  if (avgGrossExp <= 0) {
    runwayMonths = null
  } else {
    runwayMonths = runwayResourcePrimary / avgGrossExp
  }

  const plannedMonthlyBurnPrimary = sumMonthlyObligations(obligationLines)
  const burnVsPlanDelta =
    obligationLines.length > 0 ? burn - plannedMonthlyBurnPrimary : null

  let runwayMonthsAtPlannedBurn: number | null = null
  if (plannedMonthlyBurnPrimary > 0) {
    runwayMonthsAtPlannedBurn = runwayResourcePrimary / plannedMonthlyBurnPrimary
  }

  return {
    burnRateMonthlyPrimary: burn,
    basis,
    completedMonthsSampled,
    runwayMonths,
    runwayResourcePrimary,
    liquidPrimaryEquivalent,
    walletUsdc,
    walletPrimaryEquivalent,
    vaultAssetsPrimaryEquivalent,
    avgMonthlyGrossExpensePrimary: gross.avgMonthlyGrossExpensePrimary,
    avgMonthlyGrossIncomePrimary: gross.avgMonthlyGrossIncomePrimary,
    projectedGrossExpenseThisMonthPrimary,
    plannedMonthlyBurnPrimary,
    obligationLines,
    burnVsPlanDelta,
    runwayMonthsAtPlannedBurn,
  }
}
