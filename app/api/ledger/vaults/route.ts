import { NextResponse } from "next/server"
import { z } from "zod"
import { getApiUserClient } from "@/lib/ledger/supabase-admin"
import { isMissingLedgerTable } from "@/lib/ledger/supabase-errors"

export const dynamic = "force-dynamic"

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" } as const

const createSchema = z.object({
  name: z.string().min(1).max(120),
  currency: z.string().min(3).max(8).optional().default("USDT"),
  balance_amount: z.number().finite().optional().default(0),
  /** Savings / wallets vs credit lines, loans, card balances owed */
  kind: z.enum(["asset", "liability"]).optional().default("asset"),
  /** Optional link to a Goals id (local) to prevent duplicates + enable syncing. */
  source_goal_id: z.string().min(1).max(120).optional().nullable(),
})

export async function GET(request: Request) {
  const ctx = await getApiUserClient(request)
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS })
  }

  const { data, error } = await ctx.db
    .from("ledger_vaults")
    .select("id, user_id, name, balance_amount, currency, kind, source_goal_id, created_at, updated_at")
    .eq("user_id", ctx.userId)
    .order("name", { ascending: true })

  if (error) {
    if (isMissingLedgerTable(error)) {
      return NextResponse.json({ vaults: [] }, { headers: NO_STORE_HEADERS })
    }
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE_HEADERS })
  }

  return NextResponse.json({ vaults: data ?? [] }, { headers: NO_STORE_HEADERS })
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

  const iso = new Date().toISOString()
  const insert = {
    user_id: ctx.userId,
    name: parsed.data.name.trim(),
    balance_amount: parsed.data.balance_amount,
    currency: parsed.data.currency.toUpperCase(),
    kind: parsed.data.kind,
    source_goal_id: parsed.data.source_goal_id ?? null,
    created_at: iso,
    updated_at: iso,
  }

  const { data, error } = await ctx.db.from("ledger_vaults").insert(insert).select().single()

  if (error) {
    if (isMissingLedgerTable(error)) {
      return NextResponse.json(
        { error: "Vaults table not installed", hint: "Apply ledger_vaults migration in Supabase" },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
