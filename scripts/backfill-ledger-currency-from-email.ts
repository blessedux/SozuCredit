/**
 * Re-run `parseHeuristicReceipt` on stored Gmail bodies and fix rows where the DB says USD but
 * heuristics now yield CLP (common false positive: "950 USD" tipo de cambio footers).
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm tsx scripts/backfill-ledger-currency-from-email.ts
 *
 * Env:
 *   DRY_RUN=1 — log only
 */

import { createClient } from "@supabase/supabase-js"
import { normalizeStoredEmailBodyText } from "../lib/gmail/extract-plain-text"
import { parseHeuristicReceipt } from "../lib/gmail/parse-heuristic"

type EmailSourceRow = {
  subject: string | null
  snippet: string | null
  raw_text: string | null
}

type TxRow = {
  id: string
  amount: number | string
  currency: string
  raw_text: string | null
  source_email_id: string | null
  email_sources: EmailSourceRow | EmailSourceRow[] | null
}

function unwrapSource(es: TxRow["email_sources"]): EmailSourceRow | null {
  if (!es) return null
  return Array.isArray(es) ? (es[0] ?? null) : es
}

function buildCombined(tx: TxRow): string {
  const src = unwrapSource(tx.email_sources)
  const fromSource = normalizeStoredEmailBodyText(src?.raw_text ?? "")
  const fromTx = normalizeStoredEmailBodyText(tx.raw_text ?? "")
  const body = fromSource.length >= fromTx.length ? fromSource : fromTx
  const snippet = (src?.snippet ?? "").trim()
  const subject = (src?.subject ?? "").trim()
  return [body, snippet, subject].filter(Boolean).join("\n")
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const dry = process.env.DRY_RUN === "1" || process.argv.includes("--dry-run")

  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
    process.exit(1)
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  const pageSize = 200
  let from = 0
  let examined = 0
  let corrected = 0
  let skipped = 0

  for (;;) {
    const { data, error } = await supabase
      .from("ledger_transactions")
      .select(
        `id, amount, currency, raw_text, source_email_id,
         email_sources ( subject, snippet, raw_text )`
      )
      .not("source_email_id", "is", null)
      .eq("currency", "USD")
      .order("date", { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) {
      console.error(error.message)
      process.exit(1)
    }

    const rows = (data ?? []) as TxRow[]
    if (rows.length === 0) break

    for (const tx of rows) {
      examined += 1
      const combined = buildCombined(tx)
      const flat = combined.replace(/\s+/g, " ")
      /** Avoid flipping real USD-only receipts; tipo-cambio bugs usually share a Chile `$ 22.000`-style amount or Detalle Comercio. */
      const hadChilePesoSyntax = /\$\s*\d{1,3}(?:\.\d{3})+(?:,\d+)?\b/.test(flat)
      const parsed = parseHeuristicReceipt(combined)
      if (
        parsed.currency !== "CLP" ||
        parsed.amount == null ||
        parsed.amount <= 0 ||
        (!hadChilePesoSyntax && !parsed.merchant?.trim())
      ) {
        skipped += 1
        continue
      }

      const patch = {
        currency: "CLP" as const,
        amount: parsed.amount,
      }

      if (dry) {
        console.log(
          `[dry-run] ${tx.id} USD ${tx.amount} -> CLP ${parsed.amount} (confidence ${parsed.confidence})`
        )
        corrected += 1
        continue
      }

      const { error: upErr } = await supabase.from("ledger_transactions").update(patch).eq("id", tx.id)
      if (upErr) {
        console.error(`update ${tx.id}:`, upErr.message)
        skipped += 1
        continue
      }
      corrected += 1
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  console.log(JSON.stringify({ dry, examined, corrected, skipped }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
