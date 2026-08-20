import { NextRequest, NextResponse } from "next/server"
import { getSozuPayOrigin } from "@/lib/pizza/pay-return"

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.trim() ?? ""
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 })
  }

  try {
    const res = await fetch(
      `${getSozuPayOrigin()}/api/pizza/sku?slug=${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    )
    const body = await res.json().catch(() => ({ error: "Failed to load pizza SKU" }))
    return NextResponse.json(body, { status: res.status })
  } catch (err) {
    console.error("[pizza/sku] Error:", err)
    return NextResponse.json({ error: "Network error loading pizza SKU" }, { status: 500 })
  }
}
