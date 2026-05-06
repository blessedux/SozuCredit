import { NextResponse } from "next/server"
import { fetchFxRateToUsd } from "@/lib/ledger/fx-fetch"

/**
 * MVP: quote fiat → USDC using USD as proxy (Frankfurter ECB rates).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const from = (searchParams.get("from") ?? "CLP").toUpperCase()
  const to = (searchParams.get("to") ?? "USDC").toUpperCase()

  try {
    if (to !== "USDC" && to !== "USD") {
      return NextResponse.json({ error: "Only to=USDC or to=USD supported in MVP" }, { status: 400 })
    }

    const { rate, source } = await fetchFxRateToUsd(from)
    return NextResponse.json({
      from,
      to: "USDC",
      rateToUsd: rate,
      proxyNote: "USDC priced as USD (spot proxy).",
      source,
    })
  } catch (e) {
    console.error("[fx]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "FX fetch failed" },
      { status: 502 }
    )
  }
}
