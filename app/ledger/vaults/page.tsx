"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { LineChart, Pencil, Plus, Trash2, Wallet } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { VaultSourceCard, type VaultSourceRow } from "@/components/ledger/vault-source-card"
import { formatFiatAmount } from "@/lib/ledger/format-fiat"
import {
  mergeTotalsByCurrency,
  sumBalancesByCurrency,
  sumLiabilityBalancesByCurrency,
} from "@/lib/ledger/vault-grouping"
import {
  getPayDebtFullObjectiveAmount,
  getPayDebtNearTermFocusAmount,
  readGoalsStore,
  writeGoalsStore,
  type LedgerStoredGoal,
  type LedgerStoredMilestone,
} from "@/lib/ledger/goals-local-storage"
import { useFxTotalsUsdc } from "@/lib/ledger/use-fx-totals-usdc"
import { walletBalancesFetchInit, walletBalancesUrl } from "@/lib/ledger/wallet-balances-url"
import { ledgerUserHeaders } from "@/lib/ledger/client-headers"

function TotalsLines({ rows }: { rows: { currency: string; total: number }[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-white/40">—</p>
  }
  return (
    <ul className="space-y-1.5">
      {rows.map(({ currency, total }) => (
        <li key={currency} className="text-lg font-semibold tabular-nums text-white/95">
          {formatFiatAmount(total, currency)}
        </li>
      ))}
    </ul>
  )
}

function formatClpTicker(value: number): string {
  const n = Math.round(value)
  return `${n.toLocaleString("es-CL")} CLP`
}

type DebtBlock = {
  subtitle: string
  totals: { currency: string; total: number }[]
  aggUsdc: number | null
  busy: boolean
  fxNote: string | null
}

function DebtAggHeadline(props: {
  aggUsdc: number | null
  busy: boolean
  primary: "USDC" | "CLP"
  usdClpOracle: { clpToUsd: number } | null
}) {
  const { aggUsdc, busy, primary, usdClpOracle } = props
  return (
    <div className="space-y-0.5">
      <p className="text-2xl font-semibold tabular-nums text-rose-100/95">
        {primary === "USDC"
          ? busy && aggUsdc == null ? (
              <Skeleton className="inline-block h-8 w-44 rounded bg-rose-500/25 align-middle" />
            ) : aggUsdc != null ? (
              `~${aggUsdc.toFixed(2)} USDC`
            ) : (
              "—"
            )
          : usdClpOracle?.clpToUsd && aggUsdc != null
            ? formatClpTicker(aggUsdc / usdClpOracle.clpToUsd)
            : busy && aggUsdc == null ? (
                <Skeleton className="inline-block h-8 w-44 rounded bg-rose-500/25 align-middle" />
              ) : (
                "—"
              )}
      </p>
      <p className="text-[11px] tabular-nums text-white/45">
        {primary === "USDC"
          ? usdClpOracle?.clpToUsd && aggUsdc != null
            ? formatClpTicker(aggUsdc / usdClpOracle.clpToUsd)
            : ""
          : aggUsdc != null
            ? `~${aggUsdc.toFixed(2)} USDC`
            : ""}
      </p>
    </div>
  )
}

function CombinedDebtMetricCard(props: {
  loading: boolean
  primary: "USDC" | "CLP"
  onTogglePrimary: () => void
  usdClpOracle: { clpToUsd: number } | null
  full: DebtBlock
  near: DebtBlock
}) {
  const { loading, primary, onTogglePrimary, usdClpOracle, full, near } = props
  const emptyFull = !loading && full.totals.length === 0
  const emptyNear = !loading && near.totals.length === 0

  return (
    <div className="rounded-2xl border border-rose-500/25 bg-gradient-to-br from-rose-500/[0.08] to-black/50 p-5 min-h-[140px] flex flex-col">
      <p className="text-[10px] uppercase tracking-widest text-rose-200/75">Deuda total objetivo</p>
      <p className="text-[11px] text-white/40 mt-1 mb-2 leading-snug">{full.subtitle}</p>
      {loading && full.totals.length === 0 ? (
        <Skeleton className="h-8 w-40 rounded bg-rose-500/20 mt-2" />
      ) : emptyFull ? (
        <p className="text-sm text-white/40 mt-2">—</p>
      ) : (
        <button
          type="button"
          className="w-full text-left space-y-2 rounded-lg mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
          onClick={onTogglePrimary}
          aria-label="Cambiar moneda principal (deuda)"
        >
          <DebtAggHeadline aggUsdc={full.aggUsdc} busy={full.busy} primary={primary} usdClpOracle={usdClpOracle} />
          {full.fxNote ? <p className="text-[10px] text-white/35 leading-snug">{full.fxNote}</p> : null}
          <div className="pt-2 border-t border-white/10">
            <TotalsLines rows={full.totals} />
          </div>
        </button>
      )}

      <div className="mt-5 pt-5 border-t border-rose-500/20 flex-1 flex flex-col">
        <p className="text-[10px] uppercase tracking-widest text-amber-200/85">Deuda foco corto plazo</p>
        <p className="text-[11px] text-white/40 mt-1 mb-2 leading-snug">{near.subtitle}</p>
        {loading && near.totals.length === 0 ? (
          <Skeleton className="h-8 w-40 rounded bg-rose-500/20 mt-2" />
        ) : emptyNear ? (
          <p className="text-sm text-white/40 mt-2">—</p>
        ) : (
          <button
            type="button"
            className="w-full text-left space-y-2 rounded-lg mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
            onClick={onTogglePrimary}
            aria-label="Cambiar moneda principal (deuda corto plazo)"
          >
            <DebtAggHeadline aggUsdc={near.aggUsdc} busy={near.busy} primary={primary} usdClpOracle={usdClpOracle} />
            {near.fxNote ? <p className="text-[10px] text-white/35 leading-snug">{near.fxNote}</p> : null}
            <div className="pt-2 border-t border-white/10">
              <TotalsLines rows={near.totals} />
            </div>
          </button>
        )}
      </div>
    </div>
  )
}

/** DB `kind` can be null; goal-linked vaults always use `source_goal_id` (debt). */
function normalizeVaultKind(v: { kind?: string | null; source_goal_id?: string | null }): "asset" | "liability" {
  if (v.kind === "liability") return "liability"
  if (String(v.source_goal_id ?? "").trim()) return "liability"
  return "asset"
}

type DebtMilestoneFormRow = {
  id: string
  label: string
  due: string
  amount: string
  done: boolean
}

function toDateInputValue(iso: string | null | undefined): string {
  const t = iso?.trim()
  if (!t) return ""
  return t.length >= 10 ? t.slice(0, 10) : t
}

function newMilestoneFormRowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `m_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export default function LedgerVaultsPage() {
  const [loading, setLoading] = useState(true)
  const [walletUsdc, setWalletUsdc] = useState<number | null>(null)
  const [walletUsdcDetail, setWalletUsdcDetail] = useState<{
    trustline: number
    strategy: number
  } | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const [vaults, setVaults] = useState<VaultSourceRow[]>([])
  const [vaultsLoading, setVaultsLoading] = useState(true)
  const [vaultError, setVaultError] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [newCurrency, setNewCurrency] = useState("USDT")
  const [newKind, setNewKind] = useState<"asset" | "liability">("asset")
  const [newBalance, setNewBalance] = useState("")
  const [creating, setCreating] = useState(false)
  const [debtGoals, setDebtGoals] = useState<LedgerStoredGoal[]>(() =>
    readGoalsStore()
      .goals.filter((g) => g.goal_type === "pay_debt")
      .map((g) => ({ ...g, currency: g.currency.trim().toUpperCase() || "CLP" }))
  )
  const [createVaultOpen, setCreateVaultOpen] = useState(false)
  const [walletViewPrimary, setWalletViewPrimary] = useState<"USDC" | "CLP">("USDC")

  const [debtGoalEditOpen, setDebtGoalEditOpen] = useState(false)
  const [editGoalId, setEditGoalId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editTargetAmount, setEditTargetAmount] = useState("")
  const [editCurrency, setEditCurrency] = useState("CLP")
  const [editTargetDate, setEditTargetDate] = useState("")
  const [editMilestones, setEditMilestones] = useState<DebtMilestoneFormRow[]>([])
  const [editGoalError, setEditGoalError] = useState<string | null>(null)

  const assetVaults = useMemo(
    () => vaults.filter((v) => v.kind !== "liability"),
    [vaults]
  )
  const liabilityVaults = useMemo(
    () => vaults.filter((v) => v.kind === "liability"),
    [vaults]
  )
  const assetTotals = useMemo(() => sumBalancesByCurrency(assetVaults), [assetVaults])
  const [assetTotalUsdc, setAssetTotalUsdc] = useState<number | null>(null)
  const [assetFxNote, setAssetFxNote] = useState<string | null>(null)
  const [usdClpOracle, setUsdClpOracle] = useState<{ clpToUsd: number } | null>(null)
  const [assetPrimary, setAssetPrimary] = useState<"USDC" | "CLP">("USDC")
  const [debtPrimary, setDebtPrimary] = useState<"USDC" | "CLP">("USDC")
  const [pnlPrimary, setPnlPrimary] = useState<"USDC" | "CLP">("USDC")

  const debtGoalTotals = useMemo(() => {
    const rows: { balance_amount: number; currency: string }[] = []
    for (const g of debtGoals) {
      const amt = getPayDebtFullObjectiveAmount(g)
      if (amt == null || amt <= 0) continue
      rows.push({
        balance_amount: amt,
        currency: g.currency.trim().toUpperCase() || "CLP",
      })
    }
    return sumBalancesByCurrency(rows)
  }, [debtGoals])

  const debtGoalNearTotals = useMemo(() => {
    const rows: { balance_amount: number; currency: string }[] = []
    for (const g of debtGoals) {
      const amt = getPayDebtNearTermFocusAmount(g)
      if (amt == null || amt <= 0) continue
      rows.push({
        balance_amount: amt,
        currency: g.currency.trim().toUpperCase() || "CLP",
      })
    }
    return sumBalancesByCurrency(rows)
  }, [debtGoals])

  const liabilityNameSet = useMemo(() => {
    return new Set(
      liabilityVaults
        .map((v) => String(v.name ?? "").trim().toLowerCase())
        .filter(Boolean)
    )
  }, [liabilityVaults])

  const liabilityGoalIdSet = useMemo(() => {
    return new Set(
      liabilityVaults
        .map((v) => String(v.source_goal_id ?? "").trim())
        .filter(Boolean)
    )
  }, [liabilityVaults])

  /** Goals not yet represented by a vault: full objective vs next-milestone focus (same exclusions as list UI). */
  const goalsDebtTotalsFull = useMemo(() => {
    const rows: { balance_amount: number; currency: string }[] = []
    for (const g of debtGoals) {
      if (liabilityGoalIdSet.has(g.id)) continue
      if (liabilityNameSet.has(g.title.trim().toLowerCase())) continue
      const amt = getPayDebtFullObjectiveAmount(g)
      if (amt == null || amt <= 0) continue
      rows.push({
        balance_amount: amt,
        currency: g.currency.trim().toUpperCase() || "CLP",
      })
    }
    return sumLiabilityBalancesByCurrency(rows)
  }, [debtGoals, liabilityGoalIdSet, liabilityNameSet])

  const goalsDebtTotalsNear = useMemo(() => {
    const rows: { balance_amount: number; currency: string }[] = []
    for (const g of debtGoals) {
      if (liabilityGoalIdSet.has(g.id)) continue
      if (liabilityNameSet.has(g.title.trim().toLowerCase())) continue
      const amt = getPayDebtNearTermFocusAmount(g)
      if (amt == null || amt <= 0) continue
      rows.push({
        balance_amount: amt,
        currency: g.currency.trim().toUpperCase() || "CLP",
      })
    }
    return sumLiabilityBalancesByCurrency(rows)
  }, [debtGoals, liabilityGoalIdSet, liabilityNameSet])

  const liabilityTotalsFull = useMemo(() => {
    const vaultPart = sumLiabilityBalancesByCurrency(liabilityVaults)
    return mergeTotalsByCurrency([vaultPart, goalsDebtTotalsFull])
  }, [liabilityVaults, goalsDebtTotalsFull])

  const liabilityTotalsNear = useMemo(() => {
    const vaultPart = sumLiabilityBalancesByCurrency(liabilityVaults)
    return mergeTotalsByCurrency([vaultPart, goalsDebtTotalsNear])
  }, [liabilityVaults, goalsDebtTotalsNear])

  const {
    aggUsdc: debtFullAggUsdc,
    busy: debtFullBusy,
    fxNote: debtFullFxNote,
  } = useFxTotalsUsdc(liabilityTotalsFull)
  const {
    aggUsdc: debtNearAggUsdc,
    busy: debtNearBusy,
    fxNote: debtNearFxNote,
  } = useFxTotalsUsdc(liabilityTotalsNear)

  const pnlUsdc = useMemo(() => {
    if (assetTotalUsdc == null || debtFullAggUsdc == null) return null
    const w = walletUsdc ?? 0
    return assetTotalUsdc + w - debtFullAggUsdc
  }, [assetTotalUsdc, walletUsdc, debtFullAggUsdc])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const fxRes = await fetch(`/api/fx?from=CLP&to=USDC`, {
          cache: "no-store",
          headers: ledgerUserHeaders(),
        })
        if (!fxRes.ok) return
        const fxj = (await fxRes.json().catch(() => ({}))) as { rateToUsd?: number }
        const clpToUsd = Number(fxj.rateToUsd)
        if (!Number.isFinite(clpToUsd) || clpToUsd <= 0) return
        if (cancelled) return
        setUsdClpOracle({ clpToUsd })
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (assetTotals.length === 0) {
        setAssetTotalUsdc(null)
        setAssetFxNote(null)
        return
      }
      try {
        let sumUsdc = 0
        const missing: string[] = []
        for (const { currency, total } of assetTotals) {
          const cur = currency.trim().toUpperCase()
          if (!Number.isFinite(total)) continue
          if (cur === "USDC" || cur === "USD" || cur === "USDT") {
            sumUsdc += total
            continue
          }
          const fxRes = await fetch(`/api/fx?from=${encodeURIComponent(cur)}&to=USDC`, {
            cache: "no-store",
            headers: ledgerUserHeaders(),
          })
          if (!fxRes.ok) {
            missing.push(cur)
            continue
          }
          const fxj = (await fxRes.json().catch(() => ({}))) as { rateToUsd?: number }
          const rate = Number(fxj.rateToUsd)
          if (!Number.isFinite(rate)) {
            missing.push(cur)
            continue
          }
          sumUsdc += total * rate
        }
        if (cancelled) return
        setAssetTotalUsdc(sumUsdc)
        setAssetFxNote(missing.length > 0 ? `No hay FX para: ${missing.join(", ")}.` : null)
      } catch {
        if (cancelled) return
        setAssetTotalUsdc(null)
        setAssetFxNote("No se pudo calcular FX.")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [assetTotals])

  const loadVaults = useCallback(async () => {
    setVaultsLoading(true)
    setVaultError(null)
    try {
      const res = await fetch("/api/ledger/vaults", {
        headers: ledgerUserHeaders(),
        cache: "no-store",
      })
      const j = await res.json()
      if (!res.ok) {
        setVaultError(typeof j.error === "string" ? j.error : "No se pudieron cargar los vaults")
        setVaults([])
        return
      }
      const raw = Array.isArray(j.vaults) ? j.vaults : []
      setVaults(
        raw.map((v: VaultSourceRow) => ({
          ...v,
          kind: normalizeVaultKind(v),
        }))
      )
    } catch {
      setVaultError("Error de red")
      setVaults([])
    } finally {
      setVaultsLoading(false)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setNote(null)
    try {
      const balRes = await fetch(walletBalancesUrl(), { ...walletBalancesFetchInit(), cache: "no-store" })

      let usdc: number | null = null
      let detail: { trustline: number; strategy: number } | null = null
      if (balRes.ok) {
        const b = await balRes.json()
        const total =
          typeof b.displayTotalUsdc === "number" && Number.isFinite(b.displayTotalUsdc)
            ? b.displayTotalUsdc
            : null
        if (total !== null) usdc = total
        const s = b.usdcSummary as { trustline?: number; strategy?: number } | null
        if (s && (typeof s.trustline === "number" || typeof s.strategy === "number")) {
          detail = {
            trustline: Number(s.trustline) || 0,
            strategy: Number(s.strategy) || 0,
          }
        }
      } else if (balRes.status === 404) {
        setNote("Creá tu billetera Stellar en Wallet para ver USDC on-chain.")
      }
      setWalletUsdc(usdc)
      setWalletUsdcDetail(detail)
    } catch {
      setNote("Error de red")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    void loadVaults()
  }, [loadVaults])

  useEffect(() => {
    const refresh = () => {
      const next = readGoalsStore()
        .goals.filter((g) => g.goal_type === "pay_debt")
        .map((g) => ({ ...g, currency: g.currency.trim().toUpperCase() || "CLP" }))
      setDebtGoals(next)
    }
    refresh()
    if (typeof window === "undefined") return
    window.addEventListener("focus", refresh)
    window.addEventListener("storage", refresh)
    return () => {
      window.removeEventListener("focus", refresh)
      window.removeEventListener("storage", refresh)
    }
  }, [])

  const closeDebtGoalEditor = useCallback(() => {
    setDebtGoalEditOpen(false)
    setEditGoalId(null)
    setEditGoalError(null)
  }, [])

  const openDebtGoalEditor = useCallback((g: LedgerStoredGoal) => {
    setEditGoalError(null)
    setEditGoalId(g.id)
    setEditTitle(g.title)
    setEditTargetAmount(
      g.target_amount != null && Number.isFinite(g.target_amount) ? String(g.target_amount) : ""
    )
    setEditCurrency(g.currency.trim().toUpperCase() || "CLP")
    setEditTargetDate(toDateInputValue(g.target_date_iso))
    setEditMilestones(
      g.milestones.length > 0
        ? g.milestones.map((m) => ({
            id: m.id,
            label: m.label,
            due: toDateInputValue(m.due_date_iso),
            amount: m.amount != null && Number.isFinite(m.amount) ? String(m.amount) : "",
            done: m.done,
          }))
        : [{ id: newMilestoneFormRowId(), label: "", due: "", amount: "", done: false }]
    )
    setDebtGoalEditOpen(true)
  }, [])

  const saveDebtGoalEditor = useCallback(() => {
    if (!editGoalId) return
    const t = editTitle.trim()
    if (!t) {
      setEditGoalError("Agregá un título.")
      return
    }
    const store = readGoalsStore()
    const prev = store.goals.find((x) => x.id === editGoalId)
    if (!prev) {
      setEditGoalError("La meta ya no existe.")
      return
    }
    const amt = editTargetAmount.trim() ? Number(editTargetAmount.replace(",", ".")) : null
    const ms: LedgerStoredMilestone[] = editMilestones
      .map((row) => {
        const label = row.label.trim()
        if (!label) return null
        const a = row.amount.trim() ? Number(row.amount.replace(",", ".")) : null
        return {
          id: row.id,
          label,
          due_date_iso: row.due.trim() || null,
          amount: a != null && Number.isFinite(a) ? a : null,
          done: row.done,
        }
      })
      .filter(Boolean) as LedgerStoredMilestone[]

    const updated: LedgerStoredGoal = {
      ...prev,
      title: t,
      target_amount: amt != null && Number.isFinite(amt) ? amt : null,
      currency: editCurrency.trim().toUpperCase() || "CLP",
      target_date_iso: editTargetDate.trim() || null,
      milestones: ms,
    }
    writeGoalsStore({
      goals: store.goals.map((g) => (g.id === editGoalId ? updated : g)),
      income_projects: store.income_projects,
    })
    setDebtGoals(
      readGoalsStore()
        .goals.filter((g) => g.goal_type === "pay_debt")
        .map((g) => ({ ...g, currency: g.currency.trim().toUpperCase() || "CLP" }))
    )
    closeDebtGoalEditor()
  }, [
    editGoalId,
    editTitle,
    editTargetAmount,
    editCurrency,
    editTargetDate,
    editMilestones,
    closeDebtGoalEditor,
  ])

  async function createVault(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    const bal = newBalance.trim() === "" ? 0 : Number(newBalance.replace(",", "."))
    if (!Number.isFinite(bal)) return
    setCreating(true)
    setVaultError(null)
    try {
      const res = await fetch("/api/ledger/vaults", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ledgerUserHeaders() },
        body: JSON.stringify({
          name,
          currency: newCurrency.trim().toUpperCase() || "USDT",
          balance_amount: bal,
          kind: newKind,
        }),
      })
      const j = await res.json()
      if (!res.ok) {
        setVaultError(typeof j.error === "string" ? j.error : "No se pudo crear")
        return
      }
      setNewName("")
      setNewBalance("")
      setNewKind("asset")
      setCreateVaultOpen(false)
      await loadVaults()
    } catch {
      setVaultError("Error de red")
    } finally {
      setCreating(false)
    }
  }

  const stellarClientNetwork =
    process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? ("mainnet" as const) : ("testnet" as const)

  async function patchVault(
    id: string,
    body: { balance_amount?: number; name?: string; currency?: string; kind?: "asset" | "liability" }
  ) {
    setVaultError(null)
    try {
      const res = await fetch(`/api/ledger/vaults/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...ledgerUserHeaders() },
        body: JSON.stringify(body),
      })
      const j = await res.json()
      if (!res.ok) {
        setVaultError(typeof j.error === "string" ? j.error : "No se pudo guardar")
        return
      }
      setVaults((prev) =>
        prev.map((v) => {
          if (v.id !== id) return v
          const merged = { ...v, ...(j as VaultSourceRow) }
          return { ...merged, kind: normalizeVaultKind(merged) }
        })
      )
    } catch {
      setVaultError("Error de red")
    }
  }

  async function deleteVault(id: string) {
    setVaultError(null)
    try {
      const res = await fetch(`/api/ledger/vaults/${id}`, {
        method: "DELETE",
        headers: ledgerUserHeaders(),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setVaultError(typeof j.error === "string" ? j.error : "No se pudo eliminar")
        return
      }
      setVaults((prev) => prev.filter((v) => v.id !== id))
    } catch {
      setVaultError("Error de red")
    }
  }

  return (
    <div className="space-y-10">
      <header className="space-y-3 max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2 min-w-0">
            <p className="text-xs uppercase tracking-widest text-white/40">Liquidez y vaults</p>
            <h2 className="text-xl font-semibold text-white/95 sm:text-2xl">Vaults Sozu</h2>
          </div>
          <Button
            type="button"
            className="shrink-0 bg-white text-black hover:bg-white/90 gap-1.5"
            onClick={() => setCreateVaultOpen(true)}
          >
            <Plus className="size-4" aria-hidden />
            Crear nuevo vault
          </Button>
        </div>
        <p className="text-sm text-white/50 leading-relaxed">
          Los vaults son lugares donde asignás liquidez: rendimiento, ahorro conjunto, gastos compartidos o inversiones
          compartidas con otros usuarios (próximo: invitar por SozuTag). También podés llevar deudas y cuentas externas.
          En{" "}
          <Link href="/ledger/transactions" className="text-sky-300/90 underline underline-offset-2">
            Movimientos
          </Link>{" "}
          podés marcar procedencia de vault. El PNL usa ahorros en vault + wallet Stellar menos deuda total (FX a
          USDC).
        </p>
      </header>

      {note ? (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {note}
        </div>
      ) : null}

      {vaultError ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {vaultError}
        </div>
      ) : null}

      {/* Top metrics */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] to-black/50 p-5 min-h-[140px]">
          <p className="text-[10px] uppercase tracking-widest text-emerald-200/75">Total ahorros registrados</p>
          {vaultsLoading ? (
            <Skeleton className="h-8 w-40 rounded bg-emerald-500/20" />
          ) : assetTotals.length === 0 ? (
            <p className="text-sm text-white/40">—</p>
          ) : (
            <button
              type="button"
              className="w-full text-left space-y-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
              onClick={() => setAssetPrimary((p) => (p === "USDC" ? "CLP" : "USDC"))}
              aria-label="Cambiar moneda principal"
            >
              <div className="space-y-0.5">
                <p className="text-2xl font-semibold tabular-nums text-white/95">
                  {assetPrimary === "USDC"
                    ? assetTotalUsdc != null
                      ? `~${assetTotalUsdc.toFixed(2)} USDC`
                      : "—"
                    : usdClpOracle?.clpToUsd && assetTotalUsdc != null
                      ? formatClpTicker(assetTotalUsdc / usdClpOracle.clpToUsd)
                      : "—"}
                </p>
                <p className="text-[11px] tabular-nums text-white/45">
                  {assetPrimary === "USDC"
                    ? usdClpOracle?.clpToUsd && assetTotalUsdc != null
                      ? formatClpTicker(assetTotalUsdc / usdClpOracle.clpToUsd)
                      : ""
                    : assetTotalUsdc != null
                      ? `~${assetTotalUsdc.toFixed(2)} USDC`
                      : ""}
                </p>
              </div>
              {assetFxNote ? <p className="text-[10px] text-white/35 leading-snug">{assetFxNote}</p> : null}
              <div className="pt-2 border-t border-white/10">
                <TotalsLines rows={assetTotals} />
              </div>
            </button>
          )}
        </div>
        <CombinedDebtMetricCard
          loading={vaultsLoading}
          primary={debtPrimary}
          onTogglePrimary={() => setDebtPrimary((p) => (p === "USDC" ? "CLP" : "USDC"))}
          usdClpOracle={usdClpOracle}
          full={{
            subtitle: "Vaults + metas locales según target completo (o suma de hitos si no hay target).",
            totals: liabilityTotalsFull,
            aggUsdc: debtFullAggUsdc,
            busy: debtFullBusy,
            fxNote: debtFullFxNote,
          }}
          near={{
            subtitle:
              "Vaults + por meta: solo el próximo hito pendiente (por fecha); si no hay hitos, el target.",
            totals: liabilityTotalsNear,
            aggUsdc: debtNearAggUsdc,
            busy: debtNearBusy,
            fxNote: debtNearFxNote,
          }}
        />
        <div className="rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-500/[0.1] to-black/50 p-5 min-h-[140px] flex flex-col">
          <div className="flex items-center gap-2 text-sky-200/90">
            <LineChart className="size-4 shrink-0" aria-hidden />
            <p className="text-[10px] uppercase tracking-widest">PNL (patrimonio neto)</p>
          </div>
          <p className="text-[11px] text-white/40 mt-1 leading-snug">
            Ahorros en vaults (FX a USDC) + saldo USDC Stellar/DeFindex − deuda total objetivo (misma base que arriba).
            Estimación; no incluye activos fuera de vaults.
          </p>
          {pnlUsdc == null ? (
            <p className="text-sm text-white/45 mt-4 flex-1">
              {vaultsLoading || debtFullBusy ? "Calculando…" : "Falta FX o datos de deuda/ahorros."}
            </p>
          ) : (
            <button
              type="button"
              className="w-full text-left space-y-2 rounded-lg mt-4 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
              onClick={() => setPnlPrimary((p) => (p === "USDC" ? "CLP" : "USDC"))}
              aria-label="Cambiar moneda principal PNL"
            >
              <div className="space-y-0.5">
                <p
                  className={`text-2xl font-semibold tabular-nums ${
                    pnlUsdc >= 0 ? "text-emerald-200/95" : "text-rose-200/95"
                  }`}
                >
                  {pnlPrimary === "USDC"
                    ? `~${pnlUsdc.toFixed(2)} USDC`
                    : usdClpOracle?.clpToUsd
                      ? formatClpTicker(pnlUsdc / usdClpOracle.clpToUsd)
                      : "—"}
                </p>
                <p className="text-[11px] tabular-nums text-white/45">
                  {pnlPrimary === "USDC"
                    ? usdClpOracle?.clpToUsd
                      ? formatClpTicker(pnlUsdc / usdClpOracle.clpToUsd)
                      : ""
                    : `~${pnlUsdc.toFixed(2)} USDC`}
                </p>
              </div>
            </button>
          )}
          <div className="mt-auto pt-4 border-t border-white/10">
            <Button
              variant="outline"
              size="sm"
              className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10"
              asChild
            >
              <Link href="/ledger">Ver resumen del libro</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Debt plans from Goals (local) */}
      <section className="rounded-2xl border border-white/12 bg-white/[0.03] p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-widest text-white/40">Deuda desde Metas</p>
            <p className="text-[11px] text-white/45 max-w-prose">
              Tus metas “Pagar deuda” viven en tu navegador (local). Tocá una meta para editar título, montos, fechas e
              hitos.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-white/20 bg-white/5 text-white hover:bg-white/10"
            asChild
          >
            <Link href="/ledger/goals">Abrir metas</Link>
          </Button>
        </div>

        {debtGoals.length === 0 ? (
          <p className="text-sm text-white/45 rounded-xl border border-white/10 bg-black/20 px-4 py-6 text-center">
            No hay metas de deuda todavía. Creá una en Metas (tipo “Pagar deuda”).
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-4">
                <p className="text-[10px] uppercase tracking-widest text-rose-200/75">Objetivo total (metas)</p>
                <p className="text-[11px] text-white/40 mt-1 mb-3">
                  Target declarado; si falta, suma de todos los hitos con monto.
                </p>
                <TotalsLines rows={debtGoalTotals} />
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
                <p className="text-[10px] uppercase tracking-widest text-amber-200/85">Próximo hito (metas)</p>
                <p className="text-[11px] text-white/40 mt-1 mb-3">
                  Por meta: el hito pendiente más próximo (fecha); si no hay hitos, el target.
                </p>
                <TotalsLines rows={debtGoalNearTotals} />
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-[10px] uppercase tracking-widest text-white/45">Vaults compartidos</p>
                <p className="text-[11px] text-white/40 mt-1">
                  Pronto vas a poder invitar por SozuTag y usar un mismo vault para ahorro o gasto conjunto. Creá
                  vaults nuevos con el botón arriba.
                </p>
              </div>
            </div>

            <ul className="space-y-3">
              {debtGoals.map((g) => {
                const fullAmt = getPayDebtFullObjectiveAmount(g)
                const nextAmt = getPayDebtNearTermFocusAmount(g)
                const already =
                  liabilityGoalIdSet.has(g.id) || liabilityNameSet.has(g.title.trim().toLowerCase())
                return (
                  <li key={g.id} className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
                    <button
                      type="button"
                      className="w-full text-left p-4 rounded-xl transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
                      onClick={() => openDebtGoalEditor(g)}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-white/90 truncate">{g.title || "Deuda"}</p>
                            {already ? (
                              <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-300/90 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5">
                                En vaults
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[11px] text-white/45 mt-1 space-y-0.5">
                            {fullAmt != null ? (
                              <span className="block">
                                Objetivo total:{" "}
                                <span className="tabular-nums text-white/80">{formatFiatAmount(fullAmt, g.currency)}</span>
                              </span>
                            ) : (
                              <span className="text-white/40">Sin objetivo total definido</span>
                            )}
                            {nextAmt != null ? (
                              <span className="block text-white/35">
                                Próximo hito / foco:{" "}
                                <span className="tabular-nums text-white/65">{formatFiatAmount(nextAmt, g.currency)}</span>
                              </span>
                            ) : null}
                            {g.target_date_iso ? (
                              <span className="block text-white/35">Objetivo calendario: {g.target_date_iso}</span>
                            ) : null}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 shrink-0 text-[11px] font-medium text-sky-300/90">
                          <Pencil className="size-3.5" aria-hidden />
                          Editar
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>

      {/* Vault grids */}
      {vaultsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-56 rounded-2xl bg-white/10" />
          <Skeleton className="h-56 rounded-2xl bg-white/10" />
          <Skeleton className="h-56 rounded-2xl bg-white/10" />
        </div>
      ) : (
        <>
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <h3 className="text-sm font-semibold text-white/90">Ahorros y wallets</h3>
              <span className="text-[11px] text-white/40">{assetVaults.length} fuente{assetVaults.length === 1 ? "" : "s"}</span>
            </div>
            {assetVaults.length === 0 ? (
              <p className="text-sm text-white/45 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-8 text-center">
                No hay vaults de ahorro todavía. Usá «Crear nuevo vault» arriba (ej. pool compartido, cuenta externa).
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {assetVaults.map((v) => (
                  <VaultSourceCard key={v.id} vault={v} onPatch={patchVault} onDelete={deleteVault} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <h3 className="text-sm font-semibold text-white/90">Deuda</h3>
              <span className="text-[11px] text-white/40">{liabilityVaults.length} cuenta{liabilityVaults.length === 1 ? "" : "s"}</span>
            </div>
            {liabilityVaults.length === 0 ? (
              <p className="text-sm text-white/45 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-8 text-center">
                Podés agregar tarjetas, préstamos o líneas como vaults de tipo «Deuda».
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {liabilityVaults.map((v) => (
                  <VaultSourceCard key={v.id} vault={v} onPatch={patchVault} onDelete={deleteVault} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Wallet Sozu — saldo USDC Stellar (reemplaza bloque de referencias) */}
      <section className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/[0.1] to-black/50 p-5 sm:p-6 max-w-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Wallet className="size-5 text-cyan-300/90 shrink-0" aria-hidden />
            <p className="text-[10px] uppercase tracking-widest text-cyan-200/85 truncate">
              Wallet Sozu · USDC on-chain
            </p>
          </div>
          <span
            className={
              stellarClientNetwork === "mainnet"
                ? "text-[10px] font-semibold uppercase tracking-widest rounded-full px-2.5 py-1 border border-emerald-400/40 text-emerald-100/95 bg-emerald-500/15 shrink-0"
                : "text-[10px] font-semibold uppercase tracking-widest rounded-full px-2.5 py-1 border border-amber-400/40 text-amber-100/95 bg-amber-500/15 shrink-0"
            }
          >
            {stellarClientNetwork === "mainnet" ? "Mainnet" : "Testnet"}
          </span>
        </div>
        <p className="text-[11px] text-white/42 mb-4 leading-relaxed">
          USDC en tu cuenta Sozu (Stellar + DeFindex cuando aplica). Tocá el monto para alternar vista en CLP
          (referencia FX, mismo criterio que las tarjetas de arriba).
        </p>
        {loading ? (
          <Skeleton className="h-12 w-52 rounded bg-white/10" />
        ) : (
          <button
            type="button"
            onClick={() => setWalletViewPrimary((p) => (p === "USDC" ? "CLP" : "USDC"))}
            className="w-full max-w-md text-left space-y-2 rounded-xl border border-white/12 bg-black/30 p-4 transition-colors hover:bg-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/35"
            aria-label="Alternar vista USDC o CLP"
          >
            <div className="space-y-0.5">
              <p className="text-2xl font-bold tabular-nums text-white/95">
                {walletViewPrimary === "USDC"
                  ? walletUsdc !== null
                    ? `${walletUsdc.toFixed(2)} USDC`
                    : "—"
                  : usdClpOracle?.clpToUsd && walletUsdc != null
                    ? formatClpTicker(walletUsdc / usdClpOracle.clpToUsd)
                    : "—"}
              </p>
              <p className="text-[11px] tabular-nums text-white/45">
                {walletViewPrimary === "USDC"
                  ? usdClpOracle?.clpToUsd && walletUsdc != null
                    ? formatClpTicker(walletUsdc / usdClpOracle.clpToUsd)
                    : walletUsdc == null
                      ? ""
                      : "Tocá para ver CLP"
                  : walletUsdc != null
                    ? `${walletUsdc.toFixed(2)} USDC`
                    : ""}
              </p>
            </div>
            {walletUsdcDetail && (walletUsdcDetail.trustline > 0 || walletUsdcDetail.strategy > 0) ? (
              <p className="text-[11px] text-white/45 pt-2 border-t border-white/10">
                Cuenta Stellar: {walletUsdcDetail.trustline.toFixed(2)} · DeFindex:{" "}
                {walletUsdcDetail.strategy.toFixed(2)}
              </p>
            ) : (
              <p className="text-[11px] text-white/38 pt-2 border-t border-white/10">
                Mismo saldo que en la pantalla Wallet cuando hay sesión.
              </p>
            )}
          </button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="mt-4 border-white/20 bg-white/5 text-white hover:bg-white/10"
          asChild
        >
          <Link href="/wallet">Abrir Wallet Sozu</Link>
        </Button>
      </section>

      <Dialog open={createVaultOpen} onOpenChange={setCreateVaultOpen}>
        <DialogContent className="border-white/15 bg-neutral-950 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Crear nuevo vault</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-white/50 leading-relaxed">
            Asigná liquidez a un bucket con nombre propio: ahorro, deuda, pool compartido o estrategia. Pronto vas a
            poder vincular SozuTag para compartir vaults con otros usuarios.
          </p>
          <form
            onSubmit={(e) => {
              void createVault(e)
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs text-white/50">Nombre</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Pool viaje · Tarjeta CMR · Yield Binance…"
                  className="mt-1 bg-white/5 border-white/20 text-white"
                />
              </div>
              <div>
                <Label className="text-xs text-white/50">Tipo</Label>
                <Select value={newKind} onValueChange={(v) => setNewKind(v as "asset" | "liability")}>
                  <SelectTrigger className="mt-1 bg-white/5 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/15 bg-neutral-950 text-white z-[200]">
                    <SelectItem value="asset">Liquidez / ahorro</SelectItem>
                    <SelectItem value="liability">Deuda</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-white/50">Moneda</Label>
                <Input
                  value={newCurrency}
                  onChange={(e) => setNewCurrency(e.target.value.toUpperCase())}
                  className="mt-1 bg-white/5 border-white/20 text-white"
                  placeholder="USDT"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs text-white/50">Saldo inicial (referencial)</Label>
                <Input
                  value={newBalance}
                  onChange={(e) => setNewBalance(e.target.value)}
                  className="mt-1 bg-white/5 border-white/20 text-white"
                  placeholder="0"
                  inputMode="decimal"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className="border-white/20 bg-transparent text-white hover:bg-white/10"
                onClick={() => setCreateVaultOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={creating || !newName.trim()}
                className="bg-white text-black hover:bg-white/90"
              >
                {creating ? "Creando…" : "Crear vault"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={debtGoalEditOpen}
        onOpenChange={(open) => {
          if (!open) closeDebtGoalEditor()
        }}
      >
        <DialogContent className="border-white/15 bg-neutral-950 text-white sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Editar meta de deuda</DialogTitle>
          </DialogHeader>
          <p className="text-[12px] text-white/45 leading-relaxed">
            Los cambios se guardan en este dispositivo (localStorage), igual que en Metas.
          </p>
          {editGoalError ? (
            <p className="text-sm text-amber-200/90 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              {editGoalError}
            </p>
          ) : null}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs text-white/50">Nombre de la meta</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="bg-white/5 border-white/20 text-white"
                placeholder="Ej.: Tarjeta CMR"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs text-white/50">Monto objetivo</Label>
                <Input
                  value={editTargetAmount}
                  onChange={(e) => setEditTargetAmount(e.target.value)}
                  inputMode="decimal"
                  className="bg-white/5 border-white/20 text-white"
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-white/50">Moneda</Label>
                <Input
                  value={editCurrency}
                  onChange={(e) => setEditCurrency(e.target.value.toUpperCase())}
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs text-white/50">Fecha objetivo</Label>
                <Input
                  type="date"
                  value={editTargetDate}
                  onChange={(e) => setEditTargetDate(e.target.value)}
                  className="bg-white/5 border-white/20 text-white scheme-dark max-w-xs"
                />
              </div>
            </div>
            <div className="space-y-2 pt-1 border-t border-white/10">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-white/50">Hitos</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-white/60 hover:text-white hover:bg-white/10"
                  onClick={() =>
                    setEditMilestones((rows) => [
                      ...rows,
                      { id: newMilestoneFormRowId(), label: "", due: "", amount: "", done: false },
                    ])
                  }
                >
                  <Plus className="h-4 w-4 mr-1" aria-hidden />
                  Agregar hito
                </Button>
              </div>
              <div className="space-y-2">
                {editMilestones.map((row, idx) => (
                  <div
                    key={row.id}
                    className="grid gap-2 sm:grid-cols-12 items-end border border-white/10 rounded-lg p-2 bg-black/30"
                  >
                    <div className="sm:col-span-4 space-y-1">
                      <span className="text-[10px] uppercase text-white/40">Nombre</span>
                      <Input
                        value={row.label}
                        onChange={(e) =>
                          setEditMilestones((rows) =>
                            rows.map((x, j) => (j === idx ? { ...x, label: e.target.value } : x))
                          )
                        }
                        className="h-9 bg-white/5 border-white/20 text-white text-sm"
                      />
                    </div>
                    <div className="sm:col-span-3 space-y-1">
                      <span className="text-[10px] uppercase text-white/40">Fecha</span>
                      <Input
                        type="date"
                        value={row.due}
                        onChange={(e) =>
                          setEditMilestones((rows) =>
                            rows.map((x, j) => (j === idx ? { ...x, due: e.target.value } : x))
                          )
                        }
                        className="h-9 bg-white/5 border-white/20 text-white scheme-dark text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <span className="text-[10px] uppercase text-white/40">Monto</span>
                      <Input
                        value={row.amount}
                        onChange={(e) =>
                          setEditMilestones((rows) =>
                            rows.map((x, j) => (j === idx ? { ...x, amount: e.target.value } : x))
                          )
                        }
                        inputMode="decimal"
                        className="h-9 bg-white/5 border-white/20 text-white text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2 flex items-center gap-2 pb-1">
                      <Checkbox
                        id={`m-done-${row.id}`}
                        checked={row.done}
                        onCheckedChange={(v) =>
                          setEditMilestones((rows) =>
                            rows.map((x, j) => (j === idx ? { ...x, done: v === true } : x))
                          )
                        }
                        className="border-white/30 data-[state=checked]:bg-white data-[state=checked]:text-black"
                      />
                      <Label htmlFor={`m-done-${row.id}`} className="text-[11px] text-white/50 cursor-pointer">
                        Hecho
                      </Label>
                    </div>
                    <div className="sm:col-span-1 flex justify-end pb-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-white/40 hover:text-rose-300"
                        aria-label="Quitar hito"
                        disabled={editMilestones.length <= 1}
                        onClick={() => setEditMilestones((rows) => rows.filter((_, j) => j !== idx))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="border-white/20 bg-transparent text-white hover:bg-white/10"
              onClick={() => closeDebtGoalEditor()}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-white text-black hover:bg-white/90"
              onClick={() => saveDebtGoalEditor()}
            >
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
