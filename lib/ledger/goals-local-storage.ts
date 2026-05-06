import type { GoalsCoachSuggestedGoal } from "@/lib/ledger/goals-coach-openrouter"

export const LEDGER_GOALS_STORAGE_KEY = "ledger_goals_store:v1"

export type LedgerGoalType = "pay_debt" | "save_amount" | "specific"
export type LedgerGoalPriority = "high" | "medium" | "low"

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
  priority: LedgerGoalPriority
  target_amount: number | null
  currency: string
  target_date_iso: string | null
  projected_income_amount: number | null
  projected_income_date_iso: string | null
  milestones: LedgerStoredMilestone[]
  created_at: string
}

export type LedgerIncomeProject = {
  id: string
  title: string
  amount: number | null
  currency: string
  estimated_date_iso: string | null
  linked_goal_id: string | null
  note: string | null
  created_at: string
}

export type LedgerGoalsStore = {
  goals: LedgerStoredGoal[]
  income_projects: LedgerIncomeProject[]
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `g_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function emptyGoalsStore(): LedgerGoalsStore {
  return { goals: [], income_projects: [] }
}

function normalizeGoal(raw: unknown): LedgerStoredGoal | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const id = typeof row.id === "string" ? row.id : newId()
  const goalType: LedgerGoalType =
    row.goal_type === "pay_debt" || row.goal_type === "specific" || row.goal_type === "save_amount"
      ? row.goal_type
      : "specific"
  const title = typeof row.title === "string" ? row.title.trim() : ""
  if (!title) return null
  const priority: LedgerGoalPriority =
    row.priority === "high" || row.priority === "low" || row.priority === "medium" ? row.priority : "medium"
  const targetAmount = typeof row.target_amount === "number" && Number.isFinite(row.target_amount) ? row.target_amount : null
  const currency = typeof row.currency === "string" && row.currency.trim() ? row.currency.trim().toUpperCase() : "CLP"
  const targetDate = typeof row.target_date_iso === "string" && row.target_date_iso.trim() ? row.target_date_iso.trim() : null
  const projectedIncomeAmount =
    typeof row.projected_income_amount === "number" && Number.isFinite(row.projected_income_amount)
      ? row.projected_income_amount
      : null
  const projectedIncomeDate =
    typeof row.projected_income_date_iso === "string" && row.projected_income_date_iso.trim()
      ? row.projected_income_date_iso.trim()
      : null
  const milestonesRaw = Array.isArray(row.milestones) ? row.milestones : []
  const milestones: LedgerStoredMilestone[] = milestonesRaw
    .map((m) => {
      if (!m || typeof m !== "object") return null
      const mr = m as Record<string, unknown>
      const label = typeof mr.label === "string" ? mr.label.trim() : ""
      if (!label) return null
      return {
        id: typeof mr.id === "string" ? mr.id : newId(),
        label,
        due_date_iso: typeof mr.due_date_iso === "string" && mr.due_date_iso.trim() ? mr.due_date_iso.trim() : null,
        amount: typeof mr.amount === "number" && Number.isFinite(mr.amount) ? mr.amount : null,
        done: Boolean(mr.done),
      }
    })
    .filter(Boolean) as LedgerStoredMilestone[]
  const createdAt = typeof row.created_at === "string" && row.created_at.trim() ? row.created_at.trim() : new Date().toISOString()
  return {
    id,
    goal_type: goalType,
    title,
    priority,
    target_amount: targetAmount,
    currency,
    target_date_iso: targetDate,
    projected_income_amount: projectedIncomeAmount,
    projected_income_date_iso: projectedIncomeDate,
    milestones,
    created_at: createdAt,
  }
}

function normalizeIncomeProject(raw: unknown): LedgerIncomeProject | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const title = typeof row.title === "string" ? row.title.trim() : ""
  if (!title) return null
  return {
    id: typeof row.id === "string" ? row.id : newId(),
    title,
    amount: typeof row.amount === "number" && Number.isFinite(row.amount) ? row.amount : null,
    currency: typeof row.currency === "string" && row.currency.trim() ? row.currency.trim().toUpperCase() : "CLP",
    estimated_date_iso:
      typeof row.estimated_date_iso === "string" && row.estimated_date_iso.trim() ? row.estimated_date_iso.trim() : null,
    linked_goal_id: typeof row.linked_goal_id === "string" && row.linked_goal_id.trim() ? row.linked_goal_id.trim() : null,
    note: typeof row.note === "string" && row.note.trim() ? row.note.trim() : null,
    created_at: typeof row.created_at === "string" && row.created_at.trim() ? row.created_at.trim() : new Date().toISOString(),
  }
}

export function readGoalsStore(): LedgerGoalsStore {
  if (typeof window === "undefined") return emptyGoalsStore()
  try {
    const raw = localStorage.getItem(LEDGER_GOALS_STORAGE_KEY)
    if (!raw) return emptyGoalsStore()
    const parsed = JSON.parse(raw) as { goals?: unknown; income_projects?: unknown }
    const goalsRaw = Array.isArray(parsed?.goals) ? parsed.goals : []
    const projectsRaw = Array.isArray(parsed?.income_projects) ? parsed.income_projects : []
    return {
      goals: goalsRaw.map(normalizeGoal).filter(Boolean) as LedgerStoredGoal[],
      income_projects: projectsRaw.map(normalizeIncomeProject).filter(Boolean) as LedgerIncomeProject[],
    }
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
    priority: "medium",
    target_amount: s.target_amount ?? null,
    currency: s.currency.trim().toUpperCase(),
    target_date_iso: s.target_date_iso?.trim() || null,
    projected_income_amount: null,
    projected_income_date_iso: null,
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
