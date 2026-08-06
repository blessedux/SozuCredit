import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { createRampOrder, getRampCustomer } from "@/lib/db/ramp"
import { minorToDecimalString } from "@/lib/ramp/decimal"
import { rampRouteGuard } from "@/lib/ramp/onboarding"
import { RampProviderError } from "@/lib/ramp/provider"
import { getRampProvider } from "@/lib/ramp/registry"
import { decodeAnchorMemo, deriveUserRampKeypair, getUsdcSacContractId } from "@/lib/ramp/settlement"
import { getStellarConfig } from "@/lib/turnkey/config"
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
      || !Number.isSafeInteger(feeCents) || feeCents < 0) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 })
    }
    // A fee that consumes (or exceeds) the whole SOURCE amount is never a
    // legitimate quote echo — reject it rather than create a nonsensical
    // order. This can't be verified against the provider (no quote-fetch
    // endpoint exists), so it's a sanity bound, not a full re-derivation.
    // On-ramp's source is fiat (fiatAmountCents); off-ramp's source is the
    // token leg (usdcMinor) — comparing an off-ramp fee in fiat cents against
    // fiatAmountCents (the RECEIVE side) would reject legitimate orders
    // whenever the fee is a reasonable fraction of a small payout.
    if (direction === "on" && feeCents >= fiatAmountCents) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 })
    }
    if (direction === "off" && feeCents >= usdcMinor) {
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

    // direction === "off": create the anchor order, then build the user's
    // C→per-user-G USDC transfer for passkey signing. The anchor details
    // (account + 32-byte memo) are kept server-side in order metadata; the
    // memo payment is relayed from that per-user G AFTER the user leg
    // confirms. Etherfuse rejects a shared destination across customers, so
    // the destination is this customer's own deterministically-derived G,
    // never the treasury.
    const anchor = await provider.createAnchorOfframpOrder({
      orderId,
      quoteId,
      bankAccountId: customer.bank_account_id,
      cryptoWalletId: customer.wallet_id,
    })
    // Fail fast BEFORE the user signs anything: a bad memo means the anchor
    // payment would be auto-refunded.
    decodeAnchorMemo(anchor.withdrawMemoBase64)

    const destinationG = deriveUserRampKeypair(auth.userId).publicKey()
    const senderC = wallet.publicKey.trim().toUpperCase()
    if (!senderC.startsWith("C")) {
      return NextResponse.json({ error: "wallet_must_be_smart_account" }, { status: 422 })
    }
    const signerPk = wallet.signerPublicKey?.trim().toUpperCase()
    if (!signerPk?.startsWith("G")) {
      return NextResponse.json({ error: "smart_signer_required" }, { status: 422 })
    }
    const { resolveSorobanFeePayer } = await import("@/lib/stellar/soroban-fee-payer")
    const { feePayer } = await resolveSorobanFeePayer({
      signerPublicKey: signerPk,
      network: getStellarConfig().network,
      requireSignerAsSource: false,
    })
    const { contractSupportsOzKitSigning } = await import("@/lib/stellar/supports-oz-kit-contract")
    const supportsOzKitApi = await contractSupportsOzKitSigning(senderC)
    const { sendToken } = await import("@/lib/stellar/send-token")
    const { unsignedXdr, sorobanDataXdr } = await sendToken({
      contractId: getUsdcSacContractId(getStellarConfig().network),
      from: senderC,
      to: destinationG,
      amount: minorToDecimalString(usdcMinor, 7),
      relayerPublicKey: feePayer,
      network: getStellarConfig().network,
      decimals: 7,
    })

    const row = await createRampOrder({
      userId: auth.userId,
      direction: "off",
      status: "created",
      fiatAmountMinor: fiatAmountCents,
      usdcMinor,
      fxRate,
      feeMinor: feeCents,
      providerOrderId: anchor.orderId,
      destinationStellarAddress: null,
      metadata: {
        withdrawAnchorAccount: anchor.withdrawAnchorAccount,
        withdrawMemoBase64: anchor.withdrawMemoBase64,
        // Binds the eventual signed envelope to THIS sender — verifyOfframpEnvelope
        // rejects any envelope whose `from` doesn't match this recorded C address.
        senderC,
        // The per-user G this order's C→G leg must land on — verifyOfframpEnvelope
        // rejects any envelope whose `to` doesn't match this recorded destination.
        destinationG,
      },
    })
    return NextResponse.json({
      orderId: row.id,
      status: row.status,
      build: {
        unsignedXdr,
        sorobanDataXdr,
        signMethod: supportsOzKitApi ? "oz_passkey" : "oz_passkey_local",
        supportsOzKitApi,
        signerPublicKey: signerPk,
        walletAddress: senderC,
        ozCredentialId: wallet.ozCredentialId ?? null,
        feePayerPublicKey: feePayer,
      },
    })
  } catch (e) {
    if (e instanceof RampProviderError) {
      console.error("[ramp/orders] provider error:", e.reason, e.message)
      return NextResponse.json({ error: "ramp_provider_error", reason: e.reason }, { status: 502 })
    }
    console.error("[ramp/orders] error:", e)
    return NextResponse.json({ error: "internal_error" }, { status: 500 })
  }
}
