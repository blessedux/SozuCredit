import type { SupabaseClient } from "@supabase/supabase-js"
import { DEFAULT_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "@/lib/ledger/types"

const DEFAULT_EXPENSE_SET = new Set<string>(DEFAULT_CATEGORIES as readonly string[])
const DEFAULT_INCOME_SET = new Set<string>(DEFAULT_INCOME_CATEGORIES as readonly string[])

const SLUG_RE = /^[a-z0-9_]{1,64}$/

/** Normalize user input to a stable category slug (lowercase, underscores). */
export function normalizeNewLedgerCategorySlug(raw: string): string | null {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 64)
  if (!s || !SLUG_RE.test(s)) return null
  return s
}

export function sanitizeCustomCategorySlugs(slugs: string[] | null | undefined): string[] {
  return [...new Set((slugs ?? []).map((x) => String(x).trim().toLowerCase()))]
    .filter((s) => s && SLUG_RE.test(s) && !DEFAULT_EXPENSE_SET.has(s))
    .sort((a, b) => a.localeCompare(b))
}

export function sanitizeCustomIncomeCategorySlugs(slugs: string[] | null | undefined): string[] {
  return [...new Set((slugs ?? []).map((x) => String(x).trim().toLowerCase()))]
    .filter((s) => s && SLUG_RE.test(s) && !DEFAULT_INCOME_SET.has(s))
    .sort((a, b) => a.localeCompare(b))
}

export function mergeLedgerCategoryLists(customSlugs: string[] | null | undefined): string[] {
  const extras = sanitizeCustomCategorySlugs(customSlugs)
  return [...DEFAULT_CATEGORIES, ...extras]
}

export function mergeIncomeCategoryLists(customSlugs: string[] | null | undefined): string[] {
  const extras = sanitizeCustomIncomeCategorySlugs(customSlugs)
  return [...DEFAULT_INCOME_CATEGORIES, ...extras]
}

export async function fetchMergedLedgerCategories(
  db: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data, error } = await db
    .from("ledger_settings")
    .select("custom_categories")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  const custom = (data?.custom_categories as string[] | null) ?? []
  return mergeLedgerCategoryLists(custom)
}

export async function fetchMergedIncomeCategories(
  db: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data, error } = await db
    .from("ledger_settings")
    .select("custom_income_categories")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    if (error.message?.includes("custom_income_categories") || error.message?.includes("column")) {
      const { data: legacy, error: legacyErr } = await db
        .from("ledger_settings")
        .select("custom_categories")
        .eq("user_id", userId)
        .maybeSingle()
      if (legacyErr) return [...DEFAULT_INCOME_CATEGORIES]
      const fallbackCustom = (legacy?.custom_categories as string[] | null) ?? []
      return mergeIncomeCategoryLists(fallbackCustom)
    }
    throw new Error(error.message)
  }
  const custom = (data?.custom_income_categories as string[] | null) ?? []
  return mergeIncomeCategoryLists(custom)
}
