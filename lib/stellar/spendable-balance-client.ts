/**
 * Client-safe spendable balance helpers (mirrors server pick-send-token logic).
 */

import { isUsdcSpendableCategory } from "@/lib/stellar/asset-types"

export type ApiTokenBalanceRow = {
  assetId?: string
  contractId: string
  symbol?: string
  displayName: string
  decimals?: number
  balance: number
  category?: string
  sendPriority?: number
}

export type BalancePayloadForSend = {
  usdcBalance?: number
  displayWalletUsdc?: number
  sorobanUsdcBalance?: number
  sorobanSacUsdcBalance?: number
  sorobanSozuInternalBalance?: number
  classicUsdcOnSigner?: number
  legacyUsdcOnSigner?: number
  maxSingleTokenBalance?: number
  tokenBalances?: ApiTokenBalanceRow[]
}

function usdcRows(rows: ApiTokenBalanceRow[]): ApiTokenBalanceRow[] {
  return rows.filter((r) => isUsdcSpendableCategory(r.category))
}

/** Sum of USDC-rail token rows (SKU tokens like PIZZA are excluded). */
export function totalSpendableFromPayload(data: BalancePayloadForSend): number {
  const rows = usdcRows(data.tokenBalances ?? [])
  if (rows.length > 0) {
    return rows.reduce((sum, r) => sum + (Number(r.balance) || 0), 0)
  }
  if (typeof data.usdcBalance === "number") return data.usdcBalance
  const blend = data.sorobanUsdcBalance ?? 0
  const sac = data.sorobanSacUsdcBalance ?? 0
  const sozu = data.sorobanSozuInternalBalance ?? 0
  return blend + sac + sozu
}

/** Largest USDC balance in any single token contract. */
export function maxSingleTokenBalance(data: BalancePayloadForSend): number {
  if (typeof data.maxSingleTokenBalance === "number" && data.maxSingleTokenBalance > 0) {
    return data.maxSingleTokenBalance
  }
  const rows = usdcRows(data.tokenBalances ?? [])
  if (rows.length > 0) {
    return Math.max(0, ...rows.map((r) => Number(r.balance) || 0))
  }
  return totalSpendableFromPayload(data)
}

export function pickTokenRowForSend(
  rows: ApiTokenBalanceRow[],
  amountRequired: number,
  preferredContractId?: string | null,
): ApiTokenBalanceRow | null {
  if (!rows.length) return null
  const need = amountRequired

  if (preferredContractId) {
    const id = preferredContractId.trim().toUpperCase()
    const row = rows.find((r) => r.contractId.toUpperCase() === id)
    if (row && row.balance >= need) return row
    return null
  }

  const sorted = [...rows].sort(
    (a, b) => (a.sendPriority ?? 99) - (b.sendPriority ?? 99),
  )
  for (const row of sorted) {
    if (!isUsdcSpendableCategory(row.category)) continue
    if (row.balance >= need) return row
  }
  return null
}

export function canCoverSendAmount(
  data: BalancePayloadForSend,
  amountRequired: number,
  preferredContractId?: string | null,
): {
  ok: boolean
  picked: ApiTokenBalanceRow | null
  totalSpendable: number
  maxSingleToken: number
} {
  const rows = data.tokenBalances ?? []
  const totalSpendable = totalSpendableFromPayload(data)
  const maxSingleToken = maxSingleTokenBalance(data)

  if (rows.length > 0) {
    const picked = pickTokenRowForSend(rows, amountRequired, preferredContractId)
    return {
      ok: !!picked,
      picked,
      totalSpendable,
      maxSingleToken,
    }
  }

  if (maxSingleToken >= amountRequired) {
    return {
      ok: true,
      picked: null,
      totalSpendable,
      maxSingleToken,
    }
  }

  return { ok: false, picked: null, totalSpendable, maxSingleToken }
}

export function formatClientInsufficientBalance(
  data: BalancePayloadForSend,
  amountRequired: number,
): string {
  const rows = (data.tokenBalances ?? []).filter((r) => r.balance > 0)
  const { totalSpendable, maxSingleToken } = canCoverSendAmount(data, amountRequired)

  if (rows.length > 0) {
    const parts = rows.map((r) => `${r.displayName} ${r.balance.toFixed(2)}`)
    return (
      `Insufficient balance. You need ${amountRequired.toFixed(2)} USDC in one token ` +
      `but your largest balance is ${maxSingleToken.toFixed(2)} ` +
      `(${totalSpendable.toFixed(2)} total: ${parts.join(", ")}).`
    )
  }

  return (
    `Insufficient balance. You need ${amountRequired.toFixed(2)} USDC but only have ` +
    `${totalSpendable.toFixed(2)} USDC available across your smart wallet tokens.`
  )
}
