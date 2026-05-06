import { format } from "date-fns"
import { es } from "date-fns/locale"

/**
 * Ledger `date` values may be full ISO datetimes or date-only strings.
 * Always compare windows using milliseconds, not lexicographic string order.
 */
export function transactionInstantMs(iso: string): number | null {
  const n = Date.parse(iso)
  return Number.isFinite(n) ? n : null
}

/** UTC calendar day YYYY-MM-DD for grouping / dedupe (from instant, not string prefix). */
export function utcCalendarDayFromIso(iso: string): string {
  const t = transactionInstantMs(iso)
  if (t == null) return iso.trim().slice(0, 10)
  return new Date(t).toISOString().slice(0, 10)
}

/** Gmail sync sets `date` to the message internal time (when the email was received). */
export function ledgerDateShowsEmailReceivedTime(source: string): boolean {
  return source === "gmail"
}

/** Detail / dialog: full date, and clock time when the moment comes from email receipt. */
export function formatLedgerTxDetailMoment(iso: string, source: string): string {
  const t = transactionInstantMs(iso)
  if (t == null) return iso.trim()
  const d = new Date(t)
  if (ledgerDateShowsEmailReceivedTime(source)) {
    return format(d, "d 'de' MMMM yyyy, HH:mm", { locale: es })
  }
  return format(d, "d 'de' MMMM yyyy", { locale: es })
}

/** Compact table cell (list views). */
export function formatLedgerTxTableMoment(iso: string, source: string): string {
  const t = transactionInstantMs(iso)
  if (t == null) return iso.trim().slice(0, 10)
  const d = new Date(t)
  if (ledgerDateShowsEmailReceivedTime(source)) {
    return format(d, "d MMM yy, HH:mm", { locale: es })
  }
  return format(d, "d MMM yyyy", { locale: es })
}
