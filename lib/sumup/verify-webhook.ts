import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verify SumUp webhook `x-payload-signature` (HMAC-SHA256 hex).
 * Used only when the header is present (SumUp Webhooks product).
 *
 * Checkout `return_url` callbacks often omit this header — the route skips
 * verification in that case and confirms payment via GET checkout API instead.
 *
 * @see https://developer.sumup.com/webhook-docs/introduction/getting-started
 */
export function verifySumUpWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.SUMUP_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  if (!signatureHeader?.trim()) return false;

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const received = signatureHeader.trim().toLowerCase();

  try {
    if (expected.length === received.length) {
      return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(received, "utf8"));
    }
  } catch {
    // fall through to hex compare
  }
  return expected === received;
}

/** True when we should attempt HMAC verification on this request. */
export function sumUpWebhookHasSignatureHeader(signatureHeader: string | null): boolean {
  return Boolean(signatureHeader?.trim());
}
