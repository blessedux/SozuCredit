import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { createRampOrder, getRampCustomer } from "@/lib/db/ramp"
import { rampRouteGuard } from "@/lib/ramp/onboarding"
import { RampProviderError } from "@/lib/ramp/provider"
import { getRampProvider } from "@/lib/ramp/registry"
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet"

export async function POST(request: NextRequest) {
  const auth = await rampRouteGuard(request)
  if (auth.error) return auth.error
  try {
    const body = await request.json()
    const { direction, quoteId, fiatAmountCents, usdcMinor, fxRate, feeCents } = body ?? {}
    if (direction !== "on" && direction !== "off") {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 })
    }
    if (typeof quoteId !== "string" || !quoteId
      || !Number.isSafeInteger(fiatAmountCents) || fiatAmountCents <= 0
      || !Number.isSafeInteger(usdcMinor) || usdcMinor <= 0
      || typeof fxRate !== "number" || !Number.isFinite(fxRate) || fxRate <= 0
      || !Number.isSafeInteger(feeCents) || feeCents < 0
      // A fee that consumes (or exceeds) the whole fiat amount is never a
      // legitimate quote echo — reject it rather than create a nonsensical
      // order. This can't be verified against the provider (no quote-fetch
      // endpoint exists), so it's a sanity bound, not a full re-derivation.
      || feeCents >= fiatAmountCents) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 })
    }
    const customer = await getRampCustomer(auth.userId)
    if (!customer?.bank_account_id || !customer.wallet_id) {
      return NextResponse.json({ error: "onboarding_incomplete" }, { status: 409 })
    }
    const wallet = await getStellarWallet(auth.userId, true)
    if (!wallet?.publicKey) {
      return NextResponse.json({ error: "wallet_not_found" }, { status: 404 })
    }
    const provider = getRampProvider()
    const orderId = randomUUID()

    if (direction === "on") {
      const created = await provider.createOnrampOrder({
        orderId,
        quoteId,
        bankAccountId: customer.bank_account_id,
        cryptoWalletId: customer.wallet_id,
      })
      const row = await createRampOrder({
        userId: auth.userId,
        direction: "on",
        status: "awaiting_payment",
        fiatAmountMinor: fiatAmountCents,
        usdcMinor,
        fxRate,
        feeMinor: feeCents,
        providerOrderId: created.orderId,
        destinationStellarAddress: wallet.publicKey,
      })
      return NextResponse.json({ orderId: row.id, status: row.status, deposit: created.deposit })
    }

    // direction === "off" — implemented in the off-ramp task.
    return NextResponse.json({ error: "not_implemented" }, { status: 501 })
  } catch (e) {
    if (e instanceof RampProviderError) {
      console.error("[ramp/orders] provider error:", e.reason, e.message)
      return NextResponse.json({ error: "ramp_provider_error", reason: e.reason }, { status: 502 })
    }
    console.error("[ramp/orders] error:", e)
    return NextResponse.json({ error: "internal_error" }, { status: 500 })
  }
}
