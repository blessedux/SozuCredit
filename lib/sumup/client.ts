import "server-only";

const SUMUP_API = "https://api.sumup.com/v0.1";

export type SumUpCheckout = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  checkout_reference?: string;
  hosted_checkout_url?: string;
  transactions?: Array<{ id: string; status?: string }>;
};

function apiKey(): string {
  const key = process.env.SUMUP_API_KEY?.trim();
  if (!key) throw new Error("SUMUP_API_KEY not configured");
  if (key.startsWith("sup_pk_")) {
    throw new Error(
      "SUMUP_API_KEY is a public key (sup_pk_). Server checkouts require a secret key (sup_sk_) from SumUp → Settings → Developer → API Keys.",
    );
  }
  return key;
}

function merchantCode(): string {
  const code = process.env.SUMUP_MERCHANT_CODE?.trim();
  if (!code) throw new Error("SUMUP_MERCHANT_CODE not configured");
  return code;
}

export function sumUpConfigured(): boolean {
  return Boolean(process.env.SUMUP_API_KEY?.trim() && process.env.SUMUP_MERCHANT_CODE?.trim());
}

function appBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL not configured");
  return url.replace(/\/$/, "");
}

/**
 * Create a SumUp hosted checkout for CLP card payment.
 * @see https://developer.sumup.com/online-payments/checkouts/hosted-checkout/
 */
export async function createHostedCheckout(params: {
  amountClp: number;
  checkoutReference: string;
  description: string;
  intentId: string;
}): Promise<{ checkoutId: string; hostedCheckoutUrl: string }> {
  const webhookUrl =
    process.env.SUMUP_WEBHOOK_URL?.trim() ?? `${appBaseUrl()}/api/deposits/sumup/webhook`;
  const redirectUrl =
    process.env.SUMUP_REDIRECT_URL?.trim() ??
    `${appBaseUrl()}/deposit/return?intent=${encodeURIComponent(params.intentId)}`;

  const res = await fetch(`${SUMUP_API}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amountClp,
      currency: "CLP",
      checkout_reference: params.checkoutReference,
      description: params.description,
      merchant_code: merchantCode(),
      redirect_url: redirectUrl,
      return_url: webhookUrl,
      hosted_checkout: { enabled: true },
    }),
  });

  const data = (await res.json().catch(() => ({}))) as SumUpCheckout & {
    message?: string;
    error_message?: string;
    hosted_checkout?: { url?: string };
  };

  if (!res.ok) {
    const msg = data.error_message ?? data.message ?? `SumUp ${res.status}`;
    if (res.status === 401) {
      throw new Error(
        `SumUp 401 Unauthorized — use a secret API key (sup_sk_), not the public key (sup_pk_). ${msg}`,
      );
    }
    throw new Error(msg);
  }

  const hostedUrl =
    data.hosted_checkout_url ??
    data.hosted_checkout?.url ??
    null;

  if (!data.id || !hostedUrl) {
    throw new Error("SumUp checkout missing id or hosted_checkout_url");
  }

  return { checkoutId: data.id, hostedCheckoutUrl: hostedUrl };
}

/** Fetch authoritative checkout status from SumUp (webhook verification). */
export async function getCheckout(checkoutId: string): Promise<SumUpCheckout> {
  const res = await fetch(`${SUMUP_API}/checkouts/${encodeURIComponent(checkoutId)}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as SumUpCheckout & { message?: string };
  if (!res.ok) {
    throw new Error(data.message ?? `SumUp get checkout ${res.status}`);
  }
  return data;
}

export function isCheckoutPaid(checkout: SumUpCheckout): boolean {
  const status = checkout.status?.toUpperCase() ?? "";
  if (status === "PAID" || status === "SUCCESSFUL" || status === "SUCCESS") return true;
  const tx = checkout.transactions?.[0];
  const txStatus = tx?.status?.toUpperCase() ?? "";
  return txStatus === "SUCCESSFUL" || txStatus === "PAID";
}

export function primaryTransactionId(checkout: SumUpCheckout): string | null {
  return checkout.transactions?.[0]?.id ?? null;
}
