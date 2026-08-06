import { NextRequest, NextResponse } from "next/server"
import { getRampCustomer } from "@/lib/db/ramp"
import { RampProviderError } from "@/lib/ramp/provider"
import { buildLaunchPayload, rampRouteGuard } from "@/lib/ramp/onboarding"

/** POST /api/ramp/onboarding/kyc-launch — fresh JWT for retry/denied. */
export async function POST(request: NextRequest) {
  const auth = await rampRouteGuard(request)
  if (auth.error) return auth.error

  try {
    const customer = await getRampCustomer(auth.userId)
    if (!customer) {
      return NextResponse.json({ error: "onboarding_not_started" }, { status: 404 })
    }
    return NextResponse.json({ launch: buildLaunchPayload(customer) })
  } catch (e) {
    if (e instanceof RampProviderError) {
      console.error("[ramp/onboarding/kyc-launch] provider error:", e.reason, e.message)
      return NextResponse.json({ error: "ramp_provider_error", reason: e.reason }, { status: 502 })
    }
    console.error("[ramp/onboarding/kyc-launch] error:", e)
    return NextResponse.json({ error: "internal_error" }, { status: 500 })
  }
}
