/** Parse balances from DB / forms (numeric, dot decimal, Chile `1.234.567`, `1234,56`). */
export function parseLedgerVaultBalance(raw: unknown): number | null {
  if (raw == null) return null
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null
  const s = String(raw).trim().replace(/\s/g, "")
  if (!s) return null
  const direct = Number(s)
  if (Number.isFinite(direct)) return direct
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    const v = Number(s.replace(/\./g, "").replace(",", "."))
    return Number.isFinite(v) ? v : null
  }
  if (/^\d+,\d{1,6}$/.test(s)) {
    const v = Number(s.replace(",", "."))
    return Number.isFinite(v) ? v : null
  }
  return null
}

/** Sum manual vault rows by ISO currency code (uppercase). */
export function sumBalancesByCurrency(
  rows: readonly { balance_amount: number | string | unknown; currency: string }[]
): { currency: string; total: number }[] {
  const m = new Map<string, number>()
  for (const row of rows) {
    const c = String(row.currency ?? "USD")
      .trim()
      .toUpperCase()
    const n = parseLedgerVaultBalance(row.balance_amount)
    if (n == null || !Number.isFinite(n)) continue
    m.set(c, (m.get(c) ?? 0) + n)
  }
  return [...m.entries()]
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => a.currency.localeCompare(b.currency))
}

/** Debt balances are summed by magnitude (sign-insensitive). */
export function sumLiabilityBalancesByCurrency(
  rows: readonly { balance_amount: unknown; currency: string }[]
): { currency: string; total: number }[] {
  const m = new Map<string, number>()
  for (const row of rows) {
    const c = String(row.currency ?? "USD")
      .trim()
      .toUpperCase()
    const n = parseLedgerVaultBalance(row.balance_amount)
    if (n == null || !Number.isFinite(n)) continue
    m.set(c, (m.get(c) ?? 0) + Math.abs(n))
  }
  return [...m.entries()]
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => a.currency.localeCompare(b.currency))
}

/** Merge per-currency totals (e.g. vault liabilities + goal-derived debt). */
export function mergeTotalsByCurrency(
  lists: ReadonlyArray<readonly { currency: string; total: number }[]>
): { currency: string; total: number }[] {
  const m = new Map<string, number>()
  for (const list of lists) {
    for (const { currency, total } of list) {
      if (!Number.isFinite(total)) continue
      const c = String(currency ?? "USD")
        .trim()
        .toUpperCase()
      m.set(c, (m.get(c) ?? 0) + total)
    }
  }
  return [...m.entries()]
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => a.currency.localeCompare(b.currency))
}
