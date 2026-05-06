/**
 * One-time backfill: set `ledger_transactions.merchant` (and optional card meta)
 * from stored email body using the same heuristics as Gmail sync (`parseHeuristicReceipt`).
 *
 * Requires service role (bypasses RLS):
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm tsx scripts/backfill-ledger-email-merchant.ts
 *
 * Options (env):
 *   DRY_RUN=1           — log only, no updates
 *   BACKFILL_MERCHANT_ALL=1 — update whenever body parses a commerce name (may overwrite manual edits)
 *
 * Default: only updates merchant when we extract "Detalle Comercio …" AND the row still looks
 * like the subject line was used (empty merchant or merchant === email subject, case-insensitive).
 *
 * Note: If `email_sources.raw_text` never contained the HTML/plain body (very old syncs), extraction
 * may still fail until you re-sync from Gmail.
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
  merchant: string | null
  card_last_four: string | null
  cardholder_name: string | null
  raw_text: string | null
  source_email_id: string | null
  email_sources: EmailSourceRow | EmailSourceRow[] | null
}

function unwrapSource(es: TxRow["email_sources"]): EmailSourceRow | null {
  if (!es) return null
  return Array.isArray(es) ? (es[0] ?? null) : es
}

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().replace(/\s+/g, " ")
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

function shouldUpdateMerchant(
  current: string | null,
  subject: string | null,
  extracted: string | null,
  all: boolean
): boolean {
  if (!extracted?.trim()) return false
  const e = extracted.trim()
  if (all) return norm(current) !== norm(e)
  const cur = norm(current)
  const sub = norm(subject)
  if (!cur) return true
  if (sub && cur.toLowerCase() === sub.toLowerCase()) return true
  return false
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const dry = process.env.DRY_RUN === "1" || process.argv.includes("--dry-run")
  const all = process.env.BACKFILL_MERCHANT_ALL === "1"

  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
    process.exit(1)
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  const pageSize = 200
  let from = 0
  let updated = 0
  let skipped = 0
  let examined = 0
  let noExtract = 0

  for (;;) {
    const { data, error } = await supabase
      .from("ledger_transactions")
      .select(
        `id, merchant, card_last_four, cardholder_name, raw_text, source_email_id,
         email_sources ( subject, snippet, raw_text )`
      )
      .not("source_email_id", "is", null)
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
      const src = unwrapSource(tx.email_sources)
      const combined = buildCombined(tx)
      const parsed = parseHeuristicReceipt(combined)
      const commerce = parsed.merchant?.trim() || null

      if (!commerce) {
        noExtract += 1
        skipped += 1
        continue
      }

      const subject = src?.subject ?? null
      if (!shouldUpdateMerchant(tx.merchant, subject, commerce, all)) {
        skipped += 1
        continue
      }

      const patch: Record<string, unknown> = {
        merchant: commerce.slice(0, 200),
      }
      if (!tx.card_last_four && parsed.card_last_four) {
        patch.card_last_four = parsed.card_last_four
      }
      if (!tx.cardholder_name && parsed.cardholder_name) {
        patch.cardholder_name = parsed.cardholder_name
      }

      if (dry) {
        console.log(`[dry-run] ${tx.id} merchant "${norm(tx.merchant)}" -> "${commerce}"`)
        updated += 1
        continue
      }

      const { error: upErr } = await supabase.from("ledger_transactions").update(patch).eq("id", tx.id)
      if (upErr) {
        console.error(`update ${tx.id}:`, upErr.message)
        skipped += 1
        continue
      }
      updated += 1
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  console.log(
    JSON.stringify(
      {
        dry,
        all,
        examined,
        updated,
        skipped,
        noCommerceExtract: noExtract,
      },
      null,
      2
    )
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
