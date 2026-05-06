import { z } from "zod"
import { getOpenRouterApiKey, getOpenRouterModel } from "@/lib/ledger/openrouter-classify"

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

function extractJsonObject(text: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  const slice = (fenced?.[1] ?? text).trim()
  const start = slice.indexOf("{")
  const end = slice.lastIndexOf("}")
  if (start === -1 || end <= start) return null
  return slice.slice(start, end + 1)
}

const milestoneSchema = z.object({
  label: z.string().min(1).max(200),
  due_date_iso: z.string().max(32).nullable().optional(),
  amount: z.number().finite().nullable().optional(),
})

export const goalsCoachSuggestedGoalSchema = z.object({
  goal_type: z.enum(["pay_debt", "save_amount", "specific"]),
  title: z.string().min(1).max(200),
  target_amount: z.number().finite().nullable().optional(),
  currency: z.string().min(1).max(12),
  target_date_iso: z.string().max(32).nullable().optional(),
  milestones: z.array(milestoneSchema).max(12),
  why_achievable_one_line: z.string().max(500),
})

const coachOutputSchema = z.object({
  assistant_message: z.string().min(1).max(8000),
  follow_up_chips: z.array(z.string().min(1).max(120)).max(6).optional(),
  suggested_goal: goalsCoachSuggestedGoalSchema.nullable().optional(),
})

export type GoalsCoachChatMessage = { role: "user" | "assistant"; content: string }

export type GoalsCoachLedgerContext = {
  primaryCurrency: string
  incomeThisMonth: number
  expensesThisMonth: number
  netCashflow: number
}

export type GoalsCoachSuggestedGoal = z.infer<typeof goalsCoachSuggestedGoalSchema>

export type GoalsCoachResult = {
  assistant_message: string
  follow_up_chips: string[]
  suggested_goal: GoalsCoachSuggestedGoal | null
  model: string
}

export async function runGoalsCoachOpenRouter(input: {
  messages: GoalsCoachChatMessage[]
  ledgerContext: GoalsCoachLedgerContext | null
  currentDraftSummary: string | null
}): Promise<GoalsCoachResult> {
  const apiKey = getOpenRouterApiKey()
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set")
  }

  const model = getOpenRouterModel()
  const trimmed = input.messages.slice(-14)

  const ctxBlock = input.ledgerContext
    ? `Resumen del libro (UTC mes actual, moneda principal ${input.ledgerContext.primaryCurrency}):
- Ingresos: ${input.ledgerContext.incomeThisMonth}
- Gastos: ${input.ledgerContext.expensesThisMonth}
- Flujo neto estimado: ${input.ledgerContext.netCashflow}
No inventes otros montos: si el usuario no los dio, pedilos o usá solo estos.`
    : "No hay resumen de libro en esta sesión (el usuario puede cargarlo más tarde)."

  const draftBlock = input.currentDraftSummary?.trim()
    ? `Borrador actual del formulario (puede estar incompleto):\n${input.currentDraftSummary.trim()}`
    : "Todavía no hay borrador en el formulario."

  const system = `Sos un coach financiero personal para SozuCredit (usuario hispanohablante, Chile/LATAM común).
Tu trabajo: ayudar a definir metas realistas (pagar deuda, ahorrar monto, u objetivo concreto) con hitos y plazos.
Estilo: empático, directo, sin jerga innecesaria. Hacé 1–3 preguntas claras por turno cuando falte información.
Reglas:
- No des asesoramiento legal/tributario específico; podés mencionar que conviene validar con un profesional.
- Si el resumen del libro existe, usalo para anclar plazos y montos (ej. ahorro mensual plausible vs flujo neto).
- Cuando tengas suficiente información para una meta SMART, podés incluir suggested_goal con milestones ordenados.
- assistant_message siempre en español. follow_up_chips: frases cortas que el usuario pueda tocar para responder (opcional).
- Respondé con UN solo objeto JSON (sin markdown), claves exactas:
{"assistant_message":"...","follow_up_chips":["..."],"suggested_goal":null o objeto con goal_type pay_debt|save_amount|specific, title, target_amount (número o null), currency, target_date_iso (YYYY-MM-DD o null), milestones[{label, due_date_iso|null, amount|null}], why_achievable_one_line}
- suggested_goal solo cuando el usuario haya dado o confirmado montos/plazos razonables; si no, null.`

  const userPrefix = `${ctxBlock}\n\n${draftBlock}\n\nHistorial reciente (últimos mensajes):`

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000",
      "X-Title": "Sozu Credit Goals Coach",
    },
    body: JSON.stringify({
      model,
      temperature: 0.45,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `${userPrefix}\n${JSON.stringify(trimmed)}`,
        },
      ],
    }),
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`OpenRouter ${res.status}: ${t.slice(0, 400)}`)
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = json.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error("OpenRouter returned empty content")

  const jsonStr = extractJsonObject(content)
  if (!jsonStr) throw new Error("Could not parse JSON from model output")

  let parsed: z.infer<typeof coachOutputSchema>
  try {
    parsed = coachOutputSchema.parse(JSON.parse(jsonStr))
  } catch {
    throw new Error("Model JSON failed validation")
  }

  return {
    assistant_message: parsed.assistant_message.trim(),
    follow_up_chips: parsed.follow_up_chips ?? [],
    suggested_goal: parsed.suggested_goal ?? null,
    model,
  }
}
