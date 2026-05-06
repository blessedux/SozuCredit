import { readFileSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"
import {
  buildLedgerClassificationHaystack,
  getBuiltinCategoryHintsCheatsheet,
  matchBuiltinCategoryHint,
} from "@/lib/ledger/builtin-category-hints"
import { DEFAULT_CATEGORIES, DEFAULT_INCOME_CATEGORIES, type LedgerTransactionType } from "@/lib/ledger/types"

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

/** Expense + income default slugs for coercion when no merged list is passed. */
const DEFAULT_LEDGER_CATEGORY_SET = new Set<string>([
  ...(DEFAULT_CATEGORIES as readonly string[]),
  ...(DEFAULT_INCOME_CATEGORIES as readonly string[]),
])

const outputSchema = z.object({
  type: z.enum(["income", "expense", "transfer", "refund", "unknown"]),
  category: z.string(),
  is_financial_transaction: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason_one_line: z.string().max(900),
})

export function getOpenRouterApiKey(): string | undefined {
  const k = process.env.OPENROUTER_API_KEY?.trim()
  return k || undefined
}

export function getOpenRouterModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || "google/gemma-2-9b-it:free"
}

export function coerceLedgerCategory(
  raw: string,
  allowedSet: ReadonlySet<string> = DEFAULT_LEDGER_CATEGORY_SET
): string {
  const c = raw.trim().toLowerCase().replace(/\s+/g, "_")
  if (allowedSet.has(c)) return c
  const stripped = c.replace(/[^a-z0-9_]/g, "")
  if (allowedSet.has(stripped)) return stripped
  return "unknown"
}

let merchantCategorizationRulesMarkdownCache: string | undefined

/**
 * Loads `lib/ledger/merchant-categorization-llm-rules.md` from the app cwd (Next.js / Node).
 * Agents: canonical copy lives in that file; see `.cursor/skills/ledger-merchant-categorization/`.
 */
export function loadMerchantCategorizationLlmRulesFromDisk(): string {
  if (merchantCategorizationRulesMarkdownCache !== undefined) {
    return merchantCategorizationRulesMarkdownCache
  }
  try {
    merchantCategorizationRulesMarkdownCache = readFileSync(
      join(process.cwd(), "lib/ledger/merchant-categorization-llm-rules.md"),
      "utf8"
    )
  } catch {
    merchantCategorizationRulesMarkdownCache = ""
  }
  return merchantCategorizationRulesMarkdownCache
}

function extractJsonObject(text: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  const slice = (fenced?.[1] ?? text).trim()
  const start = slice.indexOf("{")
  const end = slice.lastIndexOf("}")
  if (start === -1 || end <= start) return null
  return slice.slice(start, end + 1)
}

export type ClassifyMovementInput = {
  merchant: string | null
  subject?: string | null
  fromAddr?: string | null
  snippet?: string | null
  rawText?: string | null
  cardLastFour?: string | null
  cardholderName?: string | null
  amount: number
  currency: string
  currentType: string
  currentCategory: string
  /** User-saved merchant shortcuts (sync uses substring match; model should prefer these when text matches). */
  userCategoryRules?: readonly { match_text: string; category: string; type?: string | null }[]
  /** Defaults + user custom categories (dropdown); extends the model closed set and coercion. */
  allowedCategories?: readonly string[]
}

export type ClassifyMovementResult = {
  type: LedgerTransactionType
  category: string
  is_financial_transaction: boolean
  confidence: number
  reason_one_line: string
  model: string
}

export async function classifyLedgerMovementWithOpenRouter(
  input: ClassifyMovementInput
): Promise<ClassifyMovementResult> {
  const apiKey = getOpenRouterApiKey()
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set")
  }

  const allowedSet =
    input.allowedCategories && input.allowedCategories.length > 0
      ? new Set(input.allowedCategories)
      : DEFAULT_LEDGER_CATEGORY_SET

  const categories = [...allowedSet].sort((a, b) => a.localeCompare(b)).join(", ")
  const haystack = buildLedgerClassificationHaystack({
    merchant: input.merchant,
    subject: input.subject,
    snippet: input.snippet,
    rawText: input.rawText,
    fromAddr: input.fromAddr,
    cardLastFour: input.cardLastFour,
    cardholderName: input.cardholderName,
  })
  const builtinHit = matchBuiltinCategoryHint(haystack)
  const cheatsheet = getBuiltinCategoryHintsCheatsheet()

  const bodyText = [
    input.subject && `Subject: ${input.subject}`,
    input.fromAddr && `From: ${input.fromAddr}`,
    input.snippet && `Snippet: ${input.snippet}`,
    input.rawText && `Body excerpt: ${input.rawText.slice(0, 6_000)}`,
  ]
    .filter(Boolean)
    .join("\n")

  const hintLine = builtinHit
    ? `Strong substring hint from curated rules: "${builtinHit.match_text}" suggests category "${builtinHit.category}" (still verify against email meaning).`
    : "No curated substring hint matched beyond heuristics."

  const cheatsheetBlock = builtinHit
    ? ""
    : `\nPhrase mapping reference (Spanish/Latin America + common SaaS; apply when text clearly matches):\n${cheatsheet}\n`

  const userRules = input.userCategoryRules ?? []
  const userRulesSorted = [...userRules].sort((a, b) => b.match_text.length - a.match_text.length).slice(0, 40)
  const userRulesBlock =
    userRulesSorted.length === 0
      ? ""
      : `\nUser-defined merchant shortcuts (if merchant, subject, body, or sender clearly contains the phrase — same spelling not required if obvious match — use that category and optional type):\n${userRulesSorted
          .map((r) => {
            const t = r.type ? `, type ${r.type}` : ""
            return `- "${r.match_text}" → category ${r.category}${t}`
          })
          .join("\n")}\n`

  const paymentMetaLines = [
    input.cardLastFour && `- card_last_four: ${input.cardLastFour}`,
    input.cardholderName && `- cardholder_on_card: ${input.cardholderName}`,
  ]
    .filter(Boolean)
    .join("\n")

  const merchantNamingMd = loadMerchantCategorizationLlmRulesFromDisk().trim()
  const merchantNamingBlock = merchantNamingMd
    ? `\nMerchant naming conventions (project policy — apply when merchant/title or receipt text matches; grocer vs café vs corner store):\n${merchantNamingMd.slice(0, 4_000)}\n`
    : ""

  const userPrompt = `You classify bank/email ledger movements for a personal finance app.

Movement summary:
- merchant_or_title: ${input.merchant ?? "(none)"}
${paymentMetaLines ? `${paymentMetaLines}\n` : ""}- amount: ${input.amount} ${input.currency}
- heuristic_type: ${input.currentType}
- heuristic_category: ${input.currentCategory}

Email context:
${bodyText || "(no extra email context)"}
${cheatsheetBlock}${userRulesBlock}
Active hint for THIS email:
${hintLine}
${merchantNamingBlock}
Rules:
1. Decide if this is a REAL financial movement (purchase, charge, income, refund) vs marketing/promotional/spam that only mentions amounts.
2. Pick type: income | expense | transfer | refund | unknown
3. Pick category from this closed set only: ${categories}
4. When a curated hint clearly matches the purchase (e.g. farmacia→health, minimarket→food), prefer that category unless the email contradicts it.
5. When a user-defined merchant shortcut clearly matches, prefer that category (and type if given) over generic guesses — user shortcuts override generic templates unless the email contradicts them.
6. Apply merchant naming conventions above when they disambiguate (e.g. corner minimarket vs supermarket chain; café in merchant name → food).
7. confidence: 0-1 how sure you are.

Reply with ONE JSON object only, no markdown, keys:
{"type":"...","category":"...","is_financial_transaction":true/false,"confidence":0.0,"reason_one_line":"..."}`

  const model = getOpenRouterModel()
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000",
      "X-Title": "Sozu Credit Ledger",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You output only valid minified JSON objects. Never include trailing commentary.",
        },
        { role: "user", content: userPrompt },
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

  let parsed: z.infer<typeof outputSchema>
  try {
    parsed = outputSchema.parse(JSON.parse(jsonStr))
  } catch {
    throw new Error("Model JSON failed validation")
  }

  const category = coerceLedgerCategory(parsed.category, allowedSet)
  const type = parsed.type as LedgerTransactionType

  return {
    type,
    category,
    is_financial_transaction: parsed.is_financial_transaction,
    confidence: parsed.confidence,
    reason_one_line: parsed.reason_one_line.trim(),
    model,
  }
}
