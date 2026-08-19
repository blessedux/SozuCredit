/**
 * Testnet PizzaToken (SEP-41). Never Circle USDC — never fall back to Blend/SAC ids.
 * Client-safe constants; server registry may override the contract id via env.
 */

export const PIZZA_ASSET_ID = "pizza_token" as const
export const PIZZA_NAME = "Pizza"
export const PIZZA_SYMBOL = "PIZZA"
export const PIZZA_DECIMALS = 0
export const PIZZA_PREMINT = 20

/** Deployed testnet PizzaToken (dashboard ticket 1). */
export const DEFAULT_TESTNET_PIZZA_TOKEN_ID =
  "CDLIQJFEKJ4HGDQ7I5KOAVXOIZLCMVVICRMPK2LL3GE6PL53BQWGS4F6"

/** Circle testnet USDC SAC — PizzaToken must never resolve to this. */
export const CIRCLE_TESTNET_USDC_SAC_ID =
  "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"

export type PizzaBalanceRow = {
  assetId?: string
  symbol?: string
  balance: number
}

/** Whole pizzas only. Hidden at 0 — callers must not render a 0-PIZZA row. */
export function pizzaBalanceToShow(rows: PizzaBalanceRow[] | undefined | null): number | null {
  if (!rows?.length) return null
  const row = rows.find(
    (r) => r.assetId === PIZZA_ASSET_ID || r.symbol?.toUpperCase() === PIZZA_SYMBOL,
  )
  if (!row || !Number.isFinite(row.balance) || row.balance < 1) return null
  return Math.floor(row.balance)
}

export function pizzaHopFlag(balance: number | null): "0" | "1" {
  return balance != null && balance >= 1 ? "1" : "0"
}
