import { NextResponse } from "next/server"
import { getApiUserClient } from "@/lib/ledger/supabase-admin"
import {
  classifyLedgerMovementWithOpenRouter,
  coerceLedgerCategory,
  getOpenRouterApiKey,
} from "@/lib/ledger/openrouter-classify"
import { buildLedgerClassificationHaystack } from "@/lib/ledger/builtin-category-hints"
import {
  fetchCategoryRulesForUser,
  findActiveCategoryRuleForHaystack,
} from "@/lib/ledger/category-rules-helpers"
import {
  fetchMergedIncomeCategories,
  fetchMergedLedgerCategories,
} from "@/lib/ledger/merged-categories"
import { DEFAULT_CATEGORIES, DEFAULT_INCOME_CATEGORIES, type LedgerTransactionType } from "@/lib/ledger/types"

const ALLOWED_RULE_TYPES = new Set<string>(["income", "expense", "transfer", "refund", "unknown"])

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getApiUserClient(request)
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const { data: tx, error } = await ctx.db
    .from("ledger_transactions")
    .select(
      "id, merchant, amount, currency, type, category, raw_text, confidence, source_email_id, card_last_four, cardholder_name"
    )
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!tx) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let subject: string | null = null
  let snippet: string | null = null
  let fromAddr: string | null = null

  if (tx.source_email_id) {
    const { data: src } = await ctx.db
      .from("email_sources")
      .select("subject, snippet, from_addr")
      .eq("id", tx.source_email_id)
      .maybeSingle()
    subject = src?.subject ?? null
    snippet = src?.snippet ?? null
    fromAddr = src?.from_addr ?? null
  }

  let categoryRules: Awaited<ReturnType<typeof fetchCategoryRulesForUser>> = []
  try {
    categoryRules = await fetchCategoryRulesForUser(ctx.db, ctx.userId)
  } catch {
    categoryRules = []
  }

  let mergedExpenseCategories: string[] = [...DEFAULT_CATEGORIES]
  let mergedIncomeCategories: string[] = [...DEFAULT_INCOME_CATEGORIES]
  try {
    mergedExpenseCategories = await fetchMergedLedgerCategories(ctx.db, ctx.userId)
  } catch {
    mergedExpenseCategories = [...DEFAULT_CATEGORIES]
  }
  try {
    mergedIncomeCategories = await fetchMergedIncomeCategories(ctx.db, ctx.userId)
  } catch {
    mergedIncomeCategories = [...DEFAULT_INCOME_CATEGORIES]
  }
  const mergedCategorySlugs = [...new Set([...mergedExpenseCategories, ...mergedIncomeCategories])]
  const categoryAllowSet = new Set(mergedCategorySlugs)

  const haystack = buildLedgerClassificationHaystack({
    merchant: tx.merchant,
    subject,
    snippet,
    rawText: tx.raw_text,
    fromAddr,
    cardLastFour: tx.card_last_four as string | null,
    cardholderName: tx.cardholder_name as string | null,
  })

  const matchedRule = findActiveCategoryRuleForHaystack(categoryRules, haystack)
  if (matchedRule) {
    const txType = String(tx.type) as LedgerTransactionType
    const type: LedgerTransactionType =
      matchedRule.type && ALLOWED_RULE_TYPES.has(matchedRule.type)
        ? (matchedRule.type as LedgerTransactionType)
        : txType

    return NextResponse.json({
      ok: true,
      suggestion: {
        type,
        category: coerceLedgerCategory(matchedRule.category, categoryAllowSet),
        is_financial_transaction: true,
        confidence: 0.97,
        reason_one_line: `Matches your saved merchant rule (“${matchedRule.match_text}”).`,
        model: "saved_merchant_rule",
      },
    })
  }

  if (!getOpenRouterApiKey()) {
    return NextResponse.json(
      {
        error: "OPENROUTER_API_KEY is not set",
        configured: false,
        hint: "Add OPENROUTER_API_KEY to .env.local (see Open Router dashboard).",
      },
      { status: 503 }
    )
  }

  const userCategoryRules = categoryRules
    .filter((r) => !r.skip_sync)
    .map((r) => ({ match_text: r.match_text, category: r.category, type: r.type }))

  try {
    const suggestion = await classifyLedgerMovementWithOpenRouter({
      merchant: tx.merchant,
      subject,
      snippet,
      fromAddr,
      rawText: tx.raw_text,
      cardLastFour: tx.card_last_four as string | null,
      cardholderName: tx.cardholder_name as string | null,
      amount: Number(tx.amount),
      currency: String(tx.currency),
      currentType: String(tx.type),
      currentCategory: String(tx.category),
      userCategoryRules,
      allowedCategories: mergedCategorySlugs,
    })

    return NextResponse.json({ ok: true, suggestion })
  } catch (e) {
    console.error("[ledger/classify]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "classification_failed" },
      { status: 502 }
    )
  }
}
