import { NextResponse } from "next/server"
import { getApiUserClient } from "@/lib/ledger/supabase-admin"

export async function GET(request: Request) {
  const ctx = await getApiUserClient(request)
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await ctx.db
    .from("gmail_connections")
    .select("google_email, last_sync_at")
    .eq("user_id", ctx.userId)
    .maybeSingle()

  if (error) {
    const msg = error.message ?? ""
    if (msg.includes("gmail_connections") || msg.includes("schema cache") || error.code === "42P01") {
      return NextResponse.json({
        connected: false,
        migrationRequired: true,
        message: "Run the email_ledger migration in Supabase to enable Gmail status.",
      })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json({
    connected: true,
    googleEmail: data.google_email,
    lastSyncAt: data.last_sync_at,
  })
}
