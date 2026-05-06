/** Time windows used by ledger donut charts and the preview transactions table (all UTC). */
export type LedgerChartWindow = "month" | "week" | "day"

export type LedgerWindowUtcBounds = {
  startIso: string
  endIso: string
  startMs: number
  endMs: number
}

/** Same bounds as `/api/ledger/summary` donut slices: calendar month UTC, rolling 7d, or calendar day UTC. */
export function ledgerWindowUtcBounds(window: LedgerChartWindow, now = new Date()): LedgerWindowUtcBounds {
  switch (window) {
    case "month": {
      const startMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
      const endMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)
      return {
        startMs,
        endMs,
        startIso: new Date(startMs).toISOString(),
        endIso: new Date(endMs).toISOString(),
      }
    }
    case "week": {
      const endMs = now.getTime()
      const startMs = endMs - 7 * 86_400_000
      return {
        startMs,
        endMs,
        startIso: new Date(startMs).toISOString(),
        endIso: new Date(endMs).toISOString(),
      }
    }
    case "day": {
      const startMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
      const endMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
      return {
        startMs,
        endMs,
        startIso: new Date(startMs).toISOString(),
        endIso: new Date(endMs).toISOString(),
      }
    }
  }
}

export function ledgerChartWindowLabel(w: LedgerChartWindow): string {
  switch (w) {
    case "month":
      return "Este mes (UTC)"
    case "week":
      return "Últimos 7 días"
    case "day":
      return "Hoy UTC"
  }
}
