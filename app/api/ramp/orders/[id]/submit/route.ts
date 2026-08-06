import { NextRequest, NextResponse } from "next/server"
import { Networks, Transaction, TransactionBuilder } from "@stellar/stellar-sdk"
import {
  claimOrderForSettlement,
  findRampOrderByUserTxHash,
  getRampOrder,
  RampDbConflictError,
  setRampOrderSettlementTx,
  transitionRampOrder,
} from "@/lib/db/ramp"
import { rampRouteGuard } from "@/lib/ramp/onboarding"
import { RampProviderError } from "@/lib/ramp/provider"
import { deriveUserRampKeypair, getUsdcSacContractId, sendAnchorPayment } from "@/lib/ramp/settlement"
import { verifyOfframpEnvelope } from "@/lib/ramp/verify-offramp-envelope"
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
    const meta = order.metadata as {
      withdrawAnchorAccount?: string
      withdrawMemoBase64?: string
      senderC?: string
      destinationG?: string
    }
    if (!meta.senderC) {
      // Data integrity issue, not a client error — Step 1 always writes this.
      console.error("[ramp/submit] order missing metadata.senderC:", order.id)
      return NextResponse.json({ error: "internal_error" }, { status: 500 })
    }

    // Always derive fresh (it's re-derivable, never stored) rather than trust
    // the DB blindly; when the order also recorded destinationG, the two
    // must agree or something is wrong (e.g. RAMP_TREASURY_SECRET rotated
    // between order creation and submit — the per-user G would silently
    // change underneath an in-flight order).
    const destinationG = deriveUserRampKeypair(auth.userId).publicKey()
    if (meta.destinationG && meta.destinationG.trim().toUpperCase() !== destinationG) {
      console.error("[ramp/submit] destinationG mismatch vs derived key:", order.id)
      return NextResponse.json({ error: "internal_error" }, { status: 500 })
    }

    // Sanity: the envelope must parse for THIS network before we inspect or submit it.
    const networkPassphrase = getStellarConfig().network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET
    const trimmedXdr = signedEnvelopeXdr.trim()
    let parsed: ReturnType<typeof TransactionBuilder.fromXDR>
    try {
      parsed = TransactionBuilder.fromXDR(trimmedXdr, networkPassphrase)
    } catch {
      return NextResponse.json({ error: "invalid_envelope" }, { status: 400 })
    }
    if (!(parsed instanceof Transaction)) {
      return NextResponse.json({ error: "invalid_envelope" }, { status: 400 })
    }

    // Bind the envelope to THIS order. Without this, any envelope the
    // caller's own passkey can sign (e.g. a 1-stroop self-transfer) would
    // still be submitted and treated as proof of funding — sendAnchorPayment
    // below pays the order's FULL usdc_minor from the per-user G regardless
    // of what the envelope actually moved. The amount, sender, destination,
    // and contract must all match the order exactly.
    const verification = verifyOfframpEnvelope(trimmedXdr, {
      senderC: meta.senderC,
      destinationG,
      sacContractId: getUsdcSacContractId(getStellarConfig().network),
      amountMinor: order.usdc_minor,
      networkPassphrase,
    })
    if (!verification.ok) {
      return NextResponse.json(
        { error: "envelope_mismatch", reason: verification.reason },
        { status: 422 },
      )
    }

    // Replay guard #1 (fast path): reject before ever touching the network
    // if this exact envelope already funded some order. Guard #2 (the
    // authoritative one) is the DB's unique index on user_tx_hash, enforced
    // below when we record the confirmed on-chain hash — this pre-check just
    // avoids a redundant submit attempt for the common "client retried the
    // same request" case.
    const envelopeHash = parsed.hash().toString("hex")
    const priorUse = await findRampOrderByUserTxHash(envelopeHash)
    if (priorUse) {
      return NextResponse.json({ error: "envelope_reused" }, { status: 409 })
    }

    // 1. User leg: C → per-user G (submitSignedSorobanEnvelope waits for
    //    on-chain success and throws otherwise). Soroban RPC treats a
    //    resubmitted already-applied tx as a success (DUPLICATE), returning
    //    the same hash it returned the first time — the unique index below
    //    is what actually stops that hash from funding a second order.
    const userTxHash = await submitSignedSorobanEnvelope(trimmedXdr)
    let funded
    try {
      funded = await transitionRampOrder(order.id, ["created"], "funded", { user_tx_hash: userTxHash })
    } catch (err) {
      if (err instanceof RampDbConflictError && err.code === "23505") {
        return NextResponse.json({ error: "envelope_reused" }, { status: 409 })
      }
      throw err
    }
    if (!funded) return NextResponse.json({ error: "order_not_signable" }, { status: 409 })

    // 2. Settlement leg: classic payment from the per-user G to the anchor
    //    with the hash memo. claimOrderForSettlement performs the guarded
    //    funded→settling transition AND stamps settlement_claimed_at — the
    //    same lease claimSettlingRetry checks before a reconciler may retry
    //    a stuck send. Only the caller that wins this claim may call
    //    sendAnchorPayment, so a duplicate/concurrent submit can never
    //    double-send. On failure below, the order is left in 'settling' with
    //    the user's USDC safe on the per-user G; sendAnchorPayment itself is
    //    safe to re-run later because Etherfuse matches on the memo.
    const claimed = await claimOrderForSettlement(order.id)
    if (!claimed) return NextResponse.json({ error: "order_not_signable" }, { status: 409 })
    if (!meta.withdrawAnchorAccount || !meta.withdrawMemoBase64) {
      return NextResponse.json({ error: "internal_error" }, { status: 500 })
    }
    const { txHash: settlementTxHash } = await sendAnchorPayment({
      userId: auth.userId,
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
