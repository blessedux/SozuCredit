import { NextRequest, NextResponse } from "next/server"
import { getSozuPayOrigin } from "@/lib/pizza/pay-return"

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => ({}))
  try {
    const res = await fetch(`${getSozuPayOrigin()}/api/pizza/redeems`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(json),
    })
    const body = await res.json().catch(() => ({ error: "Failed to start pizza redeem" }))
    return NextResponse.json(body, { status: res.status })
  } catch (err) {
    console.error("[pizza/redeems] Error:", err)
    return NextResponse.json({ error: "Network error starting pizza redeem" }, { status: 500 })
  }
}
