import { NextResponse } from "next/server"
import { getApiUserClient } from "@/lib/ledger/supabase-admin"

export async function POST(request: Request) {
  const ctx = await getApiUserClient(request)
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { error } = await ctx.db.from("gmail_connections").delete().eq("user_id", ctx.userId)

  if (error) {
    const msg = error.message ?? ""
    if (msg.includes("gmail_connections") || msg.includes("schema cache")) {
      return NextResponse.json({ error: "Gmail tables not installed" }, { status: 503 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
