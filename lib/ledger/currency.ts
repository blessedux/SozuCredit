/**
 * Parse amount from manual edit fields: plain `25000`, Chile `25.000`, or decimal `25,50` / `25.50`.
 */
export function parseLedgerAmountInput(raw: string): number | null {
  const s = raw.trim().replace(/\s+/g, "")
  if (!s) return null
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    const n = Number(s.replace(/\./g, "").replace(",", "."))
    return Number.isFinite(n) && n > 0 ? n : null
  }
  if (/^\d+,\d{1,2}$/.test(s)) {
    const n = Number(s.replace(/\./g, "").replace(",", "."))
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const cleaned = s.replace(/[^\d.,]/g, "")
  if (!cleaned) return null
  if (cleaned.includes(",") && cleaned.includes(".")) {
    const n = Number(cleaned.replace(/\./g, "").replace(",", "."))
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const n = Number(cleaned.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Fiat → USDC estimates use USD as a proxy rate (per product spec).
 */
export function convertCurrency({
  amount,
  rate,
}: {
  amount: number
  from: string
  to: string
  rate: number
}) {
  return amount * rate
}
