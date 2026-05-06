import { NextResponse } from "next/server"
import { z } from "zod"
import { getApiUserClient } from "@/lib/ledger/supabase-admin"
import { deriveMatchTextFromTransaction, normalizeRuleMatch } from "@/lib/ledger/category-rules-helpers"
import { isMissingLedgerTable } from "@/lib/ledger/supabase-errors"

const postSchema = z.object({
  match_text: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(64),
  type: z.enum(["income", "expense", "transfer", "refund", "unknown"]).optional().nullable(),
  skip_sync: z.boolean().optional(),
  /** When true, derive match_text from this ledger_transactions row (requires ownership). */
  from_transaction_id: z.string().min(1).optional(),
})

export async function GET(request: Request) {
  const ctx = await getApiUserClient(request)
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await ctx.db
    .from("category_rules")
    .select("id, match_text, category, type, skip_sync, created_at")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    if (isMissingLedgerTable(error)) {
      return NextResponse.json({ rules: [], error: "Ledger tables not installed" }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rules: data ?? [] })
}

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

  let matchText = parsed.data.match_text ? normalizeRuleMatch(parsed.data.match_text) : ""

  if (parsed.data.from_transaction_id) {
    const { data: tx, error: txErr } = await ctx.db
      .from("ledger_transactions")
      .select("merchant, raw_text")
      .eq("id", parsed.data.from_transaction_id)
      .eq("user_id", ctx.userId)
      .maybeSingle()

    if (txErr) {
      return NextResponse.json({ error: txErr.message }, { status: 500 })
    }
    if (!tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }
    matchText = deriveMatchTextFromTransaction(tx)
  }

  if (!matchText) {
    return NextResponse.json({ error: "match_text required or invalid transaction for derivation" }, { status: 400 })
  }

  const skip_sync = parsed.data.skip_sync ?? false
  const row = {
    user_id: ctx.userId,
    match_text: matchText,
    category: parsed.data.category,
    type: parsed.data.type ?? null,
    skip_sync,
  }

  const { data, error } = await ctx.db
    .from("category_rules")
    .upsert(row, { onConflict: "user_id,match_text" })
    .select()
    .single()

  if (error) {
    if (isMissingLedgerTable(error)) {
      return NextResponse.json({ error: "Ledger tables not installed" }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rule: data })
}
