import { NextRequest, NextResponse } from "next/server"
import { getRampCustomer } from "@/lib/db/ramp"
import { getRampProvider } from "@/lib/ramp/registry"
import { RampProviderError } from "@/lib/ramp/provider"
import { deriveOnboardingStatus, rampRouteGuard } from "@/lib/ramp/onboarding"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await rampRouteGuard(request)
  if (auth.error) return auth.error
  try {
    const customer = await getRampCustomer(auth.userId)
    if (!customer) return NextResponse.json({ status: "not_started" })
    const kyc = await getRampProvider().getKycStatus(customer.customer_id)
    return NextResponse.json({
      status: deriveOnboardingStatus(customer, kyc),
      kycStatus: kyc,
      displayName: customer.display_name,
      kycEmail: customer.kyc_email,
    })
  } catch (e) {
    if (e instanceof RampProviderError) {
      console.error("[ramp/onboarding] provider error:", e.reason, e.message)
      return NextResponse.json({ error: "ramp_provider_error", reason: e.reason }, { status: 502 })
    }
    console.error("[ramp/onboarding] error:", e)
    return NextResponse.json({ error: "internal_error" }, { status: 500 })
  }
}
