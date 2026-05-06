"use client"

import { useEffect, useState } from "react"
import { ledgerUserHeaders } from "@/lib/ledger/client-headers"

/** Approximate multi-currency fiat totals in USDC via `/api/fx` (stable coins summed directly). */
export function useFxTotalsUsdc(totals: readonly { currency: string; total: number }[]) {
  const [aggUsdc, setAggUsdc] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [fxNote, setFxNote] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (totals.length === 0) {
      setAggUsdc(null)
      setFxNote(null)
      setBusy(false)
      return
    }

    let stable = 0
    const fxRows: { currency: string; total: number }[] = []
    for (const { currency, total } of totals) {
      const cur = currency.trim().toUpperCase()
      if (!Number.isFinite(total)) continue
      if (cur === "USDC" || cur === "USD" || cur === "USDT") stable += total
      else fxRows.push({ currency: cur, total })
    }

    if (fxRows.length === 0) {
      setBusy(false)
      setAggUsdc(stable)
      setFxNote(null)
      return
    }

    setBusy(true)
    setFxNote(null)
    if (stable > 0) setAggUsdc(stable)
    else setAggUsdc(null)

    ;(async () => {
      try {
        let fxSum = 0
        const missing: string[] = []
        for (const { currency: cur, total } of fxRows) {
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
          fxSum += total * rate
        }
        if (cancelled) return
        setAggUsdc(stable + fxSum)
        setFxNote(missing.length > 0 ? `No hay FX para: ${missing.join(", ")}.` : null)
      } catch {
        if (cancelled) return
        setAggUsdc(stable > 0 ? stable : null)
        setFxNote("No se pudo calcular FX.")
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [totals])

  return { aggUsdc, busy, fxNote }
}
