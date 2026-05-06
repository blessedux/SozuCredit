import type { SupabaseClient } from "@supabase/supabase-js"
import { parseHeuristicReceipt } from "@/lib/gmail/parse-heuristic"

const MAX_LEGAL_LEN = 200
const MAX_DISPLAY_LEN = 200

/** Stable key for matching bank "razón social" across casing / Unicode quirks. */
export function merchantLegalKey(raw: string): string {
  return raw.normalize("NFKC").trim().toLowerCase().slice(0, MAX_LEGAL_LEN)
}

export function trimMerchantLegal(raw: string | null | undefined): string | null {
  const t = raw?.normalize("NFKC").trim()
  if (!t) return null
  return t.slice(0, MAX_LEGAL_LEN)
}

export function trimDisplayName(raw: string | null | undefined): string | null {
  const t = raw?.normalize("NFKC").trim()
  if (!t) return null
  return t.slice(0, MAX_DISPLAY_LEN)
}

export function resolveMerchantLegalFromTx(tx: {
  merchant_legal?: string | null
  raw_text?: string | null
}): string | null {
  const stored = trimMerchantLegal(tx.merchant_legal ?? null)
  if (stored) return stored
  const body = tx.raw_text?.trim()
  if (!body) return null
  const parsed = parseHeuristicReceipt(body)
  return trimMerchantLegal(parsed.merchant)
}

export async function fetchMerchantAliasMap(
  db: SupabaseClient,
  userId: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const { data, error } = await db
    .from("ledger_merchant_aliases")
    .select("legal_key, display_name")
    .eq("user_id", userId)
    .limit(2000)

  if (error || !data) return map
  for (const row of data as { legal_key: string; display_name: string }[]) {
    const k = row.legal_key?.trim()
    const d = row.display_name?.trim()
    if (k && d) map.set(k, d.slice(0, MAX_DISPLAY_LEN))
  }
  return map
}

export function resolveMerchantDisplayName(
  legal: string | null,
  aliasMap: Map<string, string>,
  fallbackNoLegal: string
): { merchant: string; merchant_legal: string | null } {
  const trimmedLegal = trimMerchantLegal(legal)
  if (!trimmedLegal) {
    return { merchant: fallbackNoLegal.slice(0, MAX_DISPLAY_LEN), merchant_legal: null }
  }
  const key = merchantLegalKey(trimmedLegal)
  const aliased = aliasMap.get(key)
  return {
    merchant: trimDisplayName(aliased) ?? trimmedLegal,
    merchant_legal: trimmedLegal,
  }
}
