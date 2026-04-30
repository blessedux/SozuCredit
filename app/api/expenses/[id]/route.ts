import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"

const updateExpenseSchema = z.object({
  amount: z.number().positive().optional(),
  currency: z.string().min(1).optional(),
  merchant: z.string().optional(),
  category_id: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().optional(),
})

async function getUserId(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) return user.id
  return request.headers.get("x-user-id")
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(request)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("expenses")
    .select("id, amount, currency, merchant, category_id, expense_date, note, source, created_at, updated_at")
    .eq("id", id)
    .eq("user_id", userId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(data)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(request)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = updateExpenseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = await createClient()
    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (parsed.data.amount != null) updatePayload.amount = parsed.data.amount
    if (parsed.data.currency != null) updatePayload.currency = parsed.data.currency
    if (parsed.data.merchant !== undefined) updatePayload.merchant = parsed.data.merchant
    if (parsed.data.category_id != null) updatePayload.category_id = parsed.data.category_id
    if (parsed.data.date != null) updatePayload.expense_date = parsed.data.date
    if (parsed.data.note !== undefined) updatePayload.note = parsed.data.note

    const { data, error } = await supabase
    .from("expenses")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(_request)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const supabase = await createClient()
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return new NextResponse(null, { status: 204 })
}
