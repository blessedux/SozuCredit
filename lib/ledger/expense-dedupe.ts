import { deriveExpenseInstitution } from "@/lib/ledger/expense-institution"
import { utcCalendarDayFromIso } from "@/lib/ledger/transaction-date"

/** Row shape used when collapsing receipt + bank confirmation duplicates. */
export type DedupeExpenseRow = {
  id: string
  date: string
  amount: number
  currency: string
  type: string
  category: string
  confidence: number
  merchant: string | null
  source_email_id: string | null
  from_addr: string | null
}

function normalizeAmountKey(amount: number, currency: string): string {
  const c = currency.toUpperCase()
  if (c === "CLP" || c === "ARS" || c === "JPY" || c === "VND") {
    return String(Math.round(amount))
  }
  return amount.toFixed(2)
}

export function expenseDedupeGroupKey(row: DedupeExpenseRow): string {
  return `${utcCalendarDayFromIso(row.date)}|${row.currency.toUpperCase()}|${normalizeAmountKey(row.amount, row.currency)}`
}

function isBankConfirmationSide(row: DedupeExpenseRow): boolean {
  const origin = row.source_email_id ? ("gmail" as const) : ("manual" as const)
  const inst = deriveExpenseInstitution({
    fromAddr: row.from_addr,
    merchant: row.merchant,
    origin,
  })
  return inst.kind === "bank" || inst.tag === "bank_generic"
}

function pickSingleExpenseDuplicate(candidates: DedupeExpenseRow[]): DedupeExpenseRow {
  return [...candidates].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    const score = (r: DedupeExpenseRow) => (isBankConfirmationSide(r) ? 0 : 1)
    if (score(b) !== score(a)) return score(b) - score(a)
    return a.id.localeCompare(b.id)
  })[0]
}

/**
 * Drops expenses that look like duplicate signals for the same purchase:
 * same UTC calendar day + currency + amount, where both a bank-style confirmation and a non-bank
 * receipt exist — we keep non-bank rows only. If duplicates remain (e.g. two receipts), keep one.
 */
export function dedupeExpenseRowsForAggregation(rows: DedupeExpenseRow[]): DedupeExpenseRow[] {
  const expenses = rows.filter((r) => r.type === "expense")
  const nonExpenses = rows.filter((r) => r.type !== "expense")

  const groups = new Map<string, DedupeExpenseRow[]>()
  for (const r of expenses) {
    const k = expenseDedupeGroupKey(r)
    const g = groups.get(k) ?? []
    g.push(r)
    groups.set(k, g)
  }

  const keptExpenseIds = new Set<string>()

  for (const [, group] of groups) {
    if (group.length === 1) {
      keptExpenseIds.add(group[0].id)
      continue
    }

    const banks = group.filter((r) => isBankConfirmationSide(r))
    const nonBanks = group.filter((r) => !isBankConfirmationSide(r))

    let finalists: DedupeExpenseRow[]
    if (banks.length > 0 && nonBanks.length > 0) {
      finalists = nonBanks
    } else {
      finalists = group
    }

    if (finalists.length > 1) {
      finalists = [pickSingleExpenseDuplicate(finalists)]
    }
    finalists.forEach((r) => keptExpenseIds.add(r.id))
  }

  const keptExpenses = expenses.filter((r) => keptExpenseIds.has(r.id))
  return [...nonExpenses, ...keptExpenses].sort((a, b) => a.date.localeCompare(b.date))
}

export function countExpenseDuplicatesRemoved(before: DedupeExpenseRow[], after: DedupeExpenseRow[]): number {
  const b = before.filter((r) => r.type === "expense").length
  const a = after.filter((r) => r.type === "expense").length
  return Math.max(0, b - a)
}
