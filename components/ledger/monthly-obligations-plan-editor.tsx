"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ledgerUserHeaders } from "@/lib/ledger/client-headers"
import { formatFiatAmount } from "@/lib/ledger/format-fiat"
import type { MonthlyObligationLine } from "@/lib/ledger/monthly-obligations-plan"

type Props = {
  currency: string
  lines: MonthlyObligationLine[]
  onSaved: () => void
}

const fetchInit = { headers: ledgerUserHeaders(), cache: "no-store" as RequestCache }

export function MonthlyObligationsPlanEditor({ currency, lines, onSaved }: Props) {
  const [draft, setDraft] = useState<MonthlyObligationLine[]>(lines)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(lines)
  }, [lines])

  const addRow = useCallback(() => {
    setDraft((prev) => [...prev, { id: crypto.randomUUID(), label: "", amount: 0 }])
  }, [])

  const removeRow = useCallback((id: string) => {
    setDraft((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const updateRow = useCallback((id: string, patch: Partial<MonthlyObligationLine>) => {
    setDraft((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }, [])

  const save = useCallback(async () => {
    const cleaned: MonthlyObligationLine[] = []
    for (const r of draft) {
      const label = r.label.trim()
      const amount = Number(r.amount)
      if (!label || !Number.isFinite(amount) || amount < 0) continue
      cleaned.push({ id: r.id, label, amount })
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/ledger/monthly-obligations", {
        ...fetchInit,
        method: "PUT",
        headers: { ...fetchInit.headers, "Content-Type": "application/json" },
        body: JSON.stringify({ lines: cleaned }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "No se pudo guardar")
        return
      }
      onSaved()
    } catch {
      setError("Red no disponible")
    } finally {
      setSaving(false)
    }
  }, [draft, onSaved])

  const planTotal = draft.reduce((s, r) => s + (Number.isFinite(r.amount) ? Math.max(0, r.amount) : 0), 0)

  return (
    <div className="space-y-3 rounded-xl border border-white/12 bg-white/[0.02] p-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-white/40">Plan mensual (obligaciones)</p>
        <p className="text-[11px] text-white/42 mt-1">
          Lo que esperás gastar por mes en <span className="text-white/60">{currency}</span> (alquiler fijo,
          suscripciones, etc.). Se compara con la quema <strong className="text-white/55">histórica</strong> del libro.
        </p>
      </div>

      <div className="space-y-2">
        {draft.length === 0 ? (
          <p className="text-[13px] text-white/38 py-2">Todavía no cargaste partidas. Usá «Añadir».</p>
        ) : (
          draft.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Ej. Alquiler"
                value={row.label}
                onChange={(e) => updateRow(row.id, { label: e.target.value })}
                className="min-w-[8rem] flex-1 border-white/15 bg-white/5 text-white placeholder:text-white/30"
              />
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder="0"
                value={row.amount}
                onChange={(e) => {
                  const raw = e.target.value
                  const v = raw === "" ? 0 : Number(raw)
                  updateRow(row.id, { amount: Number.isFinite(v) ? v : 0 })
                }}
                className="w-[8.5rem] border-white/15 bg-white/5 text-white tabular-nums placeholder:text-white/30"
              />
              <span className="text-[11px] text-white/35 shrink-0">{currency}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-white/45 hover:text-rose-300 hover:bg-white/10"
                aria-label="Quitar fila"
                onClick={() => removeRow(row.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-white/20 bg-white/5 text-white hover:bg-white/10 gap-1"
          onClick={addRow}
        >
          <Plus className="h-3.5 w-3.5" />
          Añadir
        </Button>
        <Button
          type="button"
          size="sm"
          className="bg-white text-black hover:bg-white/90"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Guardar plan
        </Button>
        <span className="text-[11px] text-white/45 ml-auto tabular-nums">
          Suma borrador: {formatFiatAmount(planTotal, currency)}
        </span>
      </div>

      {error ? <p className="text-[11px] text-rose-300/95">{error}</p> : null}
    </div>
  )
}
