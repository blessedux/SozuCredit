"use client"

import { memo, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { ledgerUserHeaders } from "@/lib/ledger/client-headers"
import { formatFiatAmount } from "@/lib/ledger/format-fiat"
import { formatLedgerTxTableMoment } from "@/lib/ledger/transaction-date"
import { cn } from "@/lib/utils"

type PreviewRow = {
  id: string
  date: string
  merchant: string | null
  amount: string | number
  currency: string
  type: string
  source: string
}

type Props = {
  enabled?: boolean
  className?: string
}

export const LedgerResumenPreview = memo(function LedgerResumenPreview({
  enabled = true,
  className,
}: Props) {
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "6", window: "month" })
      const res = await fetch(`/api/ledger/transactions?${params}`, {
        headers: ledgerUserHeaders(),
        cache: "no-store",
      })
      if (!res.ok) {
        setRows([])
        return
      }
      const json = await res.json()
      setRows(Array.isArray(json.transactions) ? json.transactions.slice(0, 6) : [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!enabled) return null

  return (
    <section
      className={cn(
        "rounded-xl border border-white/10 bg-black/20 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-md",
        className,
      )}
      aria-busy={loading}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
          Movimientos del libro
        </h2>
        <Link
          href="/ledger"
          className="inline-flex items-center gap-0.5 text-[10px] text-white/45 transition-colors hover:text-white/70"
        >
          Resumen
          <ChevronRight className="size-3" aria-hidden />
        </Link>
      </div>

      {loading ? (
        <ul className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-10 animate-pulse rounded-lg bg-white/5" />
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <p className="py-2 text-sm text-white/45">
          Sin movimientos del libro este mes. Conectá Gmail en Ajustes o agregá gastos en el libro.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const amountNum = Number(row.amount)
            const isIncome = row.type === "income"
            return (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white/85">
                    {row.merchant?.trim() || "Sin comercio"}
                  </p>
                  <p className="text-[10px] text-white/40">
                    {formatLedgerTxTableMoment(row.date, row.source)}
                    {row.source === "gmail" ? " · Gmail" : row.source === "manual" ? " · Manual" : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-sm font-semibold tabular-nums",
                    isIncome ? "text-emerald-400" : "text-white/80",
                  )}
                >
                  {isIncome ? "+" : "−"}
                  {formatFiatAmount(Math.abs(amountNum), row.currency)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
})
