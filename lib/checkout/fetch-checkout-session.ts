import type { CheckoutSession } from "./types";

export async function fetchCheckoutSession(
  sessionId: string
): Promise<{ session: CheckoutSession } | { error: string; status?: number }> {
  try {
    const res = await fetch(`/api/checkout/proxy?id=${sessionId}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        error: data.error || `Failed to load session (${res.status})`,
        status: res.status,
      };
    }

    const session: CheckoutSession = await res.json();
    console.log("[fetchCheckoutSession] Session data:", {
      id: session.id,
      merchantName: session.merchantName,
      amountUsd: session.amountUsd,
      destinationStellarAddress: session.destinationStellarAddress,
      status: session.status,
    });
    return { session };
  } catch (err) {
    console.error("[fetchCheckoutSession] Error:", err);
    return { error: "Network error loading session" };
  }
}
