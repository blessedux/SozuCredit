export type MonthlyObligationLine = {
  id: string
  label: string
  amount: number
}

export function parseMonthlyObligationsPlan(raw: unknown): MonthlyObligationLine[] {
  if (!Array.isArray(raw)) return []
  const out: MonthlyObligationLine[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const o = row as Record<string, unknown>
    const id = typeof o.id === "string" ? o.id.trim() : ""
    const label = typeof o.label === "string" ? o.label.trim() : ""
    const amount = Number(o.amount)
    if (!id || !label || !Number.isFinite(amount) || amount < 0) continue
    out.push({ id: id.slice(0, 80), label: label.slice(0, 120), amount })
  }
  return out
}

export function sumMonthlyObligations(lines: MonthlyObligationLine[]): number {
  return lines.reduce((s, l) => s + (Number.isFinite(l.amount) ? l.amount : 0), 0)
}
