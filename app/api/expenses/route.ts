import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"

const createExpenseSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(1).default("CLP"),
  merchant: z.string().optional(),
  category_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().optional(),
  source: z.enum(["manual", "ocr", "bank_sync"]).optional().default("manual"),
})

async function getUserId(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) return user.id
  const devUserId = request.headers.get("x-user-id")
  return devUserId
}

export async function GET(request: Request) {
  const userId = await getUserId(request)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const category_id = searchParams.get("category_id")
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200)

  const supabase = await createClient()
  let q = supabase
    .from("expenses")
    .select("id, amount, currency, merchant, category_id, expense_date, note, source, created_at, updated_at")
    .eq("user_id", userId)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)

  if (from) q = q.gte("expense_date", from)
  if (to) q = q.lte("expense_date", to)
  if (category_id) q = q.eq("category_id", category_id)

  const { data, error } = await q

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const userId = await getUserId(request)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = createExpenseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      user_id: userId,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      merchant: parsed.data.merchant ?? null,
      category_id: parsed.data.category_id,
      expense_date: parsed.data.date,
      note: parsed.data.note ?? null,
      source: parsed.data.source,
      updated_at: new Date().toISOString(),
    })
    .select("id, amount, currency, merchant, category_id, expense_date, note, source, created_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
