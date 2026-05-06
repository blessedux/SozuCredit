import { NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { runGmailSync, type GmailSyncResult } from "@/lib/gmail/run-sync"

export const dynamic = "force-dynamic"

/** Long-running when many users link Gmail (Vercel Pro / Fluid). */
export const maxDuration = 300

const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const

/**
 * Background Gmail → ledger sync for all linked accounts.
 *
 * Schedule (e.g. every 30m) via Vercel Cron (`vercel.json`) or any HTTP caller.
 * Requires `Authorization: Bearer ${CRON_SECRET}` (same as Vercel Cron when CRON_SECRET is set in project env).
 *
 * Optional: `GMAIL_CRON_MIN_INTERVAL_MS` — skip a user if `last_sync_at` is newer than this (default 25 min) to avoid
 * overlapping with a manual sync and to keep Gmail API usage low.
 */
function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const auth = request.headers.get("authorization")?.trim()
  return auth === `Bearer ${secret}`
}

export async function GET(request: Request) {
  return handleCron(request)
}

export async function POST(request: Request) {
  return handleCron(request)
}

async function handleCron(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json(
      { error: "Unauthorized", hint: "Set CRON_SECRET and call with Authorization: Bearer <CRON_SECRET>." },
      { status: 401, headers: NO_STORE }
    )
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Server misconfigured", hint: "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required." },
      { status: 503, headers: NO_STORE }
    )
  }

  const minIntervalMs = Math.min(
    120 * 60_000,
    Math.max(0, Number(process.env.GMAIL_CRON_MIN_INTERVAL_MS?.trim()) || 25 * 60_000)
  )
  const now = Date.now()

  const db = createServiceClient(url, serviceKey)
  const { data: connections, error } = await db.from("gmail_connections").select("user_id, last_sync_at")

  if (error) {
    const msg = error.message ?? ""
    if (msg.includes("gmail_connections") || msg.includes("42P01")) {
      return NextResponse.json(
        { error: "gmail_connections table missing", hint: "Apply email_ledger migration in Supabase." },
        { status: 503, headers: NO_STORE }
      )
    }
    return NextResponse.json({ error: msg }, { status: 500, headers: NO_STORE })
  }

  const rows = connections ?? []
  type Entry = {
    userId: string
    skipped: boolean
    reason?: string
    result?: GmailSyncResult
    error?: string
  }
  const results: Entry[] = []

  for (const row of rows) {
    const userId = String((row as { user_id: string }).user_id)
    const lastRaw = (row as { last_sync_at: string | null }).last_sync_at
    if (minIntervalMs > 0 && lastRaw) {
      const last = new Date(lastRaw).getTime()
      if (Number.isFinite(last) && now - last < minIntervalMs) {
        results.push({ userId, skipped: true, reason: "recent_sync" })
        continue
      }
    }

    try {
      const result = await runGmailSync({ db, userId })
      results.push({ userId, skipped: false, result })
    } catch (e) {
      results.push({
        userId,
        skipped: false,
        error: e instanceof Error ? e.message : "sync_failed",
      })
    }
  }

  const skippedCount = results.filter((r) => r.skipped).length
  const failureCount = results.filter((r) => r.error).length
  const completed = results.filter((r) => r.result)

  return NextResponse.json(
    {
      ok: true,
      at: new Date().toISOString(),
      linkedAccounts: rows.length,
      skippedRecent: skippedCount,
      syncAttempts: completed.length + failureCount,
      failures: failureCount,
      minIntervalMs,
      createdTransactions: completed.reduce((s, r) => s + (r.result?.createdTransactions ?? 0), 0),
      results,
    },
    { headers: NO_STORE }
  )
}
