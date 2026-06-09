import { NextResponse } from "next/server";
import { autoReleaseLimitClp, depositsEnabled } from "@/lib/app-config";
import {
  getDepositIntentBySumupCheckoutId,
  markDepositPaymentReceived,
} from "@/lib/db/deposit-intents";
import {
  getCheckout,
  isCheckoutPaid,
  primaryTransactionId,
} from "@/lib/sumup/client";
import {
  sumUpWebhookHasSignatureHeader,
  verifySumUpWebhookSignature,
} from "@/lib/sumup/verify-webhook";
import type { DepositStatus } from "@/lib/deposits/types";

export const dynamic = "force-dynamic";

type WebhookPayload = {
  event_type?: string;
  id?: string;
};

/** SumUp / dashboard may probe the URL with GET before enabling webhooks. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "sozu-sumup-webhook",
    hint: "POST checkout status events here; payment is verified via SumUp API.",
  });
}

/**
 * POST /api/deposits/sumup/webhook
 *
 * Two SumUp notification styles:
 * 1. Checkout `return_url` (hosted checkout) — usually no signature header.
 * 2. SumUp Webhooks product — sends `x-payload-signature` (verify when present).
 *
 * Either way we re-fetch the checkout from SumUp before updating Supabase.
 */
export async function POST(request: Request) {
  if (!depositsEnabled) {
    return new NextResponse(null, { status: 204 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-payload-signature");
  const hasSignature = sumUpWebhookHasSignatureHeader(signature);
  const webhookSecret = process.env.SUMUP_WEBHOOK_SECRET?.trim();

  if (hasSignature && webhookSecret) {
    if (!verifySumUpWebhookSignature(rawBody, signature)) {
      console.warn("[SumUp webhook] invalid x-payload-signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else if (hasSignature && !webhookSecret) {
    console.warn("[SumUp webhook] signature present but SUMUP_WEBHOOK_SECRET unset — processing via API verify");
  } else {
    console.log("[SumUp webhook] no signature header (checkout return_url style) — verifying via SumUp API");
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const checkoutId = payload.id?.trim();
  if (!checkoutId) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const checkout = await getCheckout(checkoutId);
    if (!isCheckoutPaid(checkout)) {
      return new NextResponse(null, { status: 204 });
    }

    const intent = await getDepositIntentBySumupCheckoutId(checkoutId);
    if (!intent) {
      console.warn("[SumUp webhook] no deposit_intent for checkout", checkoutId);
      return new NextResponse(null, { status: 204 });
    }

    const txId = primaryTransactionId(checkout);
    const nextStatus: DepositStatus =
      intent.amount_clp <= autoReleaseLimitClp ? "payment_received" : "pending_admin_review";

    await markDepositPaymentReceived({
      intentId: intent.id,
      sumupTransactionId: txId,
      nextStatus,
      metadataPatch: {
        sumup_webhook_at: new Date().toISOString(),
        sumup_checkout_status: checkout.status,
        sumup_checkout_snapshot: checkout,
        sumup_webhook_signed: hasSignature,
      },
    });
  } catch (err) {
    console.error("[SumUp webhook]", err);
    const message = err instanceof Error ? err.message : "Processing failed";
    if (message.includes("401") || message.toLowerCase().includes("unauthorized")) {
      return NextResponse.json(
        {
          error: "SumUp API rejected checkout lookup — check SUMUP_API_KEY is a secret key (sup_sk_), not sup_pk_",
        },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
