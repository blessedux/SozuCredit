import { NextRequest, NextResponse } from "next/server"
import { getRampOrder } from "@/lib/db/ramp"
import { rampRouteGuard } from "@/lib/ramp/onboarding"
import { RampProviderError } from "@/lib/ramp/provider"
import { getRampProvider } from "@/lib/ramp/registry"
import { getStellarConfig } from "@/lib/turnkey/config"

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (getStellarConfig().network !== "testnet") {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  const auth = await rampRouteGuard(request)
  if (auth.error) return auth.error
  try {
    const { id } = await ctx.params
    const order = await getRampOrder(id, auth.userId)
    if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 })
    await getRampProvider().simulateFiatReceived(order.provider_order_id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof RampProviderError) {
      return NextResponse.json({ error: "ramp_provider_error", reason: e.reason }, { status: 502 })
    }
    console.error("[ramp/simulate] error:", e)
    return NextResponse.json({ error: "internal_error" }, { status: 500 })
  }
}
