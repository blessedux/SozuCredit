import type { GoalsCoachSuggestedGoal } from "@/lib/ledger/goals-coach-openrouter"

export const LEDGER_GOALS_STORAGE_KEY = "ledger_goals_store:v1"

export type LedgerGoalType = "pay_debt" | "save_amount" | "specific"

export type LedgerStoredMilestone = {
  id: string
  label: string
  due_date_iso: string | null
  amount: number | null
  done: boolean
}

export type LedgerStoredGoal = {
  id: string
  goal_type: LedgerGoalType
  title: string
  target_amount: number | null
  currency: string
  target_date_iso: string | null
  milestones: LedgerStoredMilestone[]
  created_at: string
}

export type LedgerGoalsStore = {
  goals: LedgerStoredGoal[]
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `g_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function emptyGoalsStore(): LedgerGoalsStore {
  return { goals: [] }
}

export function readGoalsStore(): LedgerGoalsStore {
  if (typeof window === "undefined") return emptyGoalsStore()
  try {
    const raw = localStorage.getItem(LEDGER_GOALS_STORAGE_KEY)
    if (!raw) return emptyGoalsStore()
    const parsed = JSON.parse(raw) as LedgerGoalsStore
    if (!parsed || !Array.isArray(parsed.goals)) return emptyGoalsStore()
    return { goals: parsed.goals }
  } catch {
    return emptyGoalsStore()
  }
}

export function writeGoalsStore(store: LedgerGoalsStore): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(LEDGER_GOALS_STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* quota / private mode */
  }
}

/** Outstanding debt amount for “Pagar deuda”: milestone sums first, else target (matches vault-from-goal). */
export function getPayDebtOutstandingBalance(goal: LedgerStoredGoal): number {
  const milestoneRemaining = goal.milestones
    .filter((m) => !m.done && typeof m.amount === "number" && Number.isFinite(m.amount))
    .reduce((sum, m) => sum + Number(m.amount), 0)
  const fallback =
    typeof goal.target_amount === "number" && Number.isFinite(goal.target_amount)
      ? goal.target_amount
      : 0
  return milestoneRemaining > 0 ? milestoneRemaining : fallback
}

/** Full declared debt for totals: prefer target; if missing, sum all milestone amounts (full plan). */
export function getPayDebtFullObjectiveAmount(goal: LedgerStoredGoal): number | null {
  const t = goal.target_amount
  if (typeof t === "number" && Number.isFinite(t) && t > 0) return t
  let sum = 0
  for (const m of goal.milestones) {
    if (typeof m.amount === "number" && Number.isFinite(m.amount) && m.amount > 0) sum += m.amount
  }
  return sum > 0 ? sum : null
}

/** Near-term focus: amount of the earliest pending milestone (by due date); else target when no milestones. */
export function getPayDebtNearTermFocusAmount(goal: LedgerStoredGoal): number | null {
  const pending = goal.milestones.filter(
    (m) => !m.done && typeof m.amount === "number" && Number.isFinite(m.amount) && m.amount > 0
  )
  if (pending.length > 0) {
    const sorted = [...pending].sort((a, b) => {
      const rawA = a.due_date_iso?.trim()
      const rawB = b.due_date_iso?.trim()
      const da = rawA ? Date.parse(rawA) : Number.POSITIVE_INFINITY
      const db = rawB ? Date.parse(rawB) : Number.POSITIVE_INFINITY
      return da - db
    })
    const first = sorted[0]
    if (first && typeof first.amount === "number" && Number.isFinite(first.amount)) return first.amount
  }
  const t = goal.target_amount
  if (typeof t === "number" && Number.isFinite(t) && t > 0) return t
  return null
}

export function appendGoalFromSuggestion(s: GoalsCoachSuggestedGoal): LedgerStoredGoal {
  const goal: LedgerStoredGoal = {
    id: newId(),
    goal_type: s.goal_type,
    title: s.title.trim(),
    target_amount: s.target_amount ?? null,
    currency: s.currency.trim().toUpperCase(),
    target_date_iso: s.target_date_iso?.trim() || null,
    milestones: s.milestones.map((m) => ({
      id: newId(),
      label: m.label.trim(),
      due_date_iso: m.due_date_iso?.trim() || null,
      amount: m.amount ?? null,
      done: false,
    })),
    created_at: new Date().toISOString(),
  }
  return goal
}
