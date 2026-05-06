import { NextResponse } from "next/server"
import { z } from "zod"
import { getApiUserClient } from "@/lib/ledger/supabase-admin"
import { isMissingLedgerTable } from "@/lib/ledger/supabase-errors"
import {
  fetchMergedIncomeCategories,
  fetchMergedLedgerCategories,
  mergeIncomeCategoryLists,
  mergeLedgerCategoryLists,
  normalizeNewLedgerCategorySlug,
  sanitizeCustomCategorySlugs,
  sanitizeCustomIncomeCategorySlugs,
} from "@/lib/ledger/merged-categories"
import { DEFAULT_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "@/lib/ledger/types"

const postSchema = z.object({
  label: z.string().min(1).max(80),
  kind: z.enum(["expense", "income"]).optional().default("expense"),
})

const DEFAULT_EXPENSE_SET = new Set<string>(DEFAULT_CATEGORIES as readonly string[])
const DEFAULT_INCOME_SET = new Set<string>(DEFAULT_INCOME_CATEGORIES as readonly string[])

export async function POST(request: Request) {
  const ctx = await getApiUserClient(request)
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const slug = normalizeNewLedgerCategorySlug(parsed.data.label)
  if (!slug) {
    return NextResponse.json(
      { error: "Usa letras, números o guiones bajos (máx. 64 caracteres)." },
      { status: 400 }
    )
  }

  const kind = parsed.data.kind

  if (kind === "expense" && DEFAULT_EXPENSE_SET.has(slug)) {
    try {
      const categories = await fetchMergedLedgerCategories(ctx.db, ctx.userId)
      const incomeCategories = await fetchMergedIncomeCategories(ctx.db, ctx.userId)
      return NextResponse.json({ ok: true, slug, categories, incomeCategories, alreadyDefault: true })
    } catch {
      return NextResponse.json({
        ok: true,
        slug,
        categories: [...DEFAULT_CATEGORIES],
        incomeCategories: [...DEFAULT_INCOME_CATEGORIES],
        alreadyDefault: true,
      })
    }
  }

  if (kind === "income" && DEFAULT_INCOME_SET.has(slug)) {
    try {
      const categories = await fetchMergedLedgerCategories(ctx.db, ctx.userId)
      const incomeCategories = await fetchMergedIncomeCategories(ctx.db, ctx.userId)
      return NextResponse.json({ ok: true, slug, categories, incomeCategories, alreadyDefault: true })
    } catch {
      return NextResponse.json({
        ok: true,
        slug,
        categories: [...DEFAULT_CATEGORIES],
        incomeCategories: [...DEFAULT_INCOME_CATEGORIES],
        alreadyDefault: true,
      })
    }
  }

  try {
    let row:
      | {
          preferred_fiat_currency?: string | null
          custom_categories?: string[] | null
          custom_income_categories?: string[] | null
        }
      | null = null
    let missingIncomeColumn = false

    const { data: fullRow, error: fullSelErr } = await ctx.db
      .from("ledger_settings")
      .select("preferred_fiat_currency, custom_categories, custom_income_categories")
      .eq("user_id", ctx.userId)
      .maybeSingle()

    if (fullSelErr) {
      if (isMissingLedgerTable(fullSelErr)) {
        return NextResponse.json({ error: "Ledger tables not installed" }, { status: 503 })
      }
      const msg = fullSelErr.message ?? ""
      if (msg.includes("custom_income_categories") || msg.includes("column")) {
        missingIncomeColumn = true
        const { data: legacyRow, error: legacySelErr } = await ctx.db
          .from("ledger_settings")
          .select("preferred_fiat_currency, custom_categories")
          .eq("user_id", ctx.userId)
          .maybeSingle()
        if (legacySelErr) {
          return NextResponse.json({ error: legacySelErr.message }, { status: 500 })
        }
        row = legacyRow as typeof row
      } else {
        return NextResponse.json({ error: fullSelErr.message }, { status: 500 })
      }
    } else {
      row = fullRow as typeof row
    }

    const prevExpense = (row?.custom_categories as string[] | null) ?? []
    const prevIncome = missingIncomeColumn
      ? (row?.custom_categories as string[] | null) ?? []
      : (row?.custom_income_categories as string[] | null) ?? []

    const nextExpense =
      kind === "expense" || (kind === "income" && missingIncomeColumn)
        ? sanitizeCustomCategorySlugs([...prevExpense, slug])
        : prevExpense
    const nextIncome =
      kind === "income" ? sanitizeCustomIncomeCategorySlugs([...prevIncome, slug]) : prevIncome

    const payload: Record<string, unknown> = {
      user_id: ctx.userId,
      preferred_fiat_currency: row?.preferred_fiat_currency ?? null,
      custom_categories: nextExpense,
      updated_at: new Date().toISOString(),
    }
    if (!missingIncomeColumn) payload.custom_income_categories = nextIncome

    const { error: upErr } = await ctx.db.from("ledger_settings").upsert(payload, { onConflict: "user_id" })

    if (upErr) {
      if (isMissingLedgerTable(upErr)) {
        return NextResponse.json({ error: "Ledger tables not installed" }, { status: 503 })
      }
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    const categories = mergeLedgerCategoryLists(nextExpense)
    const incomeCategories = mergeIncomeCategoryLists(nextIncome)
    return NextResponse.json({ ok: true, slug, categories, incomeCategories })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("custom_categories")) {
      return NextResponse.json(
        { error: "Run the ledger migration that adds custom_categories to ledger_settings." },
        { status: 503 }
      )
    }
    console.error("[ledger/categories]", e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
