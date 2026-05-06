import { NextResponse } from "next/server"
import { z } from "zod"
import {
  parseMonthlyObligationsPlan,
  type MonthlyObligationLine,
} from "@/lib/ledger/monthly-obligations-plan"
import { getApiUserClient } from "@/lib/ledger/supabase-admin"
import { isMissingLedgerTable } from "@/lib/ledger/supabase-errors"

export const dynamic = "force-dynamic"

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" } as const

const lineSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  amount: z.number().finite().min(0).max(1e14),
})

const putSchema = z.object({
  lines: z.array(lineSchema).max(48),
})

export async function GET(request: Request) {
  const ctx = await getApiUserClient(request)
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS })
  }

  const { data, error } = await ctx.db
    .from("ledger_settings")
    .select("preferred_fiat_currency, monthly_obligations_plan")
    .eq("user_id", ctx.userId)
    .maybeSingle()

  if (error) {
    if (isMissingLedgerTable(error)) {
      return NextResponse.json({ lines: [], primaryCurrency: null }, { headers: NO_STORE_HEADERS })
    }
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE_HEADERS })
  }

  const rawPlan = data?.monthly_obligations_plan
  const lines = parseMonthlyObligationsPlan(rawPlan)

  return NextResponse.json(
    {
      lines,
      primaryCurrency: data?.preferred_fiat_currency ?? null,
    },
    { headers: NO_STORE_HEADERS }
  )
}

export async function PUT(request: Request) {
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

  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const lines: MonthlyObligationLine[] = parsed.data.lines.map((l) => ({
    id: l.id.trim(),
    label: l.label.trim(),
    amount: l.amount,
  }))

  const iso = new Date().toISOString()

  const { data: existing } = await ctx.db
    .from("ledger_settings")
    .select("user_id")
    .eq("user_id", ctx.userId)
    .maybeSingle()

  if (existing) {
    const { error } = await ctx.db
      .from("ledger_settings")
      .update({
        monthly_obligations_plan: lines,
        updated_at: iso,
      })
      .eq("user_id", ctx.userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else {
    const { error } = await ctx.db.from("ledger_settings").insert({
      user_id: ctx.userId,
      monthly_obligations_plan: lines,
      updated_at: iso,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, lines }, { headers: NO_STORE_HEADERS })
}
