import { NextResponse } from "next/server"
import { z } from "zod"
import { getApiUserClient } from "@/lib/ledger/supabase-admin"
import { isMissingLedgerTable } from "@/lib/ledger/supabase-errors"

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  balance_amount: z.number().finite().optional(),
  currency: z.string().min(3).max(8).optional(),
  kind: z.enum(["asset", "liability"]).optional(),
  source_goal_id: z.string().min(1).max(120).optional().nullable(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [ctx, { id }] = await Promise.all([getApiUserClient(request), params])
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (parsed.data.name !== undefined) patch.name = parsed.data.name.trim()
  if (parsed.data.balance_amount !== undefined) patch.balance_amount = parsed.data.balance_amount
  if (parsed.data.currency !== undefined) patch.currency = parsed.data.currency.toUpperCase()
  if (parsed.data.kind !== undefined) patch.kind = parsed.data.kind
  if (parsed.data.source_goal_id !== undefined) patch.source_goal_id = parsed.data.source_goal_id

  if (Object.keys(patch).length <= 1) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  const { data, error } = await ctx.db
    .from("ledger_vaults")
    .update(patch)
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .select()
    .maybeSingle()

  if (error) {
    if (isMissingLedgerTable(error)) {
      return NextResponse.json({ error: "Vaults table not installed" }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [ctx, { id }] = await Promise.all([getApiUserClient(request), params])
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { error } = await ctx.db.from("ledger_vaults").delete().eq("id", id).eq("user_id", ctx.userId)

  if (error) {
    if (isMissingLedgerTable(error)) {
      return NextResponse.json({ error: "Vaults table not installed" }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
