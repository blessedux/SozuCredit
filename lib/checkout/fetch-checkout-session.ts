import type { CheckoutSession } from "./types";

const SOZUPAY_URL = process.env.NEXT_PUBLIC_SOZUPAY_URL || "https://pay.sozu.capital";

export async function fetchCheckoutSession(
  sessionId: string
): Promise<{ session: CheckoutSession } | { error: string; status?: number }> {
  try {
    const res = await fetch(`${SOZUPAY_URL}/api/checkout/public?id=${sessionId}`, {
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
    return { session };
  } catch (err) {
    console.error("[fetchCheckoutSession] Error:", err);
    return { error: "Network error loading session" };
  }
}
