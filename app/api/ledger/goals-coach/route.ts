import { NextResponse } from "next/server"
import { z } from "zod"
import { getApiUserClient } from "@/lib/ledger/supabase-admin"
import { runGoalsCoachOpenRouter } from "@/lib/ledger/goals-coach-openrouter"
import { getOpenRouterApiKey } from "@/lib/ledger/openrouter-classify"

export const dynamic = "force-dynamic"

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(12_000),
})

const ledgerCtxSchema = z.object({
  primaryCurrency: z.string().min(1).max(12),
  incomeThisMonth: z.number().finite(),
  expensesThisMonth: z.number().finite(),
  netCashflow: z.number().finite(),
})

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(24),
  ledgerContext: ledgerCtxSchema.nullable().optional(),
  currentDraftSummary: z.string().max(4000).nullable().optional(),
})

export async function POST(request: Request) {
  const ctx = await getApiUserClient(request)
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: z.infer<typeof bodySchema>
  try {
    const raw = await request.json()
    body = bodySchema.parse(raw)
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  if (!getOpenRouterApiKey()) {
    return NextResponse.json(
      {
        error: "Goals coach is not configured (missing OPENROUTER_API_KEY).",
        hint: "Agregá OPENROUTER_API_KEY en el entorno del servidor para habilitar el asistente.",
      },
      { status: 503 }
    )
  }

  try {
    const out = await runGoalsCoachOpenRouter({
      messages: body.messages,
      ledgerContext: body.ledgerContext ?? null,
      currentDraftSummary: body.currentDraftSummary ?? null,
    })
    return NextResponse.json(out)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Coach error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
