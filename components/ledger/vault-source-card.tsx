"use client"

import { useEffect, useState } from "react"
import { CreditCard, PiggyBank, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatFiatAmount } from "@/lib/ledger/format-fiat"
import { cn } from "@/lib/utils"

export type VaultSourceRow = {
  id: string
  name: string
  balance_amount: number | string
  currency: string
  kind?: string | null
  source_goal_id?: string | null
  updated_at?: string
}

type Props = {
  vault: VaultSourceRow
  onPatch: (id: string, body: { balance_amount?: number; name?: string; currency?: string; kind?: "asset" | "liability" }) => void
  onDelete: (id: string) => void
}

export function VaultSourceCard({ vault, onPatch, onDelete }: Props) {
  const isLiability = vault.kind === "liability"
  const [name, setName] = useState(vault.name)
  const [currency, setCurrency] = useState(vault.currency)
  const [kind, setKind] = useState<"asset" | "liability">(isLiability ? "liability" : "asset")
  const [balanceStr, setBalanceStr] = useState(() => String(vault.balance_amount ?? ""))

  useEffect(() => {
    setName(vault.name)
    setCurrency(vault.currency)
    setKind(vault.kind === "liability" ? "liability" : "asset")
    setBalanceStr(String(vault.balance_amount ?? ""))
  }, [vault.id, vault.name, vault.currency, vault.balance_amount, vault.kind])

  const balNum = Number(String(balanceStr).replace(",", "."))
  const balanceDirty =
    Number.isFinite(balNum) && Math.abs(balNum - Number(vault.balance_amount)) > 1e-9
  const metaDirty =
    name.trim() !== vault.name.trim() ||
    currency.trim().toUpperCase() !== vault.currency.toUpperCase() ||
    kind !== (vault.kind === "liability" ? "liability" : "asset")

  const displayBalance = Number.isFinite(balNum) ? balNum : Number(vault.balance_amount)

  return (
    <article
      className={cn(
        "flex flex-col rounded-2xl border p-5 min-h-[200px] transition-colors",
        isLiability
          ? "border-rose-500/25 bg-gradient-to-b from-rose-500/[0.07] to-black/40"
          : "border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.06] to-black/40"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl border",
              isLiability ? "border-rose-500/30 bg-rose-500/10 text-rose-200" : "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
            )}
          >
            {isLiability ? <CreditCard className="size-4" aria-hidden /> : <PiggyBank className="size-4" aria-hidden />}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-white/40">
              {isLiability ? "Deuda" : "Ahorro"}
            </p>
            <h3 className="text-sm font-semibold text-white/95 truncate">{name.trim() || vault.name}</h3>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 h-8 w-8 text-white/35 hover:text-red-300 hover:bg-red-500/10"
          aria-label="Eliminar vault"
          onClick={() => {
            if (typeof window !== "undefined" && window.confirm(`¿Eliminar «${vault.name}»?`)) {
              onDelete(vault.id)
            }
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <p className="mt-4 text-3xl font-semibold tabular-nums tracking-tight text-white">
        {formatFiatAmount(displayBalance, currency.trim().toUpperCase() || "USD")}
      </p>
      <p className="text-[11px] text-white/40 mt-1">Saldo referencial · actualización manual</p>

      <div className="mt-5 space-y-3 pt-4 border-t border-white/10">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-white/45">Nombre</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 h-9 bg-white/5 border-white/20 text-white text-sm"
            />
          </div>
          <div>
            <Label className="text-[10px] text-white/45">Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as "asset" | "liability")}>
              <SelectTrigger className="mt-1 h-9 bg-white/5 border-white/20 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/15 bg-neutral-950 text-white z-[200]">
                <SelectItem value="asset">Ahorro / wallet</SelectItem>
                <SelectItem value="liability">Deuda (tarjeta, préstamo…)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] text-white/45">Moneda</Label>
            <Input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className="mt-1 h-9 bg-white/5 border-white/20 text-white text-sm"
            />
          </div>
          <div>
            <Label className="text-[10px] text-white/45">Saldo ({isLiability ? "adeudado" : "disponible"})</Label>
            <Input
              value={balanceStr}
              onChange={(e) => setBalanceStr(e.target.value)}
              className="mt-1 h-9 bg-white/5 border-white/20 text-white text-sm tabular-nums"
              inputMode="decimal"
            />
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="w-full sm:w-auto bg-white text-black hover:bg-white/90"
          disabled={!balanceDirty && !metaDirty}
          onClick={() => {
            const nextBal = Number(String(balanceStr).replace(",", "."))
            if (!Number.isFinite(nextBal)) return
            const patch: {
              balance_amount?: number
              name?: string
              currency?: string
              kind?: "asset" | "liability"
            } = {}
            if (balanceDirty) patch.balance_amount = nextBal
            if (name.trim() !== vault.name.trim()) patch.name = name.trim()
            if (currency.trim().toUpperCase() !== vault.currency.toUpperCase()) {
              patch.currency = currency.trim().toUpperCase()
            }
            if (kind !== (vault.kind === "liability" ? "liability" : "asset")) patch.kind = kind
            if (Object.keys(patch).length === 0) return
            onPatch(vault.id, patch)
          }}
        >
          Guardar cambios
        </Button>
      </div>
    </article>
  )
}
