import { NextRequest, NextResponse } from "next/server"
import { getSozuPayOrigin } from "@/lib/pizza/pay-return"

type Params = { params: Promise<{ id: string }> }

function payRedeemsUrl(id: string): string {
  return `${getSozuPayOrigin()}/api/pizza/redeems/${encodeURIComponent(id)}`
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const res = await fetch(payRedeemsUrl(id), { cache: "no-store" })
  const body = await res.json().catch(() => ({ error: "Pay redeem lookup failed" }))
  return NextResponse.json(body, { status: res.status })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params
  const json = await request.json().catch(() => ({}))
  const res = await fetch(payRedeemsUrl(id), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  })
  const body = await res.json().catch(() => ({ error: "Pay redeem update failed" }))
  return NextResponse.json(body, { status: res.status })
}
