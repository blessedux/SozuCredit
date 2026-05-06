import type { SupabaseClient } from "@supabase/supabase-js"

export type CategoryRuleRow = {
  id: string
  user_id: string
  match_text: string
  category: string
  type: string | null
  skip_sync: boolean
}

export function normalizeRuleMatch(text: string): string {
  return text.trim().toLowerCase().slice(0, 200)
}

/**
 * Email-derived "merchant" lines often include boilerplate ("Your receipt from X").
 * Stripping common prefixes makes user rules match the next charge from the same business.
 */
export function stripMerchantBoilerplate(raw: string): string {
  let s = raw.trim()
  if (!s) return ""

  const prefixes = [
    /^your receipt from\s+/i,
    /^your order from\s+/i,
    /^thanks for your order from\s+/i,
    /^purchase at\s+/i,
    /^purchase from\s+/i,
    /^payment to\s+/i,
    /^paid to\s+/i,
    /^recibo de\s+/i,
    /^comprobante de\s+/i,
    /^comprobante\s+/i,
    /^pedido en\s+/i,
    /^tu pedido en\s+/i,
    /^cargo de\s+/i,
    /^compra en\s+/i,
    /^compra en\s*:\s*/i,
  ]

  let prev = ""
  while (prev !== s) {
    prev = s
    for (const re of prefixes) {
      s = s.replace(re, "").trim()
    }
  }

  return s
}

/** Prefer the longest matching phrase so specific rules beat short keywords. */
export function findLongestSubstringMatch<T extends { match_text: string }>(
  rules: readonly T[],
  haystack: string
): T | null {
  const h = haystack.toLowerCase()
  let best: T | null = null
  let bestLen = -1
  for (const r of rules) {
    const m = r.match_text.toLowerCase()
    if (!m || !h.includes(m)) continue
    if (m.length > bestLen) {
      best = r
      bestLen = m.length
    }
  }
  return best
}

export function findRuleForHaystack(rules: CategoryRuleRow[], haystack: string): CategoryRuleRow | null {
  return findLongestSubstringMatch(rules, haystack)
}

/** Rules with skip_sync are for hiding junk mail from sync, not for category hints. */
export function findActiveCategoryRuleForHaystack(
  rules: readonly CategoryRuleRow[],
  haystack: string
): CategoryRuleRow | null {
  const active = rules.filter((r) => !r.skip_sync)
  return findRuleForHaystack(active, haystack)
}

export async function fetchCategoryRulesForUser(
  db: SupabaseClient,
  userId: string
): Promise<CategoryRuleRow[]> {
  const { data, error } = await db
    .from("category_rules")
    .select("id, user_id, match_text, category, type, skip_sync")
    .eq("user_id", userId)

  if (error) throw new Error(error.message)
  return (data ?? []) as CategoryRuleRow[]
}

export function deriveMatchTextFromTransaction(row: {
  merchant?: string | null
  raw_text?: string | null
}): string {
  const m = row.merchant?.trim()
  if (m) {
    const stripped = stripMerchantBoilerplate(m)
    const core = stripped.length >= 3 ? stripped : m
    return normalizeRuleMatch(core)
  }
  const raw = row.raw_text?.trim().split(/\s+/).slice(0, 12).join(" ") ?? ""
  return normalizeRuleMatch(raw || "unknown")
}
