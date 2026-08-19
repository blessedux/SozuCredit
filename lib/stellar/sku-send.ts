import { PIZZA_ASSET_ID, PIZZA_SYMBOL } from "@/lib/stellar/pizza-token"

/** Whole SKU units (PizzaToken has 0 decimals). */
export function parseWholeTokenAmount(raw: string): number | null {
  const trimmed = raw.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const n = Number(trimmed)
  if (!Number.isInteger(n) || n < 1) return null
  return n
}

export function isPizzaAssetRow(row: {
  assetId?: string
  symbol?: string
  contractId?: string
}): boolean {
  return row.assetId === PIZZA_ASSET_ID || row.symbol?.toUpperCase() === PIZZA_SYMBOL
}
