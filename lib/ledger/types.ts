export type BalanceDomain = "wallet" | "email_ledger"

export type WalletBalanceRow = {
  domain: "wallet"
  assetCode: string
  issuer?: string
  amount: string
}

export type LedgerBalanceSummary = {
  domain: "email_ledger"
  currency: string
  income: number
  expenses: number
  netCashflow: number
}

/** Gastos y movimientos no-ingreso (correo / manual). No mezclar con `DEFAULT_INCOME_CATEGORIES`. */
export const DEFAULT_CATEGORIES = [
  "groceries",
  "food",
  "transport",
  "rent",
  "utilities",
  "software",
  "business",
  "debt",
  "health",
  "pets",
  "travel",
  "subscriptions",
  "transfers",
  "unknown",
] as const

/** Categorías sugeridas solo para tipo ingreso / reembolso (libro y UI). */
export const DEFAULT_INCOME_CATEGORIES = [
  "salary",
  "freelance",
  "business_income",
  "interest",
  "dividends",
  "rental_income",
  "gifts_received",
  "reimbursement",
  "cashback",
  "transfer_in",
  "other_income",
  "income",
  "unknown",
] as const

export type LedgerTransactionType =
  | "income"
  | "expense"
  | "transfer"
  | "refund"
  | "unknown"
