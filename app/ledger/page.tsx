"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Flame, Hourglass, Target, Waves } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LedgerHomeSkeleton } from "@/components/ledger/ledger-home-skeleton"
import { LedgerTransactionsTableSkeleton } from "@/components/ledger/ledger-transactions-table-skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  LedgerTransactionEditDialog,
  type LedgerTransactionEditRow,
} from "@/components/ledger/ledger-transaction-edit-dialog"
import { ExpenseBreakdownDonut, type DonutDatum } from "@/components/ledger/expense-breakdown-donut"
import { MonthlyObligationsPlanEditor } from "@/components/ledger/monthly-obligations-plan-editor"
import type { InstitutionKind } from "@/lib/ledger/expense-institution"
import { formatFiatAmount } from "@/lib/ledger/format-fiat"
import { ledgerUserHeaders } from "@/lib/ledger/client-headers"
import type { LedgerChartWindow } from "@/lib/ledger/ledger-chart-window"
import { ledgerChartWindowLabel } from "@/lib/ledger/ledger-chart-window"
import { walletBalancesFetchInit, walletBalancesUrl } from "@/lib/ledger/wallet-balances-url"
import { formatLedgerTxTableMoment } from "@/lib/ledger/transaction-date"
import { parseMonthlyObligationsPlan, type MonthlyObligationLine } from "@/lib/ledger/monthly-obligations-plan"
import { DEFAULT_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "@/lib/ledger/types"
import { useAppHaptics } from "@/hooks/use-app-haptics"

type CategorySlice = {
  category: string
  amount: number
  count: number
  pct: number
}

type InstitutionSlice = {
  tag: string
  label: string
  kind: InstitutionKind
  amount: number
  count: number
  pct: number
}

type BurnRunway = {
  burnRateMonthlyPrimary: number
  basis: "avg_completed_3utc" | "partial_month"
  completedMonthsSampled: number
  runwayMonths: number | null
  runwayResourcePrimary: number
  liquidPrimaryEquivalent: number
  walletUsdc: number | null
  walletPrimaryEquivalent: number | null
  vaultAssetsPrimaryEquivalent: number
  avgMonthlyGrossExpensePrimary: number
  avgMonthlyGrossIncomePrimary: number
  projectedGrossExpenseThisMonthPrimary: number
  plannedMonthlyBurnPrimary: number
  obligationLines: MonthlyObligationLine[]
  burnVsPlanDelta: number | null
  runwayMonthsAtPlannedBurn: number | null
}

type Summary = {
  primaryCurrency: string
  incomeThisMonth: number
  expensesThisMonth: number
  netCashflow: number
  needsReviewCount: number
  expenseDuplicatesCollapsedMonth: number
  expenseCategoryBreakdown: CategorySlice[]
  expenseCategoryWeek: CategorySlice[]
  expenseCategoryDay: CategorySlice[]
  incomeCategoryBreakdown: CategorySlice[]
  expenseInstitutionMonth: InstitutionSlice[]
  expenseInstitutionWeek: InstitutionSlice[]
  expenseInstitutionDay: InstitutionSlice[]
  obligationPlanLines: MonthlyObligationLine[]
  burnRunway: BurnRunway | null
  error?: string
  hint?: string
}

function parseBurnRunway(raw: unknown): BurnRunway | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const burnRateMonthlyPrimary = Number(o.burnRateMonthlyPrimary)
  const liquidPrimaryEquivalent = Number(o.liquidPrimaryEquivalent)
  const vaultAssetsPrimaryEquivalent = Number(o.vaultAssetsPrimaryEquivalent)
  const basis = o.basis === "partial_month" ? "partial_month" : "avg_completed_3utc"
  const completedMonthsSampled = Number(o.completedMonthsSampled)
  const runwayRaw = o.runwayMonths
  const runwayMonths =
    runwayRaw === null || runwayRaw === undefined
      ? null
      : typeof runwayRaw === "number" && Number.isFinite(runwayRaw)
        ? runwayRaw
        : null
  const walletUsdc =
    o.walletUsdc === null || o.walletUsdc === undefined
      ? null
      : typeof o.walletUsdc === "number" && Number.isFinite(o.walletUsdc)
        ? o.walletUsdc
        : null
  const walletPrimaryEquivalent =
    o.walletPrimaryEquivalent === null || o.walletPrimaryEquivalent === undefined
      ? null
      : typeof o.walletPrimaryEquivalent === "number" && Number.isFinite(o.walletPrimaryEquivalent)
        ? o.walletPrimaryEquivalent
        : null

  if (!Number.isFinite(burnRateMonthlyPrimary) || !Number.isFinite(liquidPrimaryEquivalent)) return null
  if (!Number.isFinite(vaultAssetsPrimaryEquivalent)) return null

  const avgMonthlyGrossExpensePrimary = Number(o.avgMonthlyGrossExpensePrimary)
  const avgMonthlyGrossIncomePrimary = Number(o.avgMonthlyGrossIncomePrimary)
  const projectedGrossExpenseThisMonthPrimary = Number(o.projectedGrossExpenseThisMonthPrimary)
  const runwayResourcePrimary = Number(o.runwayResourcePrimary)

  const plannedMonthlyBurnPrimary = Number(o.plannedMonthlyBurnPrimary)
  const obligationLines = parseMonthlyObligationsPlan(o.obligationLines)
  const deltaRaw = o.burnVsPlanDelta
  const burnVsPlanDelta =
    deltaRaw === null || deltaRaw === undefined
      ? null
      : typeof deltaRaw === "number" && Number.isFinite(deltaRaw)
        ? deltaRaw
        : null
  const rpb = o.runwayMonthsAtPlannedBurn
  const runwayMonthsAtPlannedBurn =
    rpb === null || rpb === undefined
      ? null
      : typeof rpb === "number" && Number.isFinite(rpb)
        ? rpb
        : null

  const grossExp = Number.isFinite(avgMonthlyGrossExpensePrimary) ? avgMonthlyGrossExpensePrimary : burnRateMonthlyPrimary
  const grossInc = Number.isFinite(avgMonthlyGrossIncomePrimary) ? avgMonthlyGrossIncomePrimary : 0
  const projectedGross = Number.isFinite(projectedGrossExpenseThisMonthPrimary)
    ? projectedGrossExpenseThisMonthPrimary
    : 0
  const runwayRes = Number.isFinite(runwayResourcePrimary) ? runwayResourcePrimary : liquidPrimaryEquivalent

  return {
    burnRateMonthlyPrimary,
    basis,
    completedMonthsSampled: Number.isFinite(completedMonthsSampled) ? completedMonthsSampled : 0,
    runwayMonths,
    runwayResourcePrimary: runwayRes,
    liquidPrimaryEquivalent,
    walletUsdc,
    walletPrimaryEquivalent,
    vaultAssetsPrimaryEquivalent,
    avgMonthlyGrossExpensePrimary: grossExp,
    avgMonthlyGrossIncomePrimary: grossInc,
    projectedGrossExpenseThisMonthPrimary: projectedGross,
    plannedMonthlyBurnPrimary: Number.isFinite(plannedMonthlyBurnPrimary) ? plannedMonthlyBurnPrimary : 0,
    obligationLines,
    burnVsPlanDelta,
    runwayMonthsAtPlannedBurn,
  }
}

type PreviewTx = {
  id: string
  date: string
  merchant: string | null
  merchant_legal?: string | null
  note?: string | null
  card_last_four?: string | null
  cardholder_name?: string | null
  amount: string | number
  currency: string
  type: string
  category: string
  source: string
  confidence?: number
  raw_text?: string | null
  source_email_id?: string | null
  source_vault_id?: string | null
  source_vault_name?: string | null
  institution_label?: string
  institution_kind?: InstitutionKind
}

function isCurrentUtcMonth(isoLike: string): boolean {
  const d = new Date(isoLike)
  if (Number.isNaN(d.getTime())) return false
  const now = new Date()
  return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth()
}

function summaryContributionForTx(tx: PreviewTx, primaryCurrency: string): { income: number; expense: number } {
  if (String(tx.currency ?? "").toUpperCase() !== String(primaryCurrency ?? "").toUpperCase()) {
    return { income: 0, expense: 0 }
  }
  if (!isCurrentUtcMonth(tx.date)) return { income: 0, expense: 0 }

  const amountAbs = Math.abs(Number(tx.amount))
  if (!Number.isFinite(amountAbs)) return { income: 0, expense: 0 }

  if (tx.type === "income" || tx.type === "refund") return { income: amountAbs, expense: 0 }
  if (tx.type === "expense") return { income: 0, expense: amountAbs }
  return { income: 0, expense: 0 }
}

function patchSummaryWithEditedTx(summary: Summary, before: PreviewTx, after: PreviewTx): Summary {
  const prev = summaryContributionForTx(before, summary.primaryCurrency)
  const next = summaryContributionForTx(after, summary.primaryCurrency)
  const incomeThisMonth = Math.max(0, summary.incomeThisMonth - prev.income + next.income)
  const expensesThisMonth = Math.max(0, summary.expensesThisMonth - prev.expense + next.expense)
  return {
    ...summary,
    incomeThisMonth,
    expensesThisMonth,
    netCashflow: incomeThisMonth - expensesThisMonth,
  }
}

function previewTxToEditRow(p: PreviewTx): LedgerTransactionEditRow {
  const c = p.confidence
  return {
    id: p.id,
    date: p.date,
    merchant: p.merchant,
    merchant_legal: p.merchant_legal ?? null,
    note: p.note ?? null,
    card_last_four: p.card_last_four ?? null,
    cardholder_name: p.cardholder_name ?? null,
    amount: p.amount,
    currency: p.currency,
    type: p.type,
    category: p.category,
    source: p.source,
    confidence: typeof c === "number" && Number.isFinite(c) ? c : 0,
    raw_text: p.raw_text,
    source_email_id: p.source_email_id,
    source_vault_id: p.source_vault_id ?? null,
    source_vault_name: p.source_vault_name ?? null,
    institution_label: p.institution_label,
    institution_kind: p.institution_kind != null ? String(p.institution_kind) : undefined,
  }
}

const ledgerFetchInit = {
  headers: ledgerUserHeaders(),
  cache: "no-store" as RequestCache,
}

export default function LedgerHomePage() {
  const pathname = usePathname()
  const { play: ledgerHaptic } = useAppHaptics()

  const [data, setData] = useState<Summary | null>(null)
  const [walletUsdc, setWalletUsdc] = useState<number | null>(null)
  const [walletUsdcDetail, setWalletUsdcDetail] = useState<{
    trustline: number
    strategy: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewTx, setPreviewTx] = useState<PreviewTx[]>([])
  /** When set, \"Últimos movimientos\" lists tx for this category (from donut). */
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  /** Matches \"Este mes\" / \"7 días\" / \"Hoy UTC\" donut tabs — preview table uses same UTC window + optional category. */
  const [chartWindow, setChartWindow] = useState<LedgerChartWindow>("month")
  const [detailTx, setDetailTx] = useState<PreviewTx | null>(null)
  const [calculationModal, setCalculationModal] = useState<"burn" | "runway" | null>(null)
  const [ledgerCategories, setLedgerCategories] = useState<string[]>(() => [...DEFAULT_CATEGORIES])
  const [ledgerIncomeCategories, setLedgerIncomeCategories] = useState<string[]>(() => [
    ...DEFAULT_INCOME_CATEGORIES,
  ])

  const previewHydrated = useRef(false)

  const refreshSummary = useCallback(async () => {
    const [res, balRes] = await Promise.all([
      fetch("/api/ledger/summary", ledgerFetchInit),
      fetch(walletBalancesUrl(), walletBalancesFetchInit()),
    ])
    const json = await res.json()

    if (balRes.ok) {
      const b = await balRes.json()
      const total =
        typeof b.displayTotalUsdc === "number" && Number.isFinite(b.displayTotalUsdc)
          ? (b.displayTotalUsdc as number)
          : null
      setWalletUsdc(total)
      const s = b.usdcSummary as { trustline?: number; strategy?: number } | null
      if (s && (typeof s.trustline === "number" || typeof s.strategy === "number")) {
        setWalletUsdcDetail({
          trustline: Number(s.trustline) || 0,
          strategy: Number(s.strategy) || 0,
        })
      } else setWalletUsdcDetail(null)
    } else {
      setWalletUsdc(null)
      setWalletUsdcDetail(null)
    }

    if (!res.ok) {
      setData({
        primaryCurrency: "CLP",
        incomeThisMonth: 0,
        expensesThisMonth: 0,
        netCashflow: 0,
        needsReviewCount: 0,
        expenseDuplicatesCollapsedMonth: 0,
        expenseCategoryBreakdown: [],
        expenseCategoryWeek: [],
        expenseCategoryDay: [],
        incomeCategoryBreakdown: [],
        expenseInstitutionMonth: [],
        expenseInstitutionWeek: [],
        expenseInstitutionDay: [],
        obligationPlanLines: [],
        burnRunway: null,
        error: json.error ?? "Error",
        hint: json.hint,
      })
      return
    }
    setData({
      primaryCurrency: json.primaryCurrency,
      incomeThisMonth: json.incomeThisMonth,
      expensesThisMonth: json.expensesThisMonth,
      netCashflow: json.netCashflow,
      needsReviewCount: json.needsReviewCount,
      expenseDuplicatesCollapsedMonth: Number(json.expenseDuplicatesCollapsedMonth) || 0,
      expenseCategoryBreakdown: Array.isArray(json.expenseCategoryBreakdown)
        ? json.expenseCategoryBreakdown
        : [],
      expenseCategoryWeek: Array.isArray(json.expenseCategoryWeek) ? json.expenseCategoryWeek : [],
      expenseCategoryDay: Array.isArray(json.expenseCategoryDay) ? json.expenseCategoryDay : [],
      incomeCategoryBreakdown: Array.isArray(json.incomeCategoryBreakdown)
        ? json.incomeCategoryBreakdown
        : [],
      expenseInstitutionMonth: Array.isArray(json.expenseInstitutionMonth)
        ? json.expenseInstitutionMonth
        : [],
      expenseInstitutionWeek: Array.isArray(json.expenseInstitutionWeek)
        ? json.expenseInstitutionWeek
        : [],
      expenseInstitutionDay: Array.isArray(json.expenseInstitutionDay) ? json.expenseInstitutionDay : [],
      obligationPlanLines: parseMonthlyObligationsPlan(json.obligationPlanLines),
      burnRunway: parseBurnRunway(json.burnRunway),
    })
  }, [])

  const refreshPreviewTransactions = useCallback(async (category: string | null, window: LedgerChartWindow) => {
    setPreviewLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("limit", category ? "50" : "100")
      params.set("window", window)
      if (category) params.set("category", category)
      const txRes = await fetch(`/api/ledger/transactions?${params}`, ledgerFetchInit)
      if (txRes.ok) {
        const tj = await txRes.json()
        setPreviewTx(Array.isArray(tj.transactions) ? tj.transactions : [])
        if (Array.isArray(tj.categories)) setLedgerCategories(tj.categories)
        if (Array.isArray(tj.incomeCategories)) setLedgerIncomeCategories(tj.incomeCategories)
      } else {
        setPreviewTx([])
      }
    } catch {
      setPreviewTx([])
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  const refreshAll = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false
      if (silent) setRefreshing(true)
      try {
        await Promise.all([refreshSummary(), refreshPreviewTransactions(categoryFilter, chartWindow)])
      } catch {
        setPreviewTx([])
        setWalletUsdc(null)
        setWalletUsdcDetail(null)
        setData({
          primaryCurrency: "CLP",
          incomeThisMonth: 0,
          expensesThisMonth: 0,
          netCashflow: 0,
          needsReviewCount: 0,
          expenseDuplicatesCollapsedMonth: 0,
          expenseCategoryBreakdown: [],
          expenseCategoryWeek: [],
          expenseCategoryDay: [],
          incomeCategoryBreakdown: [],
          expenseInstitutionMonth: [],
          expenseInstitutionWeek: [],
          expenseInstitutionDay: [],
          obligationPlanLines: [],
          burnRunway: null,
          error: "Red no disponible",
        })
      } finally {
        if (silent) setRefreshing(false)
      }
    },
    [categoryFilter, chartWindow, refreshPreviewTransactions, refreshSummary]
  )

  const mergePreviewPatch = useCallback((id: string, patch: Partial<PreviewTx>) => {
    setPreviewTx((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setDetailTx((d) => (d && d.id === id ? { ...d, ...patch } : d))
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await Promise.all([refreshSummary(), refreshPreviewTransactions(null, "month")])
      } catch {
        if (!cancelled) {
          setPreviewTx([])
          setWalletUsdc(null)
          setWalletUsdcDetail(null)
          setData({
            primaryCurrency: "CLP",
            incomeThisMonth: 0,
            expensesThisMonth: 0,
            netCashflow: 0,
            needsReviewCount: 0,
            expenseDuplicatesCollapsedMonth: 0,
            expenseCategoryBreakdown: [],
            expenseCategoryWeek: [],
            expenseCategoryDay: [],
            incomeCategoryBreakdown: [],
            expenseInstitutionMonth: [],
            expenseInstitutionWeek: [],
            expenseInstitutionDay: [],
            obligationPlanLines: [],
            burnRunway: null,
            error: "Red no disponible",
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshPreviewTransactions, refreshSummary])

  useEffect(() => {
    if (loading) return
    if (!previewHydrated.current) {
      previewHydrated.current = true
      return
    }
    void refreshPreviewTransactions(categoryFilter, chartWindow)
  }, [categoryFilter, chartWindow, loading, refreshPreviewTransactions])

  const handleCategoryDonutClick = useCallback((datum: DonutDatum) => {
    const key = datum.filterKey?.trim().toLowerCase()
    if (!key) return
    setCategoryFilter((prev) => (prev === key ? null : key))
  }, [])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && pathname === "/ledger") {
        void refreshAll({ silent: true })
      }
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [pathname, refreshAll])

  const fullTableHref = useMemo(() => {
    const p = new URLSearchParams()
    if (categoryFilter) p.set("category", categoryFilter)
    if (chartWindow !== "month") p.set("window", chartWindow)
    const q = p.toString()
    return q ? `/ledger/transactions?${q}` : "/ledger/transactions"
  }, [categoryFilter, chartWindow])

  if (loading || !data) {
    return <LedgerHomeSkeleton />
  }

  if (data.error) {
    return (
      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm">
        <p className="font-semibold text-yellow-200">{data.error}</p>
        {data.hint && <p className="mt-2 text-white/70">{data.hint}</p>}
      </div>
    )
  }

  const cur = data.primaryCurrency
  const burnRunway = data.burnRunway
  const impliedNetBurnFromGross = burnRunway
    ? Math.max(0, burnRunway.avgMonthlyGrossExpensePrimary - burnRunway.avgMonthlyGrossIncomePrimary)
    : 0

  return (
    <div className="space-y-6 lg:space-y-8">
      {refreshing ? (
        <p className="text-[11px] text-white/40 text-center -mb-2">Actualizando datos…</p>
      ) : null}

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        {/* Left column (desktop): wallet, burn, runway, este mes */}
        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-xl border border-white/15 bg-white/[0.03] p-5 text-left space-y-2 lg:flex lg:flex-col lg:justify-center">
            <p className="text-xs uppercase tracking-widest text-white/40">Saldo wallet (USDC)</p>
            <p className="text-2xl font-bold tabular-nums lg:text-3xl">
              {walletUsdc !== null ? `${walletUsdc.toFixed(2)} USDC` : "—"}
            </p>
            {walletUsdcDetail && (walletUsdcDetail.trustline > 0 || walletUsdcDetail.strategy > 0) && (
              <p className="text-xs text-white/50">
                Cuenta Stellar: {walletUsdcDetail.trustline.toFixed(2)} · DeFindex: {walletUsdcDetail.strategy.toFixed(2)}
              </p>
            )}
            <p className="text-xs text-white/45 lg:mt-auto lg:pt-2">
              Mismo criterio que la pantalla /wallet (no mezclado con el libro).
            </p>
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-4">
            <section
              role="button"
              tabIndex={burnRunway ? 0 : -1}
              className={`rounded-xl border border-orange-500/20 bg-orange-500/[0.04] p-5 text-left lg:flex lg:flex-col transition-colors ${
                burnRunway
                  ? "cursor-pointer hover:bg-orange-500/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/40"
                  : ""
              }`}
              onClick={() => {
                if (!burnRunway) return
                setCalculationModal("burn")
              }}
              onKeyDown={(e) => {
                if (!burnRunway) return
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setCalculationModal("burn")
                }
              }}
            >
              <div className="flex gap-3">
                <Flame className="mt-0.5 h-5 w-5 shrink-0 text-orange-400/90" aria-hidden />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-xs uppercase tracking-widest text-white/40">Ritmo de gasto (bruto)</p>
                  {data.burnRunway ? (
                    <>
                      <p className="text-[10px] uppercase tracking-wider text-orange-100/80">Tocar para ver cálculo</p>
                      <p className="text-2xl font-bold tabular-nums text-orange-100 lg:text-3xl">
                        {formatFiatAmount(data.burnRunway.avgMonthlyGrossExpensePrimary, cur)}
                        <span className="block text-[11px] font-normal text-white/40 mt-1.5 normal-case tracking-normal">
                          promedio mensual
                        </span>
                      </p>
                      <p className="text-[11px] text-white/45 leading-relaxed">
                        {grossExpenseBasisCaption(data.burnRunway)}
                      </p>
                      <div className="rounded-lg border border-white/10 bg-black/60 px-3 py-2 space-y-1">
                        <p className="text-[10px] uppercase tracking-wider text-white/38">Este mes (proyección)</p>
                        <p
                          className={`text-base font-semibold tabular-nums ${
                            projectedGrossExpenseVsAverageTone(data.burnRunway) === "ok"
                              ? "text-emerald-300/95"
                              : projectedGrossExpenseVsAverageTone(data.burnRunway) === "high"
                                ? "text-amber-200/95"
                                : "text-white/55"
                          }`}
                        >
                          {formatFiatAmount(data.burnRunway.projectedGrossExpenseThisMonthPrimary, cur)}
                        </p>
                        <p className="text-[10px] text-white/42 leading-snug">
                          {projectedGrossExpenseVsAverageHint(data.burnRunway)}
                        </p>
                      </div>
                      <p className="text-[10px] text-white/38 leading-snug">
                        Quema neta (promedio, para plan):{" "}
                        <span className="tabular-nums text-white/55">
                          {formatFiatAmount(data.burnRunway.burnRateMonthlyPrimary, cur)}
                        </span>
                        {" · "}
                        {burnRunwayBasisCaption(data.burnRunway)}
                      </p>
                      {data.burnRunway.plannedMonthlyBurnPrimary > 0 ? (
                        <div className="mt-3 space-y-1.5 border-t border-orange-500/25 pt-3 text-[12px]">
                          <div className="flex justify-between gap-2 text-white/55">
                            <span>Plan mensual (suma)</span>
                            <span className="tabular-nums text-white/80">
                              {formatFiatAmount(data.burnRunway.plannedMonthlyBurnPrimary, cur)}
                            </span>
                          </div>
                          {data.burnRunway.burnVsPlanDelta != null ? (
                            <div className="flex justify-between gap-2 font-medium pt-0.5">
                              <span className="text-white/65">Vs plan (neto)</span>
                              <span
                                className={
                                  data.burnRunway.burnVsPlanDelta > 0
                                    ? "tabular-nums text-rose-300"
                                    : data.burnRunway.burnVsPlanDelta < 0
                                      ? "tabular-nums text-emerald-300"
                                      : "tabular-nums text-white/70"
                                }
                              >
                                {data.burnRunway.burnVsPlanDelta > 0 ? "+" : ""}
                                {formatFiatAmount(data.burnRunway.burnVsPlanDelta, cur)}
                                {data.burnRunway.burnVsPlanDelta > 0
                                  ? " · por encima"
                                  : data.burnRunway.burnVsPlanDelta < 0
                                    ? " · por debajo"
                                    : ""}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-medium text-white/45">—</p>
                      <p className="text-[11px] text-white/38 lg:mt-auto lg:pt-1">
                        No se pudo calcular (tipos de cambio o servicios externos).
                      </p>
                    </>
                  )}
                </div>
              </div>
            </section>

            <section
              role="button"
              tabIndex={burnRunway ? 0 : -1}
              className={`rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-5 text-left lg:flex lg:flex-col transition-colors ${
                burnRunway
                  ? "cursor-pointer hover:bg-violet-500/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/40"
                  : ""
              }`}
              onClick={() => {
                if (!burnRunway) return
                setCalculationModal("runway")
              }}
              onKeyDown={(e) => {
                if (!burnRunway) return
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setCalculationModal("runway")
                }
              }}
            >
              <div className="flex gap-3">
                <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-violet-300/90" aria-hidden />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-xs uppercase tracking-widest text-white/40">Runway</p>
                  {data.burnRunway ? (
                    <>
                      <p className="text-[10px] uppercase tracking-wider text-violet-100/80">Tocar para ver cálculo</p>
                      <p className="text-2xl font-bold tabular-nums text-violet-100 lg:text-3xl">
                        {runwayHeadline(data.burnRunway)}
                      </p>
                      {runwaySupportingCopy(data.burnRunway, cur)}
                      {data.burnRunway.runwayMonthsAtPlannedBurn != null &&
                      data.burnRunway.plannedMonthlyBurnPrimary > 0 ? (
                        <p className="text-[11px] text-violet-200/75 mt-3 border-t border-violet-500/25 pt-3 leading-relaxed">
                          Si gastaras solo lo planificado:{" "}
                          <span className="font-semibold text-violet-100 tabular-nums">
                            {runwayMonthsHuman(data.burnRunway.runwayMonthsAtPlannedBurn)}
                          </span>{" "}
                          (misma liquidez estimada).
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-medium text-white/45">—</p>
                      <p className="text-[11px] text-white/38 lg:mt-auto lg:pt-1">
                        No se pudo calcular (tipos de cambio o servicios externos).
                      </p>
                    </>
                  )}
                </div>
              </div>
            </section>
          </div>

          <MonthlyObligationsPlanEditor
            currency={cur}
            lines={data.obligationPlanLines}
            onSaved={() => void refreshAll({ silent: true })}
          />

          <section className="min-w-0 space-y-4 rounded-xl border border-white/15 bg-white/[0.03] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-widest text-white/40">Este mes (correo / manual)</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] text-white/50 hover:text-white hover:bg-white/10"
                onClick={() => {
                  ledgerHaptic()
                  void refreshAll({ silent: true })
                }}
              >
                Refrescar
              </Button>
            </div>
            <p className="text-[11px] text-white/45">
              Montos en <span className="text-white/65">{cur}</span>. Los gastos usan deduplicación: mismo día UTC,
              misma moneda y mismo monto — si hay confirmación de{" "}
              <strong className="text-white/55">banco</strong> y también un correo de{" "}
              <strong className="text-white/55">comercio / otro origen</strong>, solo contamos el no-banco para no
              duplicar recibo + aviso bancario.
            </p>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex justify-between items-baseline gap-2">
                <span className="text-white/60">Ingresos</span>
                <span className="font-semibold text-emerald-300 tabular-nums">
                  {formatFiatAmount(data.incomeThisMonth, cur)}
                </span>
              </div>
              <div className="flex justify-between items-baseline gap-2">
                <span className="text-white/60">Gastos</span>
                <span className="font-semibold text-rose-300 tabular-nums">
                  {formatFiatAmount(data.expensesThisMonth, cur)}
                </span>
              </div>
              <div className="border-t border-white/10 pt-3 flex justify-between items-baseline gap-2">
                <span className="text-white/80 font-medium">Flujo neto estimado</span>
                <span className="font-bold text-lg tabular-nums">{formatFiatAmount(data.netCashflow, cur)}</span>
              </div>
            </div>
            {data.expenseDuplicatesCollapsedMonth > 0 ? (
              <p className="text-[11px] text-sky-300/95">
                Este mes se omitieron {data.expenseDuplicatesCollapsedMonth} fila
                {data.expenseDuplicatesCollapsedMonth === 1 ? "" : "s"} de gasto por posible duplicado recibo + banco
                (mismo día UTC, moneda y monto).
              </p>
            ) : null}
            {data.needsReviewCount > 0 && (
              <p className="text-xs text-amber-300/90">
                {data.needsReviewCount} movimiento{data.needsReviewCount === 1 ? "" : "s"} con baja confianza — tocá una
                fila abajo o abrí Movimientos.
              </p>
            )}
          </section>
        </div>

        {/* Right column (desktop): goals, then expense distribution */}
        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-xl border border-white/15 bg-white/[0.03] lg:flex lg:flex-col overflow-hidden">
            <Link
              href="/ledger/goals"
              className="group block p-5 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 focus-visible:ring-inset"
            >
              <div className="flex gap-3">
                <Target className="mt-0.5 h-5 w-5 shrink-0 text-amber-400/85" aria-hidden />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs uppercase tracking-widest text-white/40">Metas y hitos</p>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-amber-300/90 opacity-0 transition-opacity group-hover:opacity-100">
                      Configurar →
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-white/55">
                    Definí deudas, ahorros y objetivos con plazos; un asistente te hace preguntas y propone hitos según
                    tu flujo del mes.
                  </p>
                </div>
              </div>
            </Link>
            <ul className="px-5 pb-5 space-y-2 border-t border-white/10 pt-4 text-[13px] text-white/45 lg:mt-auto">
              <li className="flex gap-2">
                <span className="text-emerald-400/70">✓</span>
                <span>Coach + formulario de metas e hitos</span>
              </li>
              <li className="flex gap-2">
                <span className="text-white/25">○</span>
                <span>Límite mensual por categoría (próximo)</span>
              </li>
            </ul>
          </section>

          <section className="min-w-0 space-y-4 rounded-xl border border-white/15 bg-white/[0.03] p-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/40">Distribución de gastos</p>
            <p className="text-[11px] text-white/45 mt-1">
            Gráficos animados en <span className="text-white/65">{cur}</span>. Categoría = tu clasificación; origen =
            banco / Mach / correo. La tabla de abajo usa la misma ventana UTC que la pestaña activa (mes / 7 días / hoy)
            más el filtro de categoría si elegís una porción del donut.
          </p>
        </div>

        <Tabs defaultValue="category" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-auto gap-1 rounded-lg bg-white/10 p-1 text-white/70">
            <TabsTrigger
              value="category"
              onClick={() => ledgerHaptic()}
              className="rounded-md text-xs data-[state=active]:bg-white data-[state=active]:text-black"
            >
              Por categoría
            </TabsTrigger>
            <TabsTrigger
              value="origin"
              onClick={() => ledgerHaptic()}
              className="rounded-md text-xs data-[state=active]:bg-white data-[state=active]:text-black"
            >
              Por origen
            </TabsTrigger>
          </TabsList>

          <TabsContent value="category" className="mt-4 outline-none space-y-4">
            <Tabs
              value={chartWindow}
              onValueChange={(v) => setChartWindow(v as LedgerChartWindow)}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-3 h-auto gap-1 rounded-lg bg-white/10 p-1 text-white/70">
                <TabsTrigger
                  value="month"
                  onClick={() => ledgerHaptic()}
                  className="rounded-md text-[11px] data-[state=active]:bg-white data-[state=active]:text-black"
                >
                  Este mes
                </TabsTrigger>
                <TabsTrigger
                  value="week"
                  onClick={() => ledgerHaptic()}
                  className="rounded-md text-[11px] data-[state=active]:bg-white data-[state=active]:text-black"
                >
                  7 días
                </TabsTrigger>
                <TabsTrigger
                  value="day"
                  onClick={() => ledgerHaptic()}
                  className="rounded-md text-[11px] data-[state=active]:bg-white data-[state=active]:text-black"
                >
                  Hoy UTC
                </TabsTrigger>
              </TabsList>
              <TabsContent value="month" className="mt-4 outline-none">
                <ExpenseBreakdownDonut
                  data={categorySlicesToDonut(data.expenseCategoryBreakdown)}
                  currency={cur}
                  tint="rose"
                  selectedFilterKey={categoryFilter}
                  onFilterClick={handleCategoryDonutClick}
                />
              </TabsContent>
              <TabsContent value="week" className="mt-4 outline-none">
                <ExpenseBreakdownDonut
                  data={categorySlicesToDonut(data.expenseCategoryWeek)}
                  currency={cur}
                  tint="rose"
                  selectedFilterKey={categoryFilter}
                  onFilterClick={handleCategoryDonutClick}
                />
              </TabsContent>
              <TabsContent value="day" className="mt-4 outline-none">
                <ExpenseBreakdownDonut
                  data={categorySlicesToDonut(data.expenseCategoryDay)}
                  currency={cur}
                  tint="rose"
                  selectedFilterKey={categoryFilter}
                  onFilterClick={handleCategoryDonutClick}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="origin" className="mt-4 outline-none space-y-4">
            <Tabs
              value={chartWindow}
              onValueChange={(v) => setChartWindow(v as LedgerChartWindow)}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-3 h-auto gap-1 rounded-lg bg-white/10 p-1 text-white/70">
                <TabsTrigger
                  value="month"
                  onClick={() => ledgerHaptic()}
                  className="rounded-md text-[11px] data-[state=active]:bg-white data-[state=active]:text-black"
                >
                  Este mes
                </TabsTrigger>
                <TabsTrigger
                  value="week"
                  onClick={() => ledgerHaptic()}
                  className="rounded-md text-[11px] data-[state=active]:bg-white data-[state=active]:text-black"
                >
                  7 días
                </TabsTrigger>
                <TabsTrigger
                  value="day"
                  onClick={() => ledgerHaptic()}
                  className="rounded-md text-[11px] data-[state=active]:bg-white data-[state=active]:text-black"
                >
                  Hoy UTC
                </TabsTrigger>
              </TabsList>
              <TabsContent value="month" className="mt-4 outline-none">
                <ExpenseBreakdownDonut
                  data={institutionSlicesToDonut(data.expenseInstitutionMonth)}
                  currency={cur}
                  tint="rose"
                />
              </TabsContent>
              <TabsContent value="week" className="mt-4 outline-none">
                <ExpenseBreakdownDonut
                  data={institutionSlicesToDonut(data.expenseInstitutionWeek)}
                  currency={cur}
                  tint="rose"
                />
              </TabsContent>
              <TabsContent value="day" className="mt-4 outline-none">
                <ExpenseBreakdownDonut
                  data={institutionSlicesToDonut(data.expenseInstitutionDay)}
                  currency={cur}
                  tint="rose"
                />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
        </section>
        </div>
      </div>

      {data.incomeCategoryBreakdown.length > 0 ? (
        <section className="rounded-xl border border-white/15 bg-white/[0.03] p-5 space-y-3">
          <p className="text-xs uppercase tracking-widest text-white/40">Ingresos por categoría (mes)</p>
          <div className="flex flex-wrap gap-2">
            {data.incomeCategoryBreakdown.map((row) => (
              <span
                key={row.category}
                className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-100/95"
              >
                <span className="capitalize">{row.category.replace(/_/g, " ")}</span>
                <span className="mx-1 text-emerald-300/50">·</span>
                <span className="tabular-nums">{formatFiatAmount(row.amount, cur)}</span>
                <span className="text-emerald-300/70 ml-1">({row.pct}%)</span>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="w-full overflow-hidden rounded-xl border border-white/15 bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-4 sm:px-5 lg:px-6">
          <div className="space-y-2 min-w-0">
            <p className="text-xs uppercase tracking-widest text-white/40">Últimos movimientos</p>
            <div className="flex flex-wrap items-center gap-2">
              {chartWindow !== "month" ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/35 bg-violet-500/15 px-2.5 py-1 text-[11px] text-violet-100/95">
                    <span className="text-white/50">Ventana:</span>
                    <span className="font-medium">{ledgerChartWindowLabel(chartWindow)}</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] text-white/55 hover:text-white hover:bg-white/10"
                    onClick={() => {
                      ledgerHaptic()
                      setChartWindow("month")
                    }}
                  >
                    Mes UTC
                  </Button>
                </>
              ) : null}
              {categoryFilter ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/35 bg-sky-500/15 px-2.5 py-1 text-[11px] text-sky-100/95">
                    <span className="text-white/50">Categoría:</span>
                    <span className="capitalize font-medium">{categoryFilter.replace(/_/g, " ")}</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] text-white/55 hover:text-white hover:bg-white/10"
                    onClick={() => {
                      ledgerHaptic()
                      setCategoryFilter(null)
                    }}
                  >
                    Quitar categoría
                  </Button>
                </>
              ) : (
                <p className="text-[11px] text-white/38">
                  Clic en una porción del donut (por categoría) para combinar con la ventana del gráfico.
                </p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="border-white/20 bg-white/5 text-white hover:bg-white/10 shrink-0 gap-1.5"
          >
            <Link
              href={fullTableHref}
              onClick={() => ledgerHaptic()}
              className="inline-flex items-center gap-1.5"
            >
              <Waves className="size-3.5 text-sky-300/90 shrink-0" aria-hidden />
              Ver tabla completa
            </Link>
          </Button>
        </div>
        {previewLoading ? (
          <div className="max-h-[280px] overflow-hidden lg:max-h-[min(52vh,560px)] px-3 py-4 sm:px-5 lg:px-6">
            <LedgerTransactionsTableSkeleton rows={8} />
          </div>
        ) : previewTx.length === 0 ? (
          <p className="px-4 py-6 text-sm text-white/45 sm:px-5 lg:px-6">
            {categoryFilter
              ? `No hay movimientos con categoría «${categoryFilter.replace(/_/g, " ")}» en ${ledgerChartWindowLabel(chartWindow)}.`
              : chartWindow !== "month"
                ? `No hay movimientos en ${ledgerChartWindowLabel(chartWindow)}.`
                : "Aún no hay movimientos en el libro."}
          </p>
        ) : (
          <div className="max-h-[280px] overflow-auto lg:max-h-[min(52vh,560px)]">
            <Table className="min-w-[640px] lg:min-w-0">
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="sticky top-0 bg-black/55 px-3 text-white/55 backdrop-blur-md lg:px-4">
                    Fecha
                  </TableHead>
                  <TableHead className="sticky top-0 bg-black/55 px-3 text-white/55 backdrop-blur-md lg:min-w-[12rem] lg:px-4 xl:min-w-[16rem]">
                    Comercio
                  </TableHead>
                  <TableHead className="sticky top-0 bg-neutral-950/95 px-3 text-right text-white/55 backdrop-blur-sm lg:px-4">
                    Monto
                  </TableHead>
                  <TableHead className="sticky top-0 bg-black/55 px-3 text-white/55 backdrop-blur-md lg:px-4">
                    Tipo
                  </TableHead>
                  <TableHead className="sticky top-0 max-w-[88px] bg-black/55 px-3 text-white/55 backdrop-blur-md lg:max-w-none lg:min-w-[7rem] lg:px-4">
                    Origen
                  </TableHead>
                  <TableHead className="sticky top-0 bg-black/55 px-3 text-white/55 backdrop-blur-md lg:px-4">
                    Cat.
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewTx.map((r) => (
                  <TableRow
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    className="border-white/10 cursor-pointer hover:bg-white/[0.06] focus-visible:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
                    onClick={() => setDetailTx(r)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        setDetailTx(r)
                      }
                    }}
                  >
                    <TableCell className="whitespace-nowrap px-3 text-xs text-white/80 lg:px-4">
                      {formatLedgerTxTableMoment(r.date, r.source)}
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate px-3 text-xs text-white/75 lg:max-w-none lg:whitespace-normal lg:px-4 xl:max-w-[20rem] xl:truncate">
                      {r.merchant ?? "—"}
                    </TableCell>
                    <TableCell className="px-3 text-right text-xs tabular-nums text-white/85 lg:px-4">
                      {Number(r.amount).toLocaleString("es-CL")} {r.currency}
                    </TableCell>
                    <TableCell className="px-3 text-xs capitalize text-white/70 lg:px-4">{r.type}</TableCell>
                    <TableCell
                      className="max-w-[88px] truncate px-3 text-[10px] text-white/60 lg:max-w-none lg:min-w-[7rem] lg:px-4 lg:text-xs"
                      title={r.institution_label ?? undefined}
                    >
                      {r.institution_label ?? "—"}
                    </TableCell>
                    <TableCell className="px-3 text-xs text-white/65 lg:px-4">{r.category}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="border-t border-white/10 px-4 py-3 text-[11px] text-white/40 sm:px-5 lg:px-6">
          Toca una fila para ver el detalle, editar categoría, recordar reglas o clasificar con IA (igual que en
          Movimientos).
        </p>
      </section>

      <LedgerTransactionEditDialog
        open={detailTx !== null}
        onOpenChange={(open) => {
          if (!open) setDetailTx(null)
        }}
        row={detailTx ? previewTxToEditRow(detailTx) : null}
        categories={ledgerCategories}
        incomeCategories={ledgerIncomeCategories}
        onCategoriesChange={setLedgerCategories}
        onIncomeCategoriesChange={setLedgerIncomeCategories}
        onSaved={(id, patch) => {
          const before = detailTx && detailTx.id === id ? detailTx : previewTx.find((tx) => tx.id === id) ?? null
          if (before) {
            const after = { ...before, ...patch } as PreviewTx
            setData((prev) => (prev ? patchSummaryWithEditedTx(prev, before, after) : prev))
          }
          mergePreviewPatch(id, patch as Partial<PreviewTx>)
          void refreshAll({ silent: true })
        }}
        onDismissed={(id) => {
          setPreviewTx((prev) => prev.filter((r) => r.id !== id))
          setDetailTx(null)
          void refreshAll({ silent: true })
        }}
      />

      <Dialog open={calculationModal !== null} onOpenChange={(open) => !open && setCalculationModal(null)}>
        <DialogContent className="max-h-[88dvh] overflow-y-auto border-white/15 bg-neutral-950 text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {calculationModal === "burn" ? "Como se calcula tu ritmo de gasto" : "Como se calcula tu runway"}
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Mismos numeros que usa `/api/ledger/summary` para pintar estas tarjetas.
            </DialogDescription>
          </DialogHeader>
          {burnRunway ? (
            calculationModal === "burn" ? (
              <div className="space-y-4 text-sm">
                <p className="text-white/75 leading-relaxed">
                  El valor principal de la tarjeta de Burn Rate es <strong className="text-white">gasto bruto mensual promedio</strong>. La quema neta se calcula aparte como{" "}
                  <strong className="text-white">gasto - ingreso</strong> (minimo 0).
                </p>
                <div className="rounded-lg border border-white/10 bg-black/65 p-3 space-y-1.5 text-[13px]">
                  <p className="text-white/45">Ventana de calculo</p>
                  <p className="text-white/90">{grossExpenseBasisCaption(burnRunway)}</p>
                  <p className="text-white/45">{burnRunwayBasisCaption(burnRunway)}</p>
                  <p className="text-white/55">
                    Meses cerrados considerados: <span className="tabular-nums text-white/80">{burnRunway.completedMonthsSampled}</span>
                  </p>
                </div>
                <div className="rounded-lg border border-orange-500/25 bg-orange-500/[0.08] p-3 space-y-2">
                  <CalcLine
                    label="Gasto bruto mensual promedio"
                    value={formatFiatAmount(burnRunway.avgMonthlyGrossExpensePrimary, cur)}
                  />
                  <CalcLine
                    label="Ingreso bruto mensual promedio"
                    value={formatFiatAmount(burnRunway.avgMonthlyGrossIncomePrimary, cur)}
                  />
                  <CalcLine
                    label="Quema neta promedio (max(0, gasto - ingreso))"
                    value={formatFiatAmount(burnRunway.burnRateMonthlyPrimary, cur)}
                  />
                  <CalcLine
                    label="Chequeo formula con tus numeros"
                    value={formatFiatAmount(impliedNetBurnFromGross, cur)}
                  />
                  <CalcLine
                    label="Proyeccion gasto bruto mes actual (lineal)"
                    value={formatFiatAmount(burnRunway.projectedGrossExpenseThisMonthPrimary, cur)}
                  />
                </div>
                {burnRunway.plannedMonthlyBurnPrimary > 0 ? (
                  <div className="rounded-lg border border-violet-500/25 bg-violet-500/[0.08] p-3 space-y-2">
                    <CalcLine
                      label="Plan mensual (obligaciones)"
                      value={formatFiatAmount(burnRunway.plannedMonthlyBurnPrimary, cur)}
                    />
                    <CalcLine
                      label="Diferencia vs plan (neto - plan)"
                      value={`${burnRunway.burnVsPlanDelta && burnRunway.burnVsPlanDelta > 0 ? "+" : ""}${formatFiatAmount(
                        burnRunway.burnVsPlanDelta ?? 0,
                        cur
                      )}`}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                <p className="text-white/75 leading-relaxed">
                  El runway usa <strong className="text-white">recursos disponibles</strong> divididos por tu <strong className="text-white">gasto bruto mensual promedio</strong>.
                </p>
                <div className="rounded-lg border border-white/10 bg-black/65 p-3 space-y-1.5 text-[13px]">
                  <p className="text-white/45">Formula base</p>
                  <p className="text-white/90">
                    Runway = (liquidez + ingreso bruto mensual promedio) / gasto bruto mensual promedio
                  </p>
                </div>
                <div className="rounded-lg border border-violet-500/25 bg-violet-500/[0.08] p-3 space-y-2">
                  <CalcLine
                    label="Liquidez estimada (wallet + vaults asset)"
                    value={formatFiatAmount(burnRunway.liquidPrimaryEquivalent, cur)}
                  />
                  <CalcLine
                    label="Ingreso bruto mensual promedio"
                    value={formatFiatAmount(burnRunway.avgMonthlyGrossIncomePrimary, cur)}
                  />
                  <CalcLine
                    label="Recursos para runway (liquidez + ingreso)"
                    value={formatFiatAmount(burnRunway.runwayResourcePrimary, cur)}
                  />
                  <CalcLine
                    label="Gasto bruto mensual promedio"
                    value={formatFiatAmount(burnRunway.avgMonthlyGrossExpensePrimary, cur)}
                  />
                  <CalcLine
                    label="Runway resultante"
                    value={burnRunway.runwayMonths == null ? "—" : runwayMonthsHuman(burnRunway.runwayMonths)}
                  />
                </div>
                <div className="rounded-lg border border-white/10 bg-black/65 p-3 space-y-2">
                  <CalcLine
                    label="Wallet USDC (original)"
                    value={burnRunway.walletUsdc == null ? "—" : `${burnRunway.walletUsdc.toFixed(2)} USDC`}
                  />
                  <CalcLine
                    label="Wallet convertido a moneda principal"
                    value={
                      burnRunway.walletPrimaryEquivalent == null
                        ? "—"
                        : formatFiatAmount(burnRunway.walletPrimaryEquivalent, cur)
                    }
                  />
                  <CalcLine
                    label="Vaults asset (equivalente moneda principal)"
                    value={formatFiatAmount(burnRunway.vaultAssetsPrimaryEquivalent, cur)}
                  />
                </div>
                {burnRunway.runwayMonthsAtPlannedBurn != null && burnRunway.plannedMonthlyBurnPrimary > 0 ? (
                  <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.08] p-3 space-y-2">
                    <CalcLine
                      label="Runway si gastas solo el plan mensual"
                      value={runwayMonthsHuman(burnRunway.runwayMonthsAtPlannedBurn)}
                    />
                    <CalcLine
                      label="Plan mensual usado"
                      value={formatFiatAmount(burnRunway.plannedMonthlyBurnPrimary, cur)}
                    />
                  </div>
                ) : null}
              </div>
            )
          ) : (
            <p className="text-sm text-white/60">No hay datos para explicar calculo en este momento.</p>
          )}
        </DialogContent>
      </Dialog>

      <p className="text-xs text-white/45 leading-relaxed px-1">
        El flujo neto es un estimado a partir de correos y entradas manuales; no sustituye tu saldo USDC en Stellar.
      </p>
    </div>
  )
}

function burnRunwayBasisCaption(br: BurnRunway): string {
  return br.basis === "avg_completed_3utc"
    ? "Promedio de los últimos 3 meses cerrados (UTC), con la misma deduplicación que el resumen."
    : "Mes UTC en curso: gastos menos ingresos en tu moneda principal (deduplicado)."
}

function grossExpenseBasisCaption(br: BurnRunway): string {
  return br.basis === "avg_completed_3utc"
    ? "Gastos brutos (sin restar ingresos): promedio de los últimos 3 meses UTC cerrados, deduplicado como el resumen."
    : "Mes UTC en curso: total de gastos brutos acumulados a hoy (deduplicado)."
}

function projectedGrossExpenseVsAverageTone(br: BurnRunway): "ok" | "high" | "neutral" {
  const avg = br.avgMonthlyGrossExpensePrimary
  const proj = br.projectedGrossExpenseThisMonthPrimary
  if (!Number.isFinite(avg) || !Number.isFinite(proj) || avg <= 0) return "neutral"
  const tol = Math.max(avg * 0.02, 1)
  return proj <= avg + tol ? "ok" : "high"
}

function projectedGrossExpenseVsAverageHint(br: BurnRunway): string {
  const tone = projectedGrossExpenseVsAverageTone(br)
  if (tone === "ok") return "Igual o por debajo del promedio — conviene mantenerlo así."
  if (tone === "high") return "Por encima del promedio: si se mantiene, el mes cierra más caro que lo habitual."
  return "Sin promedio de referencia todavía."
}

function runwayMonthsHuman(m: number): string {
  if (m <= 0) return "0 meses"
  if (m >= 240) return "240+ meses"
  const digits = m >= 100 ? 0 : 1
  return `${m.toLocaleString("es-CL", { maximumFractionDigits: digits, minimumFractionDigits: digits })} meses`
}

function runwayHeadline(br: BurnRunway): string {
  if (br.avgMonthlyGrossExpensePrimary <= 0) return "—"
  if (br.runwayMonths == null || !Number.isFinite(br.runwayMonths)) return "—"
  return runwayMonthsHuman(br.runwayMonths)
}

function runwaySupportingCopy(br: BurnRunway, cur: string): ReactNode {
  if (br.avgMonthlyGrossExpensePrimary <= 0) {
    return (
      <p className="text-[11px] text-white/45 leading-relaxed lg:mt-auto lg:pt-1">
        Sin gasto bruto mensual promedio en esta ventana; no se puede estimar runway.
      </p>
    )
  }
  return (
    <p className="text-[11px] text-white/45 leading-relaxed lg:mt-auto lg:pt-1">
      Recursos estimados (liquidez + ingreso bruto típico al mes):{" "}
      <span className="text-white/70 tabular-nums">{formatFiatAmount(br.runwayResourcePrimary, cur)}</span>
      {" · "}liquidez sola:{" "}
      <span className="text-white/55 tabular-nums">{formatFiatAmount(br.liquidPrimaryEquivalent, cur)}</span>
      {" · "}ingreso típico/mes:{" "}
      <span className="text-white/55 tabular-nums">{formatFiatAmount(br.avgMonthlyGrossIncomePrimary, cur)}</span>.
      Runway = eso ÷ gasto bruto mensual promedio (misma ventana UTC y deduplicación que el promedio de arriba).
      Liquidez = wallet USDC + vaults activo (FX MVP vía USD).
    </p>
  )
}

function kindShort(kind: InstitutionKind): string {
  switch (kind) {
    case "bank":
      return "Banco"
    case "digital_wallet":
      return "Wallet"
    case "payments_rail":
      return "Pagos"
    case "card_network":
      return "Tarjeta"
    case "merchant_platform":
      return "Tienda"
    case "manual":
      return "Manual"
    default:
      return "Otro"
  }
}

function institutionSlicesToDonut(rows: InstitutionSlice[]): DonutDatum[] {
  return rows.map((row) => ({
    name: row.label,
    value: row.amount,
    pct: row.pct,
    meta: `${row.count} mov. · ${kindShort(row.kind)}`,
  }))
}

function categorySlicesToDonut(rows: CategorySlice[]): DonutDatum[] {
  return rows.map((row) => ({
    name: row.category.replace(/_/g, " "),
    filterKey: row.category,
    value: row.amount,
    pct: row.pct,
    meta: `${row.count} mov.`,
  }))
}

function CalcLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-white/60">{label}</span>
      <span className="tabular-nums text-white/90 text-right">{value}</span>
    </div>
  )
}
