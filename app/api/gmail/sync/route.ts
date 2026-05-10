import { NextResponse } from "next/server"
import { getApiUserClient } from "@/lib/ledger/supabase-admin"
import { runGmailSync, type GmailSyncMode } from "@/lib/gmail/run-sync"

export const dynamic = "force-dynamic"

/** Manual sync can re-fetch hundreds of messages after a DB reset; default serverless timeout is too low. */
export const maxDuration = 300

/**
 * Lists recent finance-related Gmail messages, upserts `email_sources`,
 * and creates `ledger_transactions` when a simple amount heuristic matches.
 */
export async function POST(request: Request) {
  const ctx = await getApiUserClient(request)
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await ctx.db
    .from("gmail_connections")
    .select("id")
    .eq("user_id", ctx.userId)
    .maybeSingle()

  if (error) {
    const msg = error.message ?? ""
    if (msg.includes("gmail_connections") || msg.includes("schema cache")) {
      return NextResponse.json(
        { error: "Database not ready", hint: "Apply the email_ledger migration in Supabase." },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json(
      { error: "Gmail not linked", hint: "Open Settings and connect your Gmail account first." },
      { status: 400 }
    )
  }

  let syncMode: GmailSyncMode | undefined
  try {
    const body = await request.json().catch(() => ({}))
    if (body?.mode === "incremental" || body?.mode === "full") {
      syncMode = body.mode
    }
  } catch {
    /* empty body */
  }

  try {
    const result = await runGmailSync({ db: ctx.db, userId: ctx.userId, mode: syncMode })
    return NextResponse.json({
      ok: true,
      mode: syncMode ?? "full",
      scanned: result.scanned,
      listedMessages: result.listedMessages,
      skippedExisting: result.skippedExisting,
      listTruncated: result.listTruncated,
      upsertedSources: result.upsertedSources,
      createdTransactions: result.createdTransactions,
      errors: result.errors,
      message:
        result.errors.length === 0
          ? "Sync completed."
          : `Sync finished with ${result.errors.length} non-fatal issue(s).`,
    })
  } catch (e) {
    console.error("[gmail/sync]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "sync_failed" },
      { status: 500 }
    )
  }
}
