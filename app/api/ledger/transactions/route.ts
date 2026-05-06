import { NextResponse } from "next/server"
import { z } from "zod"
import { getApiUserClient } from "@/lib/ledger/supabase-admin"
import { isMissingLedgerTable } from "@/lib/ledger/supabase-errors"
import {
  enrichLedgerTransactionRow,
  type LedgerTransactionRowInput,
} from "@/lib/ledger/map-ledger-transaction"
import { ledgerWindowUtcBounds, type LedgerChartWindow } from "@/lib/ledger/ledger-chart-window"
import {
  fetchMergedIncomeCategories,
  fetchMergedLedgerCategories,
} from "@/lib/ledger/merged-categories"
import { DEFAULT_CATEGORIES, DEFAULT_INCOME_CATEGORIES, type LedgerTransactionType } from "@/lib/ledger/types"

export const dynamic = "force-dynamic"

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" } as const

const createSchema = z.object({
  date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  merchant: z.string().optional().nullable(),
  amount: z.number().positive(),
  currency: z.string().min(3).max(8),
  type: z.enum(["income", "expense", "transfer", "refund", "unknown"]),
  category: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  raw_text: z.string().optional().nullable(),
  /** Manual savings vault (e.g. Binance) when funds arrived from off-ramp — income/refund only. */
  source_vault_id: z.string().min(1).optional().nullable(),
})

export async function GET(request: Request) {
  const ctx = await getApiUserClient(request)
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get("limit")) || 100, 500)
  const rawCat = searchParams.get("category")?.trim().toLowerCase()
  const category =
    rawCat && /^[a-z0-9_]{1,64}$/.test(rawCat) ? rawCat : undefined

  const rawWin = searchParams.get("window")?.trim().toLowerCase()
  const chartWindow: LedgerChartWindow | undefined =
    rawWin === "month" || rawWin === "week" || rawWin === "day" ? rawWin : undefined

  let q = ctx.db
    .from("ledger_transactions")
    .select(
      `id, user_id, source_email_id, source_vault_id, date, merchant, merchant_legal, amount, currency, type, category, confidence, raw_text, created_at,
       card_last_four, cardholder_name,
       email_sources ( from_addr ),
       ledger_vaults ( id, name )`
    )
    .eq("user_id", ctx.userId)
    .is("dismissed_at", null)

  if (category) q = q.eq("category", category)

  if (chartWindow) {
    const { startIso, endIso } = ledgerWindowUtcBounds(chartWindow, new Date())
    q = q.gte("date", startIso).lte("date", endIso)
  }

  const { data, error } = await q.order("date", { ascending: false }).limit(limit)

  if (error) {
    if (isMissingLedgerTable(error)) {
      return NextResponse.json(
        { error: "Ledger tables not installed", transactions: [] },
        { status: 503, headers: NO_STORE_HEADERS }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE_HEADERS })
  }

  let categories: string[] = [...DEFAULT_CATEGORIES]
  let incomeCategories: string[] = [...DEFAULT_INCOME_CATEGORIES]
  try {
    categories = await fetchMergedLedgerCategories(ctx.db, ctx.userId)
  } catch {
    categories = [...DEFAULT_CATEGORIES]
  }
  try {
    incomeCategories = await fetchMergedIncomeCategories(ctx.db, ctx.userId)
  } catch {
    incomeCategories = [...DEFAULT_INCOME_CATEGORIES]
  }

  const transactions = (data ?? []).map((row) => enrichLedgerTransactionRow(row as LedgerTransactionRowInput))
  return NextResponse.json({ transactions, categories, incomeCategories }, { headers: NO_STORE_HEADERS })
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

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const vaultId = parsed.data.source_vault_id?.trim() || null
  if (vaultId) {
    if (parsed.data.type !== "income" && parsed.data.type !== "refund") {
      return NextResponse.json(
        { error: "source_vault_id solo aplica a ingresos o reembolsos" },
        { status: 400 }
      )
    }
    const { data: vault, error: vErr } = await ctx.db
      .from("ledger_vaults")
      .select("id")
      .eq("id", vaultId)
      .eq("user_id", ctx.userId)
      .maybeSingle()
    if (vErr) {
      return NextResponse.json({ error: vErr.message }, { status: 500 })
    }
    if (!vault) {
      return NextResponse.json({ error: "Vault no encontrado" }, { status: 400 })
    }
  }

  const dateIso =
    parsed.data.date.length === 10
      ? new Date(`${parsed.data.date}T12:00:00.000Z`).toISOString()
      : parsed.data.date

  const insert = {
    user_id: ctx.userId,
    source_email_id: null as string | null,
    source_vault_id: vaultId,
    date: dateIso,
    merchant: parsed.data.merchant ?? null,
    amount: parsed.data.amount,
    currency: parsed.data.currency.toUpperCase(),
    type: parsed.data.type as LedgerTransactionType,
    category: parsed.data.category,
    confidence: parsed.data.confidence ?? 1,
    raw_text: parsed.data.raw_text ?? null,
  }

  const { data, error } = await ctx.db
    .from("ledger_transactions")
    .insert(insert)
    .select(`*, ledger_vaults ( id, name ), email_sources ( from_addr )`)
    .single()

  if (error) {
    if (isMissingLedgerTable(error)) {
      return NextResponse.json(
        { error: "Ledger tables not installed", hint: "Apply email_ledger migration in Supabase" },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(enrichLedgerTransactionRow(data as LedgerTransactionRowInput))
}
