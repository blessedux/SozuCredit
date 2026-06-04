"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ledgerUserHeaders } from "@/lib/ledger/client-headers"
import { formatFiatAmount } from "@/lib/ledger/format-fiat"
import type { Transaction } from "@/hooks/use-wallet-data"

export type WalletActivityKind = "chain" | "gmail" | "manual"

export type WalletActivityItem = {
  id: string
  sortAt: number
  kind: WalletActivityKind
  direction: "in" | "out"
  amountLabel: string
  subtitle: string
  chainTx?: Transaction
}

type LedgerRow = {
  id: string
  date: string
  merchant: string | null
  amount: string | number
  currency: string
  type: string
  source: string
}

function ledgerKind(source: string): WalletActivityKind {
  if (source === "gmail") return "gmail"
  return "manual"
}

function chainItemsFromTransactions(
  transactions: Transaction[],
  walletAddress: string,
  currencyDisplay: string,
  addressToTagMap: Record<string, string>,
): WalletActivityItem[] {
  const wallet = walletAddress.trim().toUpperCase()
  const out: WalletActivityItem[] = []

  for (const tx of transactions) {
    const paymentOp = tx.operations.find((op) => op.type === "payment")
    if (!paymentOp) continue

    const from = paymentOp.from.trim().toUpperCase()
    const to = paymentOp.to.trim().toUpperCase()
    const isReceived = to === wallet
    const isSent = from === wallet
    if (!isReceived && !isSent) continue

    const other = isSent ? to : from
    const tag = addressToTagMap[other] ?? addressToTagMap[paymentOp.from] ?? addressToTagMap[paymentOp.to]
    const counterparty = tag ? `$${tag.replace(/^\$+/, "")}` : `${other.slice(0, 6)}…${other.slice(-4)}`

    const sortAt = Date.parse(tx.createdAt)
    out.push({
      id: `chain:${tx.id}`,
      sortAt: Number.isFinite(sortAt) ? sortAt : 0,
      kind: "chain",
      direction: isReceived ? "in" : "out",
      amountLabel: `${isReceived ? "+" : "−"}${paymentOp.amount.toFixed(2)} ${currencyDisplay}`,
      subtitle: isSent ? `To ${counterparty}` : `From ${counterparty}`,
      chainTx: tx,
    })
  }

  return out
}

function ledgerItemsFromRows(rows: LedgerRow[]): WalletActivityItem[] {
  return rows.map((row) => {
    const amountNum = Number(row.amount)
    const isIncome = row.type === "income"
    const sortAt = Date.parse(row.date)
    const merchant = row.merchant?.trim() || "Sin comercio"
    return {
      id: `ledger:${row.id}`,
      sortAt: Number.isFinite(sortAt) ? sortAt : 0,
      kind: ledgerKind(row.source),
      direction: isIncome ? "in" : "out",
      amountLabel: `${isIncome ? "+" : "−"}${formatFiatAmount(Math.abs(amountNum), row.currency)}`,
      subtitle: merchant,
    }
  })
}

export function useWalletActivity(params: {
  enabled: boolean
  walletAddress: string
  currencyDisplay: string
  chainTransactions: Transaction[]
  addressToTagMap: Record<string, string>
  onRefreshChain?: () => void
}) {
  const {
    enabled,
    walletAddress,
    currencyDisplay,
    chainTransactions,
    addressToTagMap,
    onRefreshChain,
  } = params
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(false)

  const refreshLedger = useCallback(async () => {
    if (!enabled) return
    setLedgerLoading(true)
    try {
      const qs = new URLSearchParams({ limit: "40", window: "month" })
      const res = await fetch(`/api/ledger/transactions?${qs}`, {
        headers: ledgerUserHeaders(),
        cache: "no-store",
      })
      if (!res.ok) {
        setLedgerRows([])
        return
      }
      const json = await res.json()
      setLedgerRows(Array.isArray(json.transactions) ? json.transactions : [])
    } catch {
      setLedgerRows([])
    } finally {
      setLedgerLoading(false)
    }
  }, [enabled])

  const refresh = useCallback(() => {
    onRefreshChain?.()
    void refreshLedger()
  }, [onRefreshChain, refreshLedger])

  useEffect(() => {
    if (!enabled) return
    refresh()
  }, [enabled, refresh])

  const items = useMemo(() => {
    const chain = chainItemsFromTransactions(
      chainTransactions,
      walletAddress,
      currencyDisplay,
      addressToTagMap,
    )
    const ledger = ledgerItemsFromRows(ledgerRows)
    return [...chain, ...ledger].sort((a, b) => b.sortAt - a.sortAt)
  }, [chainTransactions, walletAddress, currencyDisplay, ledgerRows, addressToTagMap])

  return {
    items,
    loading: ledgerLoading,
    refresh,
  }
}
