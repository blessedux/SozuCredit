import { NextResponse } from "next/server"
import { aggregateExpenseInstitutions } from "@/lib/ledger/expense-institution"
import {
  countExpenseDuplicatesRemoved,
  dedupeExpenseRowsForAggregation,
  type DedupeExpenseRow,
} from "@/lib/ledger/expense-dedupe"
import { buildExpenseCategoryBreakdown, buildIncomeCategoryBreakdown } from "@/lib/ledger/summary-breakdown"
import { getApiUserClient } from "@/lib/ledger/supabase-admin"
import { isMissingLedgerTable } from "@/lib/ledger/supabase-errors"
import { buildBurnRunwayPayload, ledgerBurnHistoryRangeLowMs } from "@/lib/ledger/burn-runway"
import { parseMonthlyObligationsPlan } from "@/lib/ledger/monthly-obligations-plan"
import { ledgerWindowUtcBounds } from "@/lib/ledger/ledger-chart-window"
import { transactionInstantMs } from "@/lib/ledger/transaction-date"
import { getWalletDisplayUsdc } from "@/lib/ledger/wallet-display-usdc"

export const dynamic = "force-dynamic"

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" } as const

function filterRowsUtcMonth<T extends { date: string }>(rows: T[], startMs: number, endMs: number): T[] {
  return rows.filter((r) => {
    const t = transactionInstantMs(r.date)
    return t != null && t >= startMs && t <= endMs
  })
}

function filterRowsRollingWeek<T extends { date: string }>(rows: T[], now: Date): T[] {
  const endMs = now.getTime()
  const startMs = endMs - 7 * 86_400_000
  return rows.filter((r) => {
    const t = transactionInstantMs(r.date)
    return t != null && t >= startMs && t <= endMs
  })
}

function filterRowsUtcCalendarDay<T extends { date: string }>(rows: T[], now: Date): T[] {
  const startMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  const endMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
  return rows.filter((r) => {
    const t = transactionInstantMs(r.date)
    return t != null && t >= startMs && t <= endMs
  })
}

function sumByCurrency(rows: { amount: number; currency: string; type: string }[]) {
  const totals = new Map<string, { income: number; expenses: number }>()
  for (const row of rows) {
    const cur = row.currency.toUpperCase()
    const t = totals.get(cur) ?? { income: 0, expenses: 0 }
    const amt = Math.abs(row.amount)
    if (row.type === "income" || row.type === "refund") {
      t.income += amt
    } else if (row.type === "expense") {
      t.expenses += amt
    }
    totals.set(cur, t)
  }
  return totals
}

type ParsedRow = DedupeExpenseRow

function sumPrimaryAbsExpenses(rows: ParsedRow[], primary: string): number {
  const p = primary.toUpperCase()
  let s = 0
  for (const r of rows) {
    if (r.type !== "expense") continue
    if (r.currency.toUpperCase() !== p) continue
    s += Math.abs(r.amount)
  }
  return s
}

function sumPrimaryAbsIncome(rows: ParsedRow[], primary: string): number {
  const p = primary.toUpperCase()
  let s = 0
  for (const r of rows) {
    if (r.type !== "income" && r.type !== "refund") continue
    if (r.currency.toUpperCase() !== p) continue
    s += Math.abs(r.amount)
  }
  return s
}

function parseLedgerRow(row: {
  id: string
  date: string
  amount: string | number
  currency: string
  type: string
  confidence: number
  category: string
  merchant: string | null
  source_email_id: string | null
  email_sources: { from_addr: string | null } | { from_addr: string | null }[] | null
}): ParsedRow {
  const es = row.email_sources
  const fromAddr = Array.isArray(es) ? (es[0]?.from_addr ?? null) : (es?.from_addr ?? null)
  return {
    id: row.id,
    date: row.date,
    amount: Number(row.amount),
    currency: String(row.currency),
    type: String(row.type),
    category: String(row.category ?? "unknown"),
    confidence: Number(row.confidence ?? 1),
    merchant: row.merchant,
    source_email_id: row.source_email_id,
    from_addr: fromAddr,
  }
}

function toInstitutionRows(rows: ParsedRow[]) {
  return rows.map((r) => ({
    date: r.date,
    amount: r.amount,
    currency: r.currency,
    type: r.type,
    merchant: r.merchant,
    source_email_id: r.source_email_id,
    from_addr: r.from_addr,
  }))
}

export async function GET(request: Request) {
  const ctx = await getApiUserClient(request)
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS })
  }

  const { data: settings } = await ctx.db
    .from("ledger_settings")
    .select("preferred_fiat_currency, monthly_obligations_plan")
    .eq("user_id", ctx.userId)
    .maybeSingle()

  let preferred: string | null = settings?.preferred_fiat_currency ?? null
  const obligationLinesFromSettings = parseMonthlyObligationsPlan(settings?.monthly_obligations_plan)

  const now = new Date()
  const monthB = ledgerWindowUtcBounds("month", now)
  const weekB = ledgerWindowUtcBounds("week", now)
  const dayB = ledgerWindowUtcBounds("day", now)
  const monthStartIso = monthB.startIso
  const monthEndIso = monthB.endIso
  const monthStartMs = monthB.startMs
  const monthEndMs = monthB.endMs
  const weekStartIso = weekB.startIso
  const nowIso = now.toISOString()
  const dayStartIso = dayB.startIso
  const dayEndIso = dayB.endIso

  const burnHistoryLowMs = ledgerBurnHistoryRangeLowMs(now)
  const rangeLowMs = Math.min(monthB.startMs, weekB.startMs, dayB.startMs, burnHistoryLowMs)
  const rangeHighMs = Math.max(monthB.endMs, weekB.endMs, now.getTime())
  const rangeLowIso = new Date(rangeLowMs).toISOString()
  const rangeHighIso = new Date(rangeHighMs).toISOString()

  const [
    { data: rawRows, error },
    vaultOutcome,
    walletUsdcTotal,
  ] = await Promise.all([
    ctx.db
      .from("ledger_transactions")
      .select(
        `id,
       date, amount, currency, type, confidence, category, merchant, source_email_id,
       email_sources ( from_addr )`
      )
      .eq("user_id", ctx.userId)
      .is("dismissed_at", null)
      .gte("date", rangeLowIso)
      .lte("date", rangeHighIso),
    ctx.db.from("ledger_vaults").select("balance_amount,currency,kind").eq("user_id", ctx.userId),
    getWalletDisplayUsdc({ userId: ctx.userId }),
  ])

  if (error) {
    if (isMissingLedgerTable(error)) {
      return NextResponse.json(
        {
          error: "Ledger tables not installed",
          hint: "Apply supabase/migrations/20260504120000_email_ledger.sql",
        },
        { status: 503, headers: NO_STORE_HEADERS }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE_HEADERS })
  }

  const parsed = (rawRows ?? []).map((r) =>
    parseLedgerRow(
      r as {
        id: string
        date: string
        amount: string | number
        currency: string
        type: string
        confidence: number
        category: string
        merchant: string | null
        source_email_id: string | null
        email_sources: { from_addr: string | null } | { from_addr: string | null }[] | null
      }
    )
  )

  const monthRows = filterRowsUtcMonth(parsed, monthStartMs, monthEndMs)
  const monthDeduped = dedupeExpenseRowsForAggregation(monthRows)
  const expenseDuplicatesCollapsedMonth = countExpenseDuplicatesRemoved(monthRows, monthDeduped)

  const list = monthDeduped.map((r) => ({
    amount: r.amount,
    currency: r.currency,
    type: r.type,
    category: r.category,
    confidence: r.confidence,
  }))

  if (!preferred) {
    const { data: allCur } = await ctx.db
      .from("ledger_transactions")
      .select("currency")
      .eq("user_id", ctx.userId)
      .is("dismissed_at", null)

    const curCounts = new Map<string, number>()
    for (const r of allCur ?? []) {
      const c = String(r.currency).toUpperCase()
      curCounts.set(c, (curCounts.get(c) ?? 0) + 1)
    }
    const totalN = [...curCounts.values()].reduce((a, b) => a + b, 0)
    if (totalN > 0) {
      let best: { c: string; n: number } | null = null
      for (const [c, n] of curCounts) {
        if (!best || n > best.n) best = { c, n }
      }
      if (best && best.n / totalN >= 0.7) {
        preferred = best.c
        await ctx.db.from("ledger_settings").upsert(
          {
            user_id: ctx.userId,
            preferred_fiat_currency: preferred,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )
      }
    }
  }

  const primary = (preferred ?? "CLP").toUpperCase()
  const byCur = sumByCurrency(list)
  const slice = byCur.get(primary) ?? { income: 0, expenses: 0 }
  const netCashflow = slice.income - slice.expenses

  const lowConfidence = monthDeduped.filter((r) => r.confidence < 0.85).length

  const expenseCategoryBreakdown = buildExpenseCategoryBreakdown(monthDeduped, primary)
  const incomeCategoryBreakdown = buildIncomeCategoryBreakdown(monthDeduped, primary)

  const weekRows = filterRowsRollingWeek(parsed, now)
  const weekDeduped = dedupeExpenseRowsForAggregation(weekRows)

  const dayRows = filterRowsUtcCalendarDay(parsed, now)
  const dayDeduped = dedupeExpenseRowsForAggregation(dayRows)

  const expenseCategoryWeek = buildExpenseCategoryBreakdown(weekDeduped, primary)
  const expenseCategoryDay = buildExpenseCategoryBreakdown(dayDeduped, primary)

  const incomeCategoryWeek = buildIncomeCategoryBreakdown(weekDeduped, primary)
  const incomeCategoryDay = buildIncomeCategoryBreakdown(dayDeduped, primary)

  const expenseInstitutionMonth = aggregateExpenseInstitutions(
    toInstitutionRows(monthDeduped),
    () => true,
    primary
  )
  const expenseInstitutionWeek = aggregateExpenseInstitutions(
    toInstitutionRows(weekDeduped),
    () => true,
    primary
  )
  const expenseInstitutionDay = aggregateExpenseInstitutions(
    toInstitutionRows(dayDeduped),
    () => true,
    primary
  )

  const expensesRollingWeek = sumPrimaryAbsExpenses(weekDeduped, primary)
  const expensesCalendarDayUtc = sumPrimaryAbsExpenses(dayDeduped, primary)
  const incomeRollingWeek = sumPrimaryAbsIncome(weekDeduped, primary)
  const incomeCalendarDayUtc = sumPrimaryAbsIncome(dayDeduped, primary)

  const monthElapsedDaysUtc = now.getUTCDate()
  const monthLengthDaysUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate()
  const projectedMonthExpensesLinear =
    monthElapsedDaysUtc > 0 ? (slice.expenses / monthElapsedDaysUtc) * monthLengthDaysUtc : 0

  const vaultRowsRaw = vaultOutcome.error ? [] : (vaultOutcome.data ?? [])
  if (vaultOutcome.error) {
    console.warn("[ledger/summary] ledger_vaults:", vaultOutcome.error.message)
  }

  let burnRunway: Awaited<ReturnType<typeof buildBurnRunwayPayload>> | null = null
  try {
    burnRunway = await buildBurnRunwayPayload({
      parsed,
      primaryCurrency: primary,
      now,
      vaultRows: vaultRowsRaw as { balance_amount: string | number; currency: string; kind: string }[],
      walletUsdc: walletUsdcTotal,
      obligationLines: obligationLinesFromSettings,
    })
  } catch (e) {
    console.warn("[ledger/summary] burnRunway:", e)
  }

  return NextResponse.json(
    {
      domain: "email_ledger" as const,
      primaryCurrency: primary,
      month: { start: monthStartIso, end: monthEndIso },
      windows: {
        week: { start: weekStartIso, end: nowIso },
        dayUtc: { start: dayStartIso, end: dayEndIso },
      },
      burnMetrics: {
        expensesCalendarDayUtc,
        expensesRollingWeek,
        expensesMonthToDate: slice.expenses,
        incomeRollingWeek,
        incomeCalendarDayUtc,
        incomeMonthToDate: slice.income,
        netMonthToDate: netCashflow,
        monthElapsedDaysUtc,
        monthLengthDaysUtc,
        projectedMonthExpensesLinear,
      },
      incomeThisMonth: slice.income,
      expensesThisMonth: slice.expenses,
      netCashflow,
      expenseDuplicatesCollapsedMonth,
      perCurrency: Object.fromEntries(byCur),
      needsReviewCount: lowConfidence,
      allCurrencies: [...new Set(list.map((r) => r.currency.toUpperCase()))],
      expenseCategoryBreakdown,
      expenseCategoryWeek,
      expenseCategoryDay,
      incomeCategoryBreakdown,
      incomeCategoryWeek,
      incomeCategoryDay,
      expenseInstitutionMonth,
      expenseInstitutionWeek,
      expenseInstitutionDay,
      obligationPlanLines: obligationLinesFromSettings,
      burnRunway,
    },
    { headers: NO_STORE_HEADERS }
  )
}
