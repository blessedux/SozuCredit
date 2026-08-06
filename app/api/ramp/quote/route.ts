import { NextRequest, NextResponse } from "next/server"
import { getRampCustomer } from "@/lib/db/ramp"
import { minorToDecimalString } from "@/lib/ramp/decimal"
import { rampRouteGuard } from "@/lib/ramp/onboarding"
import { RampProviderError } from "@/lib/ramp/provider"
import { getRampProvider } from "@/lib/ramp/registry"
import { getRampTreasuryKeypair } from "@/lib/ramp/settlement"

export async function POST(request: NextRequest) {
  const auth = await rampRouteGuard(request)
  if (auth.error) return auth.error
  try {
    const body = await request.json()
    const direction = body?.direction
    const amountMinor = body?.amountMinor
    if ((direction !== "on" && direction !== "off") || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 })
    }
    const customer = await getRampCustomer(auth.userId)
    if (!customer?.bank_account_id || !customer.wallet_id) {
      return NextResponse.json({ error: "onboarding_incomplete" }, { status: 409 })
    }
    const provider = getRampProvider()
    const walletAddress = getRampTreasuryKeypair().publicKey()
    const quote = direction === "on"
      ? await provider.createOnrampQuote({
          customerId: customer.customer_id,
          walletAddress,
          amountFiat: minorToDecimalString(amountMinor, 2),
        })
      : await provider.createOfframpQuote({
          customerId: customer.customer_id,
          walletAddress,
          amountToken: minorToDecimalString(amountMinor, 7),
        })
    return NextResponse.json(quote)
  } catch (e) {
    if (e instanceof RampProviderError) {
      console.error("[ramp/quote] provider error:", e.reason, e.message)
      return NextResponse.json({ error: "ramp_provider_error", reason: e.reason }, { status: 502 })
    }
    console.error("[ramp/quote] error:", e)
    return NextResponse.json({ error: "internal_error" }, { status: 500 })
  }
}
