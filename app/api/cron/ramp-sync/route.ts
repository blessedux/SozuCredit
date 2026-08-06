import { NextRequest, NextResponse } from "next/server"
import { rampEnabled } from "@/lib/app-config"
import { listSettlingOrPendingOrders } from "@/lib/db/ramp"
import { rampServerConfigured } from "@/lib/ramp/config"
import { reconcileOrder } from "@/lib/ramp/reconcile"
import { getRampProvider } from "@/lib/ramp/registry"

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (!rampEnabled || !rampServerConfigured()) {
    return NextResponse.json({ scanned: 0, transitioned: 0, note: "ramp disabled" })
  }
  const provider = getRampProvider()
  const pending = await listSettlingOrPendingOrders()
  let transitioned = 0
  for (const order of pending) {
    try {
      const fresh = await reconcileOrder(order, provider)
      if (fresh.status !== order.status) transitioned++
    } catch (e) {
      console.error("[cron/ramp-sync] reconcile failed:", order.id, e)
    }
  }
  return NextResponse.json({ scanned: pending.length, transitioned })
}
