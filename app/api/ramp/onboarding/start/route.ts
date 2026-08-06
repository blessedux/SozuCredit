import { NextRequest, NextResponse } from "next/server"
import { RampProviderError } from "@/lib/ramp/provider"
import { rampRouteGuard, startOnboarding } from "@/lib/ramp/onboarding"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** POST /api/ramp/onboarding/start — create the Etherfuse org and launch hosted KYC. */
export async function POST(request: NextRequest) {
  const auth = await rampRouteGuard(request)
  if (auth.error) return auth.error

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const displayName = body.displayName
  const email = body.email

  if (
    typeof displayName !== "string" || displayName.trim().length === 0 ||
    typeof email !== "string" || !EMAIL_RE.test(email.trim())
  ) {
    return NextResponse.json(
      {
        error: "invalid_input",
        hint: "displayName and email are required; email must be a REAL, receivable inbox — the KYC PIN is emailed even in sandbox.",
      },
      { status: 400 },
    )
  }

  try {
    const { launch } = await startOnboarding({
      userId: auth.userId,
      displayName: displayName.trim(),
      email: email.trim(),
    })
    return NextResponse.json({ status: "verifying", launch })
  } catch (e) {
    if (e instanceof RampProviderError) {
      console.error("[ramp/onboarding/start] provider error:", e.reason, e.message)
      return NextResponse.json({ error: "ramp_provider_error", reason: e.reason }, { status: 502 })
    }
    console.error("[ramp/onboarding/start] error:", e)
    return NextResponse.json({ error: "internal_error" }, { status: 500 })
  }
}
