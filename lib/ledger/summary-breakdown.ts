export type CategoryBreakdownSlice = {
  category: string
  amount: number
  count: number
  pct: number
}

export function buildExpenseCategoryBreakdown(
  rows: Array<{ amount: number; currency: string; type: string; category: string }>,
  primaryCurrency: string
): CategoryBreakdownSlice[] {
  const primary = primaryCurrency.toUpperCase()
  const expenses = rows.filter(
    (r) => r.type === "expense" && r.currency.toUpperCase() === primary
  )
  const total = expenses.reduce((s, r) => s + Math.abs(r.amount), 0)
  const map = new Map<string, { amount: number; count: number }>()
  for (const r of expenses) {
    const cat = r.category || "unknown"
    const prev = map.get(cat) ?? { amount: 0, count: 0 }
    prev.amount += Math.abs(r.amount)
    prev.count += 1
    map.set(cat, prev)
  }
  return [...map.entries()]
    .map(([category, v]) => ({
      category,
      amount: v.amount,
      count: v.count,
      pct: total > 0 ? Math.round((v.amount / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
}

export function buildIncomeCategoryBreakdown(
  rows: Array<{ amount: number; currency: string; type: string; category: string }>,
  primaryCurrency: string
): CategoryBreakdownSlice[] {
  const primary = primaryCurrency.toUpperCase()
  const inc = rows.filter(
    (r) =>
      (r.type === "income" || r.type === "refund") && r.currency.toUpperCase() === primary
  )
  const total = inc.reduce((s, r) => s + Math.abs(r.amount), 0)
  const map = new Map<string, { amount: number; count: number }>()
  for (const r of inc) {
    const cat = r.category || "unknown"
    const prev = map.get(cat) ?? { amount: 0, count: 0 }
    prev.amount += Math.abs(r.amount)
    prev.count += 1
    map.set(cat, prev)
  }
  return [...map.entries()]
    .map(([category, v]) => ({
      category,
      amount: v.amount,
      count: v.count,
      pct: total > 0 ? Math.round((v.amount / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
}
