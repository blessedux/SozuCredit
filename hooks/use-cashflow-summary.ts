"use client"

import { useCallback, useEffect, useState } from "react"
import { ledgerUserHeaders } from "@/lib/ledger/client-headers"

export type LedgerBurnRunwaySnapshot = {
  burnRateMonthlyPrimary: number
  avgMonthlyGrossExpensePrimary: number
  avgMonthlyGrossIncomePrimary: number
  runwayMonths: number | null
  runwayResourcePrimary: number
  liquidPrimaryEquivalent: number
  plannedMonthlyBurnPrimary: number
}

export type LedgerSummarySnapshot = {
  primaryCurrency: string
  netCashflow: number
  incomeThisMonth: number
  expensesThisMonth: number
  burnRunway: LedgerBurnRunwaySnapshot | null
}

export type CreditAccessSnapshot = {
  eligible: boolean
  trustworthyVouchesCount: number
  totalTrustPoints: number
}

function parseBurnRunway(raw: unknown): LedgerBurnRunwaySnapshot | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const burnRateMonthlyPrimary = Number(o.burnRateMonthlyPrimary)
  const avgMonthlyGrossExpensePrimary = Number(o.avgMonthlyGrossExpensePrimary)
  const avgMonthlyGrossIncomePrimary = Number(o.avgMonthlyGrossIncomePrimary)
  const runwayResourcePrimary = Number(o.runwayResourcePrimary)
  const liquidPrimaryEquivalent = Number(o.liquidPrimaryEquivalent)
  const plannedMonthlyBurnPrimary = Number(o.plannedMonthlyBurnPrimary)
  const runwayRaw = o.runwayMonths
  const runwayMonths =
    runwayRaw === null || runwayRaw === undefined
      ? null
      : typeof runwayRaw === "number" && Number.isFinite(runwayRaw)
        ? runwayRaw
        : null

  if (!Number.isFinite(burnRateMonthlyPrimary) || !Number.isFinite(liquidPrimaryEquivalent)) return null
  if (!Number.isFinite(avgMonthlyGrossExpensePrimary)) return null

  return {
    burnRateMonthlyPrimary,
    avgMonthlyGrossExpensePrimary,
    avgMonthlyGrossIncomePrimary: Number.isFinite(avgMonthlyGrossIncomePrimary)
      ? avgMonthlyGrossIncomePrimary
      : 0,
    runwayMonths,
    runwayResourcePrimary: Number.isFinite(runwayResourcePrimary)
      ? runwayResourcePrimary
      : liquidPrimaryEquivalent,
    liquidPrimaryEquivalent,
    plannedMonthlyBurnPrimary: Number.isFinite(plannedMonthlyBurnPrimary)
      ? plannedMonthlyBurnPrimary
      : 0,
  }
}

export function useCashflowSummary(enabled = true) {
  const [summary, setSummary] = useState<LedgerSummarySnapshot | null>(null)
  const [credit, setCredit] = useState<CreditAccessSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = ledgerUserHeaders()
      const [summaryRes, creditRes] = await Promise.all([
        fetch("/api/ledger/summary", { headers, cache: "no-store" }),
        fetch("/api/wallet/credit-eligibility", { headers, cache: "no-store" }).catch(() => null),
      ])

      if (!summaryRes.ok) {
        const body = await summaryRes.json().catch(() => ({}))
        throw new Error(typeof body.error === "string" ? body.error : "No se pudo cargar cashflow")
      }

      const json = await summaryRes.json()
      const burnRunway = parseBurnRunway(json.burnRunway)
      setSummary({
        primaryCurrency: typeof json.primaryCurrency === "string" ? json.primaryCurrency : "CLP",
        netCashflow: Number(json.netCashflow) || 0,
        incomeThisMonth: Number(json.incomeThisMonth) || 0,
        expensesThisMonth: Number(json.expensesThisMonth) || 0,
        burnRunway,
      })

      if (creditRes?.ok) {
        const c = await creditRes.json()
        setCredit({
          eligible: Boolean(c.eligible),
          trustworthyVouchesCount: Number(c.trustworthyVouchesCount) || 0,
          totalTrustPoints: Number(c.totalTrustPoints) || 0,
        })
      } else {
        setCredit(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de cashflow")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    void refresh()
  }, [enabled, refresh])

  return { summary, credit, loading, error, refresh }
}
