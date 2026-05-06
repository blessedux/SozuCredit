import type { SupabaseClient } from "@supabase/supabase-js"
import { getValidGmailAccessToken } from "@/lib/gmail/access-token"
import { extractPlainTextFromGmailPayload, getHeader } from "@/lib/gmail/extract-plain-text"
import { parseHeuristicReceipt } from "@/lib/gmail/parse-heuristic"
import { GMAIL_SYNC_LIST_QUERY } from "@/lib/gmail/sync-query"
import { matchBuiltinCategoryHint } from "@/lib/ledger/builtin-category-hints"
import { fetchCategoryRulesForUser, findRuleForHaystack } from "@/lib/ledger/category-rules-helpers"
import { fetchMerchantAliasMap, resolveMerchantDisplayName } from "@/lib/ledger/merchant-alias"
import type { LedgerTransactionType } from "@/lib/ledger/types"

/** Gmail returns newest-first; without paging we only ever see this many freshest threads — older mail never syncs. */
const LIST_PAGE_SIZE = Math.min(
  500,
  Math.max(10, Number(process.env.GMAIL_SYNC_LIST_PAGE_SIZE?.trim()) || 100)
)
/** Total IDs to pull per sync (across pages). Raise via env if April/backfill misses emails (heavy mailboxes). */
const MAX_MESSAGES_PER_SYNC = Math.min(
  2500,
  Math.max(25, Number(process.env.GMAIL_SYNC_MAX_MESSAGES?.trim()) || 500)
)

/** Parallel Gmail message.get + DB writes per batch (bounded to reduce rate-limit bursts). */
const SYNC_CONCURRENCY = Math.min(
  20,
  Math.max(1, Number(process.env.GMAIL_SYNC_CONCURRENCY?.trim()) || 8)
)

type GmailListResponse = { messages?: { id: string; threadId?: string }[]; nextPageToken?: string }

export type GmailSyncResult = {
  ok: boolean
  scanned: number
  upsertedSources: number
  createdTransactions: number
  /** Message IDs matched the Gmail query (after paging cap). */
  listedMessages: number
  /** True if Gmail reported another page but we stopped at GMAIL_SYNC_MAX_MESSAGES. */
  listTruncated: boolean
  errors: string[]
}

async function gmailFetch<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 0 },
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Gmail ${path} → ${res.status}: ${t.slice(0, 180)}`)
  }
  return res.json() as Promise<T>
}

export async function runGmailSync(ctx: { db: SupabaseClient; userId: string }): Promise<GmailSyncResult> {
  const errors: string[] = []
  let scanned = 0
  let upsertedSources = 0
  let createdTransactions = 0

  const { data: conn, error: connErr } = await ctx.db
    .from("gmail_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", ctx.userId)
    .maybeSingle()

  if (connErr) {
    errors.push(connErr.message)
    return {
      ok: false,
      scanned: 0,
      upsertedSources: 0,
      createdTransactions: 0,
      listedMessages: 0,
      listTruncated: false,
      errors,
    }
  }
  if (!conn) {
    errors.push("no_gmail_connection")
    return {
      ok: false,
      scanned: 0,
      upsertedSources: 0,
      createdTransactions: 0,
      listedMessages: 0,
      listTruncated: false,
      errors,
    }
  }

  let accessToken: string
  try {
    accessToken = await getValidGmailAccessToken(ctx.db, ctx.userId, {
      access_token: conn.access_token,
      refresh_token: conn.refresh_token,
      expires_at: conn.expires_at,
    })
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "token_error")
    return {
      ok: false,
      scanned: 0,
      upsertedSources: 0,
      createdTransactions: 0,
      listedMessages: 0,
      listTruncated: false,
      errors,
    }
  }

  const q = encodeURIComponent(GMAIL_SYNC_LIST_QUERY)
  const ids: string[] = []
  let pageToken: string | undefined
  let listTruncated = false
  try {
    do {
      const path =
        `users/me/messages?maxResults=${LIST_PAGE_SIZE}&q=${q}` +
        (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "")
      const list = await gmailFetch<GmailListResponse>(path, accessToken)
      for (const m of list.messages ?? []) {
        if (m.id) ids.push(m.id)
      }
      pageToken = list.nextPageToken ?? undefined
      if (ids.length >= MAX_MESSAGES_PER_SYNC) {
        listTruncated = Boolean(pageToken)
        break
      }
    } while (pageToken)
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "list_error")
    return {
      ok: false,
      scanned: 0,
      upsertedSources: 0,
      createdTransactions: 0,
      listedMessages: 0,
      listTruncated: false,
      errors,
    }
  }

  const cappedIds = ids.slice(0, MAX_MESSAGES_PER_SYNC)
  const listedMessages = cappedIds.length

  let categoryRules: Awaited<ReturnType<typeof fetchCategoryRulesForUser>> = []
  try {
    categoryRules = await fetchCategoryRulesForUser(ctx.db, ctx.userId)
  } catch {
    categoryRules = []
  }

  let merchantAliases = new Map<string, string>()
  try {
    merchantAliases = await fetchMerchantAliasMap(ctx.db, ctx.userId)
  } catch {
    merchantAliases = new Map()
  }

  const allowedRuleTypes = new Set<string>(["income", "expense", "transfer", "refund", "unknown"])

  type MsgPayload = {
    id: string
    threadId?: string
    internalDate?: string
    snippet?: string
    payload?: { headers?: { name: string; value: string }[]; mimeType?: string; body?: { data?: string }; parts?: unknown[] }
  }

  async function processMessage(id: string): Promise<{
    scanned: number
    upserted: number
    created: number
    errs: string[]
  }> {
    const localErrs: string[] = []
    try {
      const msg = await gmailFetch<MsgPayload>(
        `users/me/messages/${encodeURIComponent(id)}?format=full`,
        accessToken
      )

      const headers = msg.payload?.headers
      const fromAddr = getHeader(headers, "From")
      const subject = getHeader(headers, "Subject")
      const plain = msg.payload ? extractPlainTextFromGmailPayload(msg.payload as never) : ""
      const snippet = msg.snippet ?? ""
      // Body first so "Detalle Comercio …" and amounts win over subject (often a generic title).
      const combined = `${plain}\n${snippet}\n${subject ?? ""}`
      const receivedAt = msg.internalDate
        ? new Date(Number(msg.internalDate)).toISOString()
        : new Date().toISOString()

      const { data: srcRow, error: srcErr } = await ctx.db
        .from("email_sources")
        .upsert(
          {
            user_id: ctx.userId,
            gmail_message_id: msg.id,
            thread_id: msg.threadId ?? null,
            from_addr: fromAddr,
            subject,
            snippet,
            received_at: receivedAt,
            raw_text: plain.slice(0, 120_000) || null,
            processed_at: new Date().toISOString(),
          },
          { onConflict: "gmail_message_id" }
        )
        .select("id")
        .maybeSingle()

      let sourceId = srcRow?.id as string | undefined
      if (srcErr || !sourceId) {
        const { data: existing } = await ctx.db
          .from("email_sources")
          .select("id")
          .eq("gmail_message_id", msg.id)
          .maybeSingle()
        sourceId = existing?.id as string | undefined
      }
      if (!sourceId) {
        localErrs.push(`source:${id}:${srcErr?.message ?? "no_row"}`)
        return { scanned: 1, upserted: 0, created: 0, errs: localErrs }
      }

      const { data: existingTx } = await ctx.db
        .from("ledger_transactions")
        .select("id")
        .eq("source_email_id", sourceId)
        .maybeSingle()

      if (existingTx) {
        return { scanned: 1, upserted: 1, created: 0, errs: localErrs }
      }

      const parsed = parseHeuristicReceipt(combined)
      if (parsed.amount === null || parsed.amount <= 0) {
        return { scanned: 1, upserted: 1, created: 0, errs: localErrs }
      }

      // Include parsed merchant so substring rules (café, minimarket, etc.) match bank "Detalle Comercio" lines.
      const categoryHaystack = [combined, parsed.merchant].filter(Boolean).join("\n")

      const rule = findRuleForHaystack(categoryRules, categoryHaystack)
      if (rule?.skip_sync) {
        return { scanned: 1, upserted: 1, created: 0, errs: localErrs }
      }

      let category = "unknown"
      let txType: LedgerTransactionType = parsed.type === "income" ? "income" : "expense"
      let confidence = parsed.confidence

      if (rule && !rule.skip_sync) {
        category = rule.category
        if (rule.type && allowedRuleTypes.has(rule.type)) {
          txType = rule.type as LedgerTransactionType
        }
        confidence = Math.min(1, Math.max(confidence, 0.92))
      } else {
        const builtin = matchBuiltinCategoryHint(categoryHaystack)
        if (builtin) {
          category = builtin.category
          if (builtin.type && allowedRuleTypes.has(builtin.type)) {
            txType = builtin.type as LedgerTransactionType
          }
          confidence = Math.min(1, Math.max(confidence, 0.82))
        }
      }

      const fallbackTitle = (parsed.merchant || subject || snippet || "Email receipt").trim().slice(0, 200)
      const parsedLegal = parsed.merchant?.trim() ? parsed.merchant.trim().slice(0, 200) : null
      const { merchant, merchant_legal } = resolveMerchantDisplayName(
        parsedLegal,
        merchantAliases,
        fallbackTitle
      )
      const { error: txErr } = await ctx.db.from("ledger_transactions").insert({
        user_id: ctx.userId,
        source_email_id: sourceId,
        date: receivedAt,
        merchant,
        merchant_legal,
        amount: parsed.amount,
        currency: parsed.currency,
        type: txType,
        category,
        confidence,
        card_last_four: parsed.card_last_four,
        cardholder_name: parsed.cardholder_name,
        raw_text: plain.slice(0, 8000) || snippet.slice(0, 8000) || null,
      })

      if (txErr) {
        localErrs.push(`tx:${id}:${txErr.message}`)
        return { scanned: 1, upserted: 1, created: 0, errs: localErrs }
      }
      return { scanned: 1, upserted: 1, created: 1, errs: localErrs }
    } catch (e) {
      localErrs.push(`${id}:${e instanceof Error ? e.message : "err"}`)
      return { scanned: 1, upserted: 0, created: 0, errs: localErrs }
    }
  }

  for (let i = 0; i < cappedIds.length; i += SYNC_CONCURRENCY) {
    const chunk = cappedIds.slice(i, i + SYNC_CONCURRENCY)
    const batch = await Promise.all(chunk.map((id) => processMessage(id)))
    for (const r of batch) {
      scanned += r.scanned
      upsertedSources += r.upserted
      createdTransactions += r.created
      errors.push(...r.errs)
    }
  }

  await ctx.db
    .from("gmail_connections")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("user_id", ctx.userId)

  return {
    ok: true,
    scanned,
    upsertedSources,
    createdTransactions,
    listedMessages,
    listTruncated,
    errors,
  }
}
