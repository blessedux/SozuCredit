"use client"

import { Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import {
  addMonths,
  format,
  isSameMonth,
  startOfMonth,
  subMonths,
  endOfMonth,
  isWithinInterval,
} from "date-fns"
import { es } from "date-fns/locale"
import { Check, ChevronDown, ChevronLeft, ChevronRight, Plus, RefreshCw, Search } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ledgerUserHeaders } from "@/lib/ledger/client-headers"
import type { LedgerChartWindow } from "@/lib/ledger/ledger-chart-window"
import { ledgerChartWindowLabel, ledgerWindowUtcBounds } from "@/lib/ledger/ledger-chart-window"
import { DEFAULT_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "@/lib/ledger/types"
import { formatLedgerTxTableMoment, transactionInstantMs } from "@/lib/ledger/transaction-date"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  LedgerTransactionEditDialog,
  LEDGER_VAULT_SELECT_NONE,
  type LedgerTransactionEditRow,
} from "@/components/ledger/ledger-transaction-edit-dialog"
import { LedgerStackedRouteSkeleton } from "@/components/ledger/ledger-stacked-route-skeleton"
import { LedgerCategoryCombobox } from "@/components/ledger/ledger-category-combobox"
import { LedgerTransactionsTableSkeleton } from "@/components/ledger/ledger-transactions-table-skeleton"
import { ExpenseBreakdownDonut, type DonutDatum } from "@/components/ledger/expense-breakdown-donut"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  buildExpenseCategoryBreakdown,
  buildIncomeCategoryBreakdown,
  type CategoryBreakdownSlice,
} from "@/lib/ledger/summary-breakdown"
import { formatFiatAmount } from "@/lib/ledger/format-fiat"

type Row = LedgerTransactionEditRow & {
  user_id?: string
  created_at?: string
}

type BreakdownRow = {
  amount: number
  currency: string
  type: string
  category: string
}

function dominantCurrencyFromRows(rows: Row[]): string {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const c = r.currency.toUpperCase()
    if (!c) continue
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  let best = "CLP"
  let bestN = 0
  for (const [cur, n] of counts) {
    if (n > bestN) {
      best = cur
      bestN = n
    }
  }
  return best
}

function rowsForExpenseBreakdown(rows: Row[]): BreakdownRow[] {
  return rows.map((r) => ({
    amount: Number(r.amount),
    currency: r.currency,
    type: r.type,
    category: r.category,
  }))
}

function categoryBreakdownToDonut(slices: CategoryBreakdownSlice[]): DonutDatum[] {
  return slices.map((row) => ({
    name: row.category.replace(/_/g, " "),
    filterKey: row.category,
    value: row.amount,
    pct: row.pct,
    meta: `${row.count} mov.`,
  }))
}

export default function LedgerTransactionsPage() {
  return (
    <Suspense fallback={<LedgerStackedRouteSkeleton />}>
      <LedgerTransactionsContent />
    </Suspense>
  )
}

function LedgerTransactionsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [rows, setRows] = useState<Row[]>([])
  const [categories, setCategories] = useState<string[]>([...DEFAULT_CATEGORIES])
  const [incomeCategories, setIncomeCategories] = useState<string[]>([...DEFAULT_INCOME_CATEGORIES])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("CLP")
  const [merchant, setMerchant] = useState("")
  const [type, setType] = useState<string>("expense")
  const [category, setCategory] = useState<string>("unknown")
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [detailRow, setDetailRow] = useState<Row | null>(null)
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()))
  const [addPopoverOpen, setAddPopoverOpen] = useState(false)
  const [manualCatPopoverOpen, setManualCatPopoverOpen] = useState(false)
  const [manualNewCatLabel, setManualNewCatLabel] = useState("")
  const [manualAddCatLoading, setManualAddCatLoading] = useState(false)
  const [manualAddCatError, setManualAddCatError] = useState<string | null>(null)

  const [manualVaultId, setManualVaultId] = useState<string>(LEDGER_VAULT_SELECT_NONE)
  const [vaultOptions, setVaultOptions] = useState<{ id: string; name: string }[]>([])
  const [vaultsLoading, setVaultsLoading] = useState(false)
  const [tableSearch, setTableSearch] = useState("")
  const [tableCurrencyFilter, setTableCurrencyFilter] = useState("all")
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([])
  const [bulkDismissing, setBulkDismissing] = useState(false)
  const [inlineEditCategoryRowId, setInlineEditCategoryRowId] = useState<string | null>(null)
  const [inlineEditCategoryValue, setInlineEditCategoryValue] = useState<string>("unknown")
  const [inlineEditCategorySavingId, setInlineEditCategorySavingId] = useState<string | null>(null)
  const [gmailSyncLoading, setGmailSyncLoading] = useState(false)
  const [gmailSyncNote, setGmailSyncNote] = useState<string | null>(null)

  const tableCategoryFilter = useMemo(() => {
    const raw = searchParams.get("category")?.trim().toLowerCase()
    return raw && /^[a-z0-9_]{1,64}$/.test(raw) ? raw : null
  }, [searchParams])

  const tableWindowFilter = useMemo((): LedgerChartWindow | null => {
    const raw = searchParams.get("window")?.trim().toLowerCase()
    return raw === "month" || raw === "week" || raw === "day" ? raw : null
  }, [searchParams])

  const tableWindowBounds = useMemo(() => {
    if (!tableWindowFilter) return null
    return ledgerWindowUtcBounds(tableWindowFilter, new Date())
  }, [tableWindowFilter])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/ledger/transactions?limit=500", {
        headers: ledgerUserHeaders(),
        cache: "no-store",
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Error al cargar")
        setRows([])
        return
      }
      setRows(json.transactions ?? [])
      if (Array.isArray(json.categories)) setCategories(json.categories)
      if (Array.isArray(json.incomeCategories)) setIncomeCategories(json.incomeCategories)
    } catch {
      setError("Red no disponible")
    } finally {
      setLoading(false)
    }
  }, [])

  const handleGmailIncrementalSync = useCallback(async () => {
    setGmailSyncLoading(true)
    setGmailSyncNote(null)
    try {
      const res = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: { ...ledgerUserHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "incremental" }),
        signal: AbortSignal.timeout(280_000),
      })
      const json = (await res.json()) as {
        error?: string
        hint?: string
        message?: string
        createdTransactions?: number
        scanned?: number
        skippedExisting?: number
        listedMessages?: number
      }
      if (!res.ok) {
        setGmailSyncNote(json.hint || json.error || "No se pudo sincronizar Gmail.")
        return
      }
      const parts: string[] = []
      if (typeof json.createdTransactions === "number" && json.createdTransactions > 0) {
        parts.push(`${json.createdTransactions} movimiento(s) nuevo(s).`)
      } else {
        parts.push("Sin movimientos nuevos desde el último sync.")
      }
      if (typeof json.skippedExisting === "number" && json.skippedExisting > 0) {
        parts.push(`${json.skippedExisting} correo(s) ya importados (omitidos).`)
      }
      setGmailSyncNote(parts.join(" "))
      await load()
    } catch {
      setGmailSyncNote("Error de red o tiempo agotado al sincronizar.")
    } finally {
      setGmailSyncLoading(false)
    }
  }, [load])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    setVaultsLoading(true)
    ;(async () => {
      try {
        const res = await fetch("/api/ledger/vaults", {
          headers: ledgerUserHeaders(),
          cache: "no-store",
        })
        const j = (await res.json().catch(() => ({}))) as { vaults?: { id: string; name: string }[] }
        if (!cancelled && res.ok && Array.isArray(j.vaults)) {
          setVaultOptions(j.vaults.map((v) => ({ id: v.id, name: v.name })))
        }
      } finally {
        if (!cancelled) setVaultsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const manualCategoryList = useMemo(() => {
    return type === "income" || type === "refund" ? incomeCategories : categories
  }, [type, incomeCategories, categories])

  useEffect(() => {
    setCategory((prev) => {
      const list = type === "income" || type === "refund" ? incomeCategories : categories
      if (list.includes(prev)) return prev
      return "unknown"
    })
  }, [type, categories, incomeCategories])

  useEffect(() => {
    if (type !== "income" && type !== "refund") setManualVaultId(LEDGER_VAULT_SELECT_NONE)
  }, [type])

  useEffect(() => {
    const txId = searchParams.get("tx")
    if (!txId || loading || rows.length === 0) return
    const row = rows.find((r) => r.id === txId)
    if (!row) return
    setDetailRow(row)
    router.replace("/ledger/transactions", { scroll: false })
  }, [searchParams, rows, loading, router])

  useEffect(() => {
    const ids = new Set(rows.map((r) => r.id))
    setSelectedRowIds((prev) => prev.filter((id) => ids.has(id)))
  }, [rows])

  const monthsWithData = useMemo(() => {
    const seen = new Map<string, Date>()
    for (const r of rows) {
      const d = new Date(r.date)
      const key = format(startOfMonth(d), "yyyy-MM")
      if (!seen.has(key)) seen.set(key, startOfMonth(d))
    }
    return [...seen.values()].sort((a, b) => b.getTime() - a.getTime())
  }, [rows])

  const tableCurrencies = useMemo(() => {
    return [...new Set(rows.map((r) => r.currency.toUpperCase()))].filter(Boolean).sort((a, b) => a.localeCompare(b))
  }, [rows])

  const filteredRows = useMemo(() => {
    const q = tableSearch.trim().toLowerCase()
    return rows.filter((r) => {
      const t = transactionInstantMs(r.date)
      if (t == null) return false
      if (tableWindowBounds) {
        if (t < tableWindowBounds.startMs || t > tableWindowBounds.endMs) return false
      } else {
        const start = viewMonth
        const end = endOfMonth(viewMonth)
        if (!isWithinInterval(new Date(r.date), { start, end })) return false
      }
      if (tableCategoryFilter && r.category !== tableCategoryFilter) return false
      if (tableCurrencyFilter !== "all" && r.currency.toUpperCase() !== tableCurrencyFilter) return false
      if (q) {
        const haystack = [
          r.merchant ?? "",
          r.merchant_legal ?? "",
          r.category ?? "",
          r.type ?? "",
          r.source ?? "",
          r.currency ?? "",
          r.institution_label ?? "",
          r.cardholder_name ?? "",
          r.card_last_four ?? "",
        ]
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [rows, viewMonth, tableCategoryFilter, tableWindowBounds, tableSearch, tableCurrencyFilter])

  const selectedIdsSet = useMemo(() => new Set(selectedRowIds), [selectedRowIds])
  const selectedVisibleCount = useMemo(
    () => filteredRows.reduce((acc, row) => acc + (selectedIdsSet.has(row.id) ? 1 : 0), 0),
    [filteredRows, selectedIdsSet]
  )
  const allVisibleSelected = filteredRows.length > 0 && selectedVisibleCount === filteredRows.length
  const someVisibleSelected = selectedVisibleCount > 0 && selectedVisibleCount < filteredRows.length

  const monthRowsForViz = useMemo(() => {
    const start = viewMonth
    const end = endOfMonth(viewMonth)
    return rows.filter((r) => {
      const t = transactionInstantMs(r.date)
      if (t == null) return false
      return isWithinInterval(new Date(r.date), { start, end })
    })
  }, [rows, viewMonth])

  const vizPrimaryCurrency = useMemo(
    () => dominantCurrencyFromRows(monthRowsForViz),
    [monthRowsForViz]
  )

  const monthRowsBreakdown = useMemo(
    () => rowsForExpenseBreakdown(monthRowsForViz),
    [monthRowsForViz]
  )

  const expenseSlicesForMonth = useMemo(
    () => buildExpenseCategoryBreakdown(monthRowsBreakdown, vizPrimaryCurrency),
    [monthRowsBreakdown, vizPrimaryCurrency]
  )

  const incomeSlicesForMonth = useMemo(
    () => buildIncomeCategoryBreakdown(monthRowsBreakdown, vizPrimaryCurrency),
    [monthRowsBreakdown, vizPrimaryCurrency]
  )

  const monthCashflowPrimary = useMemo(() => {
    const cur = vizPrimaryCurrency
    let income = 0
    let expense = 0
    for (const r of monthRowsForViz) {
      if (r.currency.toUpperCase() !== cur) continue
      const a = Math.abs(Number(r.amount))
      if (!Number.isFinite(a)) continue
      if (r.type === "income" || r.type === "refund") income += a
      else if (r.type === "expense") expense += a
    }
    return { income, expense, net: income - expense }
  }, [monthRowsForViz, vizPrimaryCurrency])

  const hasMixedCurrencyInViewMonth = useMemo(() => {
    const s = new Set(monthRowsForViz.map((r) => r.currency.toUpperCase()))
    return s.size > 1
  }, [monthRowsForViz])

  const expenseDonutData = useMemo(
    () => categoryBreakdownToDonut(expenseSlicesForMonth),
    [expenseSlicesForMonth]
  )

  const incomeDonutData = useMemo(
    () => categoryBreakdownToDonut(incomeSlicesForMonth),
    [incomeSlicesForMonth]
  )

  function handleCategoryDonutClick(d: DonutDatum) {
    if (!d.filterKey) return
    router.replace(`/ledger/transactions?category=${encodeURIComponent(d.filterKey)}`, { scroll: false })
  }

  function mergeRowPatch(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setDetailRow((r) => (r && r.id === id ? { ...r, ...patch } : r))
  }

  function toggleRowSelection(id: string, checked: boolean) {
    setSelectedRowIds((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev
        return [...prev, id]
      }
      return prev.filter((x) => x !== id)
    })
  }

  function toggleSelectAllVisible(checked: boolean) {
    if (!checked) {
      const visibleIds = new Set(filteredRows.map((r) => r.id))
      setSelectedRowIds((prev) => prev.filter((id) => !visibleIds.has(id)))
      return
    }
    setSelectedRowIds((prev) => {
      const merged = new Set(prev)
      for (const r of filteredRows) merged.add(r.id)
      return [...merged]
    })
  }

  async function saveInlineCategory(row: Row) {
    if (inlineEditCategorySavingId) return
    const nextCategory = inlineEditCategoryValue.trim().toLowerCase()
    if (!nextCategory || nextCategory === row.category) {
      setInlineEditCategoryRowId(null)
      return
    }
    const prevCategory = row.category
    mergeRowPatch(row.id, { category: nextCategory })
    setInlineEditCategoryRowId(null)
    setInlineEditCategorySavingId(row.id)
    setError(null)
    try {
      const res = await fetch(`/api/ledger/transactions/${row.id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ledgerUserHeaders() },
        body: JSON.stringify({ category: nextCategory }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string; category?: string }
      if (!res.ok) {
        mergeRowPatch(row.id, { category: prevCategory })
        setError(typeof json.error === "string" ? json.error : "No se pudo guardar categoría")
        return
      }
      mergeRowPatch(row.id, { category: String(json.category ?? nextCategory) })
    } catch {
      mergeRowPatch(row.id, { category: prevCategory })
      setError("Red no disponible")
    } finally {
      setInlineEditCategorySavingId(null)
    }
  }

  async function dismissSelectedAsNonExpense() {
    if (selectedRowIds.length === 0 || bulkDismissing) return
    setBulkDismissing(true)
    setError(null)
    const targetIds = [...selectedRowIds]
    try {
      const outcomes = await Promise.all(
        targetIds.map(async (id) => {
          try {
            const res = await fetch(`/api/ledger/transactions/${id}/update`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...ledgerUserHeaders() },
              body: JSON.stringify({ dismissed: true }),
            })
            if (res.ok) return { id, ok: true as const }
            const j = (await res.json().catch(() => ({}))) as { error?: string }
            return { id, ok: false as const, error: typeof j.error === "string" ? j.error : "No se pudo ocultar" }
          } catch {
            return { id, ok: false as const, error: "Red no disponible" }
          }
        })
      )
      const successIds = outcomes.filter((o) => o.ok).map((o) => o.id)
      if (successIds.length > 0) {
        const removed = new Set(successIds)
        setRows((prev) => prev.filter((r) => !removed.has(r.id)))
        setSelectedRowIds((prev) => prev.filter((id) => !removed.has(id)))
        setDetailRow((prev) => (prev && removed.has(prev.id) ? null : prev))
      }
      const failed = outcomes.filter((o) => !o.ok)
      if (failed.length > 0) {
        setError(
          `Se ocultaron ${successIds.length} movimiento${successIds.length === 1 ? "" : "s"}, pero ${failed.length} fallaron.`
        )
      }
    } finally {
      setBulkDismissing(false)
    }
  }

  async function submitManualNewCategory() {
    const label = manualNewCatLabel.trim()
    if (!label) {
      setManualAddCatError("Escribí un nombre.")
      return
    }
    const kind = type === "income" || type === "refund" ? "income" : "expense"
    setManualAddCatLoading(true)
    setManualAddCatError(null)
    try {
      const res = await fetch("/api/ledger/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ledgerUserHeaders() },
        body: JSON.stringify({ label, kind }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        categories?: string[]
        incomeCategories?: string[]
        slug?: string
      }
      if (!res.ok) {
        setManualAddCatError(typeof json.error === "string" ? json.error : "No se pudo crear")
        return
      }
      if (Array.isArray(json.categories)) setCategories(json.categories)
      if (Array.isArray(json.incomeCategories)) setIncomeCategories(json.incomeCategories)
      if (json.slug) setCategory(String(json.slug))
      setManualNewCatLabel("")
      setManualCatPopoverOpen(false)
    } catch {
      setManualAddCatError("Red no disponible")
    } finally {
      setManualAddCatLoading(false)
    }
  }

  async function addManual(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const n = Number(amount.replace(",", "."))
    if (!Number.isFinite(n) || n <= 0) return
    setSaving(true)
    try {
      const res = await fetch("/api/ledger/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ledgerUserHeaders() },
        body: JSON.stringify({
          date,
          amount: n,
          currency,
          type,
          category,
          merchant: merchant || null,
          confidence: 1,
          source_vault_id:
            type === "income" || type === "refund"
              ? manualVaultId === LEDGER_VAULT_SELECT_NONE
                ? null
                : manualVaultId
              : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "No se pudo guardar")
        return
      }
      setAmount("")
      setMerchant("")
      setManualVaultId(LEDGER_VAULT_SELECT_NONE)
      setAddPopoverOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>
      )}

      {!loading && rows.length > 0 ? (
        <section className="rounded-xl border border-white/15 bg-white/[0.03] p-4 sm:p-5 space-y-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-widest text-white/40">Flujo y gastos del mes</p>
            <p className="text-sm font-medium text-white/90 capitalize">
              {format(viewMonth, "MMMM yyyy", { locale: es })}
            </p>
            <p className="text-[11px] text-white/45 max-w-prose">
              Ingresos y gastos en <span className="text-white/70">{vizPrimaryCurrency}</span>. Tocá un donut de gastos
              o de ingresos para filtrar la tabla por categoría.
              {tableWindowFilter ? (
                <>
                  {" "}
                  La tabla abajo sigue el filtro de ventana del resumen; este bloque siempre es el mes del selector.
                </>
              ) : null}
            </p>
            {hasMixedCurrencyInViewMonth ? (
              <p className="text-[11px] text-amber-200/85">
                Hay movimientos en varias monedas; el resumen numérico y el donut usan la moneda más frecuente del mes.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-6">
            <div className="min-w-0 flex-1 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase tracking-wide text-emerald-300/80">Ingresos + reembolsos</p>
                  <p className="text-lg font-semibold tabular-nums text-emerald-100/95">
                    {formatFiatAmount(monthCashflowPrimary.income, vizPrimaryCurrency)}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase tracking-wide text-rose-300/80">Gastos</p>
                  <p className="text-lg font-semibold tabular-nums text-rose-100/95">
                    {formatFiatAmount(monthCashflowPrimary.expense, vizPrimaryCurrency)}
                  </p>
                </div>
                <div className="space-y-0.5 sm:text-right">
                  <p className="text-[10px] uppercase tracking-wide text-white/45">Flujo neto</p>
                  <p
                    className={`text-lg font-semibold tabular-nums ${
                      monthCashflowPrimary.net >= 0 ? "text-sky-100/95" : "text-amber-100/95"
                    }`}
                  >
                    {formatFiatAmount(monthCashflowPrimary.net, vizPrimaryCurrency)}
                  </p>
                </div>
              </div>

              {expenseSlicesForMonth.length === 0 ? (
                <p className="text-sm text-white/45 py-4 text-center rounded-lg border border-white/10 bg-black/15">
                  Sin gastos clasificados en {vizPrimaryCurrency} este mes.
                </p>
              ) : (
                <ExpenseBreakdownDonut
                  data={expenseDonutData}
                  currency={vizPrimaryCurrency}
                  tint="rose"
                  selectedFilterKey={tableCategoryFilter}
                  onFilterClick={handleCategoryDonutClick}
                />
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-white/10 pt-6 lg:w-[min(100%,300px)] lg:shrink-0 lg:border-l lg:border-t-0 lg:pt-0 lg:pl-6">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-widest text-emerald-300/75">Ingresos por categoría</p>
                <p className="text-[10px] text-white/40 leading-snug">
                  Ingresos y reembolsos del mismo mes. Clic para filtrar la tabla.
                </p>
              </div>
              <ExpenseBreakdownDonut
                data={incomeDonutData}
                currency={vizPrimaryCurrency}
                tint="emerald"
                stackLegend
                selectedFilterKey={tableCategoryFilter}
                onFilterClick={handleCategoryDonutClick}
                emptyMessage={`Sin ingresos ni reembolsos en ${vizPrimaryCurrency} este mes.`}
              />
            </div>
          </div>
        </section>
      ) : null}

      <div>
        <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-semibold text-white/90">Movimientos</p>
            <p className="text-xs text-white/45 mt-1 max-w-prose">
              Tabla completa por mes. Abrí una fila para editar, clasificar con IA (Open Router, modelo gratuito) o
              ocultar correos basura. Las reglas opcionales ayudan en futuros syncs de Gmail.
            </p>
            {(tableCategoryFilter || tableWindowFilter || tableCurrencyFilter !== "all") ? (
              <div className="flex flex-wrap items-center gap-2">
                {tableWindowFilter ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/35 bg-violet-500/15 px-2.5 py-1 text-[11px] text-violet-100/95">
                    <span className="text-white/50">Ventana:</span>
                    <span className="font-medium">{ledgerChartWindowLabel(tableWindowFilter)}</span>
                  </span>
                ) : null}
                {tableCategoryFilter ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/35 bg-sky-500/15 px-2.5 py-1 text-[11px] text-sky-100/95">
                    <span className="text-white/50">Categoría:</span>
                    <span className="capitalize font-medium">{tableCategoryFilter.replace(/_/g, " ")}</span>
                  </span>
                ) : null}
                {tableCurrencyFilter !== "all" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1 text-[11px] text-emerald-100/95">
                    <span className="text-white/50">Moneda:</span>
                    <span className="font-medium">{tableCurrencyFilter}</span>
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px] text-white/55 hover:text-white hover:bg-white/10"
                  onClick={() => {
                    setTableCurrencyFilter("all")
                    router.replace("/ledger/transactions", { scroll: false })
                  }}
                >
                  Quitar filtros
                </Button>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Popover open={addPopoverOpen} onOpenChange={setAddPopoverOpen} modal={false}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10 gap-1.5"
                >
                  <Plus className="size-3.5 opacity-90" aria-hidden />
                  Nuevo movimiento
                  <ChevronDown className="size-3.5 opacity-50" aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={8}
                className="z-[120] w-[min(calc(100vw-1.5rem),22rem)] border-white/15 bg-neutral-950 p-4 text-white shadow-xl max-h-[min(85vh,520px)] overflow-y-auto"
              >
                <p className="text-sm font-semibold text-white/90 mb-3">Agregar manual</p>
                <form onSubmit={addManual} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-white/50">Monto</label>
                      <Input
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="bg-white/5 border-white/20 text-white"
                        placeholder="15000"
                        inputMode="decimal"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/50">Moneda</label>
                      <Input
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                        className="bg-white/5 border-white/20 text-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-white/50">Tipo</label>
                      <Select value={type} onValueChange={setType}>
                        <SelectTrigger className="h-9 w-full min-w-0 justify-between border-white/20 bg-white/5 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[210] border-white/15 bg-neutral-950 text-white shadow-xl">
                          <SelectItem value="income" className="text-white/90 focus:bg-white/10 focus:text-white">
                            Ingreso
                          </SelectItem>
                          <SelectItem value="expense" className="text-white/90 focus:bg-white/10 focus:text-white">
                            Gasto
                          </SelectItem>
                          <SelectItem value="transfer" className="text-white/90 focus:bg-white/10 focus:text-white">
                            Transferencia
                          </SelectItem>
                          <SelectItem value="refund" className="text-white/90 focus:bg-white/10 focus:text-white">
                            Reembolso
                          </SelectItem>
                          <SelectItem value="unknown" className="text-white/90 focus:bg-white/10 focus:text-white">
                            Desconocido
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-white/50">Fecha</label>
                      <Input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="bg-white/5 border-white/20 text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-white/50">Categoría</label>
                    <div className="flex gap-1.5 items-center">
                      <div className="min-w-0 flex-1">
                        <LedgerCategoryCombobox
                          value={category}
                          onValueChange={setCategory}
                          categories={manualCategoryList}
                          triggerClassName="bg-white/5 border-white/20 text-white"
                        />
                      </div>
                      <Popover
                        open={manualCatPopoverOpen}
                        onOpenChange={(nextOpen) => {
                          setManualCatPopoverOpen(nextOpen)
                          if (!nextOpen) {
                            setManualAddCatError(null)
                            setManualNewCatLabel("")
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="shrink-0 h-9 w-9 border-white/20 bg-white/5 text-white hover:bg-white/10"
                            aria-label="Agregar categoría"
                          >
                            <Plus className="size-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          align="end"
                          className="z-[210] w-72 border-white/15 bg-neutral-950 p-3 text-white shadow-xl"
                        >
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-white/85">Nueva categoría</p>
                            <Input
                              value={manualNewCatLabel}
                              onChange={(e) => setManualNewCatLabel(e.target.value)}
                              placeholder={
                                type === "income" || type === "refund"
                                  ? "Ej: sueldo, honorarios…"
                                  : "Ej: café, gimnasio…"
                              }
                              className="bg-white/5 border-white/20 text-white text-sm"
                              disabled={manualAddCatLoading}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  void submitManualNewCategory()
                                }
                              }}
                            />
                            <p className="text-[10px] text-white/45 leading-snug">
                              Se guarda como etiqueta en minúsculas y guiones bajos (ej:{" "}
                              <span className="font-mono text-white/55">honorarios</span>).
                            </p>
                            {manualAddCatError ? (
                              <p className="text-[11px] text-red-300/95">{manualAddCatError}</p>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              className="w-full bg-white text-black hover:bg-white/90"
                              disabled={manualAddCatLoading}
                              onClick={() => void submitManualNewCategory()}
                            >
                              {manualAddCatLoading ? "Guardando…" : "Agregar y seleccionar"}
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-white/50">Comercio (opcional)</label>
                    <Input
                      value={merchant}
                      onChange={(e) => setMerchant(e.target.value)}
                      className="bg-white/5 border-white/20 text-white"
                      placeholder="Mach, Jumbo, Netflix…"
                    />
                  </div>
                  {type === "income" || type === "refund" ? (
                    <div>
                      <label className="text-xs text-white/50">Procedencia vault (opcional)</label>
                      <p className="text-[10px] text-white/38 mb-1.5 leading-snug">
                        Si el dinero salió de un vault (ej. Binance), elegilo para ver el origen en la tabla.
                      </p>
                      <Select
                        value={manualVaultId}
                        onValueChange={setManualVaultId}
                        disabled={vaultsLoading || vaultOptions.length === 0}
                      >
                        <SelectTrigger className="h-9 w-full border-white/20 bg-white/5 text-white">
                          <SelectValue
                            placeholder={
                              vaultsLoading
                                ? "Cargando…"
                                : vaultOptions.length === 0
                                  ? "Creá vaults en la pestaña Vaults"
                                  : "Sin vault"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent className="z-[210] border-white/15 bg-neutral-950 text-white shadow-xl">
                          <SelectItem value={LEDGER_VAULT_SELECT_NONE} className="text-white/90 focus:bg-white/10">
                            Sin vault
                          </SelectItem>
                          {vaultOptions.map((v) => (
                            <SelectItem key={v.id} value={v.id} className="text-white/90 focus:bg-white/10">
                              {v.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  <Button type="submit" disabled={saving} className="w-full bg-white text-black hover:bg-white/90">
                    {saving ? "Guardando…" : "Guardar movimiento"}
                  </Button>
                </form>
              </PopoverContent>
            </Popover>
            <div className="relative w-[min(100%,16rem)]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-white/45" aria-hidden />
              <Input
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Buscar movimiento…"
                className="h-9 pl-8 pr-2 border-white/20 bg-white/5 text-white placeholder:text-white/35 text-sm"
                aria-label="Buscar en tabla de movimientos"
              />
            </div>
            <Select value={tableCurrencyFilter} onValueChange={setTableCurrencyFilter}>
              <SelectTrigger className="h-9 w-[9.5rem] border-white/20 bg-white/5 text-white">
                <SelectValue placeholder="Moneda" />
              </SelectTrigger>
              <SelectContent className="z-[210] border-white/15 bg-neutral-950 text-white shadow-xl">
                <SelectItem value="all" className="text-white/90 focus:bg-white/10 focus:text-white">
                  Todas
                </SelectItem>
                {tableCurrencies.map((cur) => (
                  <SelectItem key={cur} value={cur} className="text-white/90 focus:bg-white/10 focus:text-white">
                    {cur}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!loading && rows.length > 0 && !tableWindowFilter ? (
          <div className="mb-3 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10 shrink-0"
                aria-label="Mes anterior"
                onClick={() => setViewMonth((m) => subMonths(m, 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-[10rem] text-center text-sm font-medium capitalize text-white/90">
                {format(viewMonth, "MMMM yyyy", { locale: es })}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10 shrink-0"
                aria-label="Mes siguiente"
                onClick={() => setViewMonth((m) => addMonths(m, 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
              {!isSameMonth(viewMonth, new Date()) ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-white/60 hover:text-white hover:bg-white/10"
                  onClick={() => setViewMonth(startOfMonth(new Date()))}
                >
                  Este mes
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={gmailSyncLoading}
                className="h-8 gap-1.5 border-white/20 bg-white/5 px-2.5 text-[11px] font-medium text-white/75 hover:bg-white/10 hover:text-white shrink-0"
                title="Traer solo correos nuevos desde Gmail (no re-descarga todo el historial)"
                onClick={() => void handleGmailIncrementalSync()}
              >
                <RefreshCw className={`size-3.5 ${gmailSyncLoading ? "animate-spin" : ""}`} aria-hidden />
                Sync
              </Button>
            </div>
            {gmailSyncNote ? (
              <p className="text-[11px] text-white/50 max-w-xl">{gmailSyncNote}</p>
            ) : null}
            {monthsWithData.length > 0 ? (
              <div className="flex gap-1.5 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
                {monthsWithData.map((m) => {
                  const active = isSameMonth(m, viewMonth)
                  return (
                    <Button
                      key={m.toISOString()}
                      type="button"
                      variant={active ? "secondary" : "ghost"}
                      size="sm"
                      className={
                        active
                          ? "shrink-0 bg-white text-black hover:bg-white/90"
                          : "shrink-0 text-white/65 hover:bg-white/10 hover:text-white"
                      }
                      onClick={() => setViewMonth(m)}
                    >
                      {format(m, "MMM yyyy", { locale: es })}
                    </Button>
                  )
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {!loading && rows.length > 0 && tableWindowFilter ? (
          <p className="mb-3 text-xs text-white/45">
            Filtrando por ventana UTC desde el resumen ({ledgerChartWindowLabel(tableWindowFilter)}). El selector de mes
            no aplica hasta que quites ese filtro.
          </p>
        ) : null}

        {selectedRowIds.length > 0 ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <p className="text-xs text-amber-100/90">
              {selectedRowIds.length} seleccionado{selectedRowIds.length === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-amber-400/40 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25"
                disabled={bulkDismissing}
                onClick={() => void dismissSelectedAsNonExpense()}
              >
                {bulkDismissing ? "Ocultando…" : "No es gasto (ocultar seleccionados)"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-white/60 hover:text-white hover:bg-white/10"
                disabled={bulkDismissing}
                onClick={() => setSelectedRowIds([])}
              >
                Limpiar selección
              </Button>
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
          {loading ? (
            <div className="max-h-[min(70vh,520px)] overflow-hidden px-2 py-4 sm:px-3">
              <LedgerTransactionsTableSkeleton rows={10} />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-white/40 text-sm">Sin movimientos todavía.</div>
          ) : filteredRows.length === 0 ? (
            <div className="p-8 text-center text-white/40 text-sm">
              {tableWindowFilter ? (
                tableCategoryFilter ? (
                  <>
                    No hay movimientos «{tableCategoryFilter.replace(/_/g, " ")}» en{" "}
                    {ledgerChartWindowLabel(tableWindowFilter)}.{" "}
                    <button
                      type="button"
                      className="underline underline-offset-2 text-white/55 hover:text-white"
                      onClick={() => router.replace("/ledger/transactions", { scroll: false })}
                    >
                      Quitar filtros
                    </button>
                  </>
                ) : (
                  <>
                    No hay movimientos en {ledgerChartWindowLabel(tableWindowFilter)}.{" "}
                    <button
                      type="button"
                      className="underline underline-offset-2 text-white/55 hover:text-white"
                      onClick={() => router.replace("/ledger/transactions", { scroll: false })}
                    >
                      Quitar filtro de ventana
                    </button>
                  </>
                )
              ) : tableCurrencyFilter !== "all" ? (
                <>
                  No hay movimientos en moneda {tableCurrencyFilter} para{" "}
                  {format(viewMonth, "MMMM yyyy", { locale: es })}. Cambia la moneda o{" "}
                  <button
                    type="button"
                    className="underline underline-offset-2 text-white/55 hover:text-white"
                    onClick={() => setTableCurrencyFilter("all")}
                  >
                    quita el filtro
                  </button>
                  .
                </>
              ) : tableCategoryFilter ? (
                <>
                  No hay movimientos «{tableCategoryFilter.replace(/_/g, " ")}» en{" "}
                  {format(viewMonth, "MMMM yyyy", { locale: es })}. Cambia de mes o{" "}
                  <button
                    type="button"
                    className="underline underline-offset-2 text-white/55 hover:text-white"
                    onClick={() => router.replace("/ledger/transactions", { scroll: false })}
                  >
                    quita el filtro
                  </button>
                  .
                </>
              ) : (
                <>No hay movimientos en {format(viewMonth, "MMMM yyyy", { locale: es })}. Cambia de mes arriba.</>
              )}
            </div>
          ) : (
            <div className="max-h-[min(70vh,640px)] overflow-auto">
              <Table className="min-w-[min(100%,720px)] w-full table-auto">
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="sticky top-0 z-[2] w-10 bg-neutral-950/95 backdrop-blur-sm text-white/60">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={allVisibleSelected || (someVisibleSelected ? "indeterminate" : false)}
                          onCheckedChange={(v) => toggleSelectAllVisible(v === true)}
                          aria-label="Seleccionar todos los movimientos visibles"
                          className="border-white/30 data-[state=checked]:bg-white data-[state=checked]:text-black"
                        />
                      </div>
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] bg-neutral-950/95 backdrop-blur-sm text-white/60 whitespace-nowrap">
                      Fecha
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] bg-neutral-950/95 backdrop-blur-sm text-white/60 min-w-[min(60vw,22rem)] w-[40%] align-top font-medium">
                      Comercio / nombre
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] bg-neutral-950/95 backdrop-blur-sm text-white/60 text-right whitespace-nowrap">
                      Monto
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] bg-neutral-950/95 backdrop-blur-sm text-white/60 whitespace-nowrap">
                      Moneda
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] bg-neutral-950/95 backdrop-blur-sm text-white/60 whitespace-nowrap">
                      Tipo
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] bg-neutral-950/95 backdrop-blur-sm text-white/60 whitespace-nowrap">
                      Cat.
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] bg-neutral-950/95 backdrop-blur-sm text-white/60 whitespace-nowrap">
                      Origen
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] bg-neutral-950/95 backdrop-blur-sm text-white/60 whitespace-nowrap">
                      Canal
                    </TableHead>
                    <TableHead className="sticky top-0 z-[1] bg-neutral-950/95 backdrop-blur-sm text-white/60 text-right whitespace-nowrap">
                      Conf.
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((r) => (
                    <TableRow
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      className="border-white/10 cursor-pointer hover:bg-white/[0.06] focus-visible:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
                      onClick={() => setDetailRow(r)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          setDetailRow(r)
                        }
                      }}
                    >
                      <TableCell
                        className="align-top"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={selectedIdsSet.has(r.id)}
                            onCheckedChange={(v) => toggleRowSelection(r.id, v === true)}
                            aria-label={`Seleccionar movimiento ${r.id}`}
                            className="border-white/30 data-[state=checked]:bg-white data-[state=checked]:text-black"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-white/90 text-xs whitespace-nowrap align-top">
                        {formatLedgerTxTableMoment(r.date, r.source)}
                      </TableCell>
                      <TableCell className="text-white/80 text-xs whitespace-normal break-words align-top min-w-[min(60vw,22rem)] w-[40%]">
                        {r.merchant ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums whitespace-nowrap align-top">
                        {Number(r.amount).toLocaleString("es-CL")}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap align-top">{r.currency}</TableCell>
                      <TableCell className="text-xs capitalize whitespace-nowrap align-top">{r.type}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap align-top" onClick={(e) => e.stopPropagation()}>
                        <div className="relative h-6 w-[9.75rem]">
                          {inlineEditCategoryRowId === r.id ? (
                            <div className="absolute inset-0 flex items-center gap-1 animate-in fade-in-0 zoom-in-95 duration-150">
                              <Select value={inlineEditCategoryValue} onValueChange={setInlineEditCategoryValue}>
                                <SelectTrigger
                                  className="h-6 min-h-0 w-[8rem] border-white/20 bg-white/5 px-2 text-[11px] text-white"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent
                                  className="z-[230] max-h-64 border-white/15 bg-neutral-950 text-white shadow-xl"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {(r.type === "income" || r.type === "refund" ? incomeCategories : categories).map((c) => (
                                    <SelectItem key={c} value={c} className="text-white/90 focus:bg-white/10 focus:text-white">
                                      {c}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                size="icon"
                                className="h-6 w-6 shrink-0 bg-emerald-400 text-black hover:bg-emerald-300"
                                disabled={inlineEditCategorySavingId === r.id}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  void saveInlineCategory(r)
                                }}
                                aria-label="Guardar categoría"
                              >
                                <Check className="size-3" />
                              </Button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="h-6 w-full truncate rounded px-1 text-left text-xs text-white/90 hover:bg-white/10"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                const list = r.type === "income" || r.type === "refund" ? incomeCategories : categories
                                setInlineEditCategoryRowId(r.id)
                                setInlineEditCategoryValue(list.includes(r.category) ? r.category : "unknown")
                              }}
                            >
                              {r.category}
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs whitespace-normal align-top max-w-[8rem] break-words">
                        {r.institution_label ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap align-top text-white/55 capitalize">
                        {r.source}
                      </TableCell>
                      <TableCell className="text-right text-xs whitespace-nowrap align-top">
                        {(r.confidence * 100).toFixed(0)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <LedgerTransactionEditDialog
        open={detailRow !== null}
        onOpenChange={(open) => {
          if (!open) setDetailRow(null)
        }}
        row={detailRow}
        categories={categories}
        incomeCategories={incomeCategories}
        onCategoriesChange={setCategories}
        onIncomeCategoriesChange={setIncomeCategories}
        onSaved={(id, patch) => mergeRowPatch(id, patch as Partial<Row>)}
        onDismissed={(id) => {
          setRows((prev) => prev.filter((r) => r.id !== id))
          setDetailRow(null)
          void load()
        }}
      />
    </div>
  )
}
