import { NextRequest, NextResponse } from "next/server"
import { Networks, TransactionBuilder } from "@stellar/stellar-sdk"
import {
  claimOrderForSettlement,
  getRampOrder,
  setRampOrderSettlementTx,
  transitionRampOrder,
} from "@/lib/db/ramp"
import { rampRouteGuard } from "@/lib/ramp/onboarding"
import { RampProviderError } from "@/lib/ramp/provider"
import { sendAnchorPayment } from "@/lib/ramp/settlement"
import { submitSignedSorobanEnvelope } from "@/lib/stellar/send-token"
import { getStellarConfig } from "@/lib/turnkey/config"

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await rampRouteGuard(request)
  if (auth.error) return auth.error
  try {
    const { id } = await ctx.params
    const body = await request.json()
    const signedEnvelopeXdr = body?.signedEnvelopeXdr
    if (typeof signedEnvelopeXdr !== "string" || !signedEnvelopeXdr) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 })
    }
    // Ownership from OUR DB only — Etherfuse's order customerId is the
    // partner org, never the user, so it can't authorize anything.
    const order = await getRampOrder(id, auth.userId)
    if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 })
    if (order.direction !== "off" || order.status !== "created") {
      return NextResponse.json({ error: "order_not_signable" }, { status: 409 })
    }

    // Sanity: the envelope must parse for THIS network before we submit.
    const networkPassphrase = getStellarConfig().network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET
    try {
      TransactionBuilder.fromXDR(signedEnvelopeXdr.trim(), networkPassphrase)
    } catch {
      return NextResponse.json({ error: "invalid_envelope" }, { status: 400 })
    }

    // 1. User leg: C → treasury (submitSignedSorobanEnvelope waits for
    //    on-chain success and throws otherwise).
    const userTxHash = await submitSignedSorobanEnvelope(signedEnvelopeXdr.trim())
    const funded = await transitionRampOrder(order.id, ["created"], "funded", { user_tx_hash: userTxHash })
    if (!funded) return NextResponse.json({ error: "order_not_signable" }, { status: 409 })

    // 2. Treasury leg: classic payment to the anchor with the hash memo.
    //    claimOrderForSettlement performs the guarded funded→settling
    //    transition AND stamps settlement_claimed_at — the same lease
    //    claimSettlingRetry checks before a reconciler may retry a stuck
    //    send. Only the caller that wins this claim may call
    //    sendAnchorPayment, so a duplicate/concurrent submit can never
    //    double-send. On failure below, the order is left in 'settling'
    //    with the user's USDC safe in treasury; sendAnchorPayment itself is
    //    safe to re-run later because Etherfuse matches on the memo.
    const claimed = await claimOrderForSettlement(order.id)
    if (!claimed) return NextResponse.json({ error: "order_not_signable" }, { status: 409 })
    const meta = order.metadata as { withdrawAnchorAccount?: string; withdrawMemoBase64?: string }
    if (!meta.withdrawAnchorAccount || !meta.withdrawMemoBase64) {
      return NextResponse.json({ error: "internal_error" }, { status: 500 })
    }
    const { txHash: settlementTxHash } = await sendAnchorPayment({
      anchorAccount: meta.withdrawAnchorAccount,
      memoBase64: meta.withdrawMemoBase64,
      amountUsdcMinor: order.usdc_minor,
    })
    await setRampOrderSettlementTx(order.id, settlementTxHash)
    return NextResponse.json({ status: "settling", userTxHash, settlementTxHash })
  } catch (e) {
    if (e instanceof RampProviderError) {
      return NextResponse.json({ error: "ramp_provider_error", reason: e.reason }, { status: 502 })
    }
    console.error("[ramp/submit] error:", e)
    return NextResponse.json({ error: "internal_error" }, { status: 500 })
  }
}
