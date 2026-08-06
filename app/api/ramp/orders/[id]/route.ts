import { NextRequest, NextResponse } from "next/server"
import { getRampOrder } from "@/lib/db/ramp"
import { rampRouteGuard } from "@/lib/ramp/onboarding"
import { RampProviderError } from "@/lib/ramp/provider"
import { reconcileOrder } from "@/lib/ramp/reconcile"
import { getRampProvider } from "@/lib/ramp/registry"
import type { RampOrderRow } from "@/lib/ramp/types"

function toPublic(row: RampOrderRow) {
  return {
    id: row.id,
    direction: row.direction,
    status: row.status,
    fiatAmountMinor: row.fiat_amount_minor,
    usdcMinor: row.usdc_minor,
    userTxHash: row.user_tx_hash,
    settlementTxHash: row.settlement_tx_hash,
    createdAt: row.created_at,
  }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await rampRouteGuard(request)
  if (auth.error) return auth.error
  try {
    const { id } = await ctx.params
    // Ownership from OUR DB only — Etherfuse's order customerId is the
    // partner org, never the user, so it can't authorize anything.
    const order = await getRampOrder(id, auth.userId)
    if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 })
    const terminal = order.status === "completed" || order.status === "failed" || order.status === "refunded"
    const fresh = terminal ? order : await reconcileOrder(order, getRampProvider())
    return NextResponse.json(toPublic(fresh))
  } catch (e) {
    if (e instanceof RampProviderError) {
      console.error("[ramp/orders/id] provider error:", e.reason, e.message)
      return NextResponse.json({ error: "ramp_provider_error", reason: e.reason }, { status: 502 })
    }
    console.error("[ramp/orders/id] error:", e)
    return NextResponse.json({ error: "internal_error" }, { status: 500 })
  }
}
