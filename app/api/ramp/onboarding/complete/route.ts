import { NextRequest, NextResponse } from "next/server"
import { RampProviderError } from "@/lib/ramp/provider"
import { completeSetup, rampRouteGuard } from "@/lib/ramp/onboarding"

const CPF_RE = /^\d{11}$/
const PIX_KEY_TYPES = new Set(["email", "phone", "cpf", "random"])

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

/** POST /api/ramp/onboarding/complete — resumable per field: bank account, then treasury wallet. */
export async function POST(request: NextRequest) {
  const auth = await rampRouteGuard(request)
  if (auth.error) return auth.error

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const { firstName, lastName, cpf, pixKey, pixKeyType } = body

  const cpfDigits = typeof cpf === "string" ? cpf.replace(/[.-]/g, "") : ""

  if (
    !isNonEmptyString(firstName) || !isNonEmptyString(lastName) ||
    !isNonEmptyString(cpf) || !CPF_RE.test(cpfDigits) ||
    !isNonEmptyString(pixKey) ||
    typeof pixKeyType !== "string" || !PIX_KEY_TYPES.has(pixKeyType)
  ) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 })
  }

  try {
    const result = await completeSetup({
      userId: auth.userId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      cpf: cpfDigits,
      pixKey: pixKey.trim(),
      pixKeyType,
    })
    if ("conflict" in result) {
      return NextResponse.json({ error: result.conflict }, { status: 409 })
    }
    return NextResponse.json({ status: result.status })
  } catch (e) {
    if (e instanceof RampProviderError) {
      console.error("[ramp/onboarding/complete] provider error:", e.reason, e.message)
      return NextResponse.json({ error: "ramp_provider_error", reason: e.reason }, { status: 502 })
    }
    console.error("[ramp/onboarding/complete] error:", e)
    return NextResponse.json({ error: "internal_error" }, { status: 500 })
  }
}
