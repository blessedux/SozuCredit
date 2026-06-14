import { getUserId } from "@/lib/wallet-utils";
import type { PaymentReceipt } from "@/lib/payment/payment-receipt";
import { getSenderDisplayLabel } from "@/lib/payment/payment-receipt";
import { getStellarConfig } from "@/lib/turnkey/config";

const SOZUPAY_URL = process.env.NEXT_PUBLIC_SOZUPAY_URL || "https://pay.sozu.capital";

export type CheckoutPaymentResult =
  | { success: true; transactionHash: string; receipt: PaymentReceipt }
  | { success: false; error: string; code?: string };

/**
 * Submit SOZU payment for checkout using existing wallet payment flow.
 * This reuses the exact same flow as the wallet send feature - just calls the API directly.
 */
export async function submitSozuCheckoutPayment({
  sessionId,
  walletAddress,
  destination,
  amountUsd,
  merchantName,
}: {
  sessionId: string;
  walletAddress: string;
  destination: string;
  amountUsd: string;
  merchantName: string;
}): Promise<CheckoutPaymentResult> {
  try {
    const userId = getUserId();
    if (!userId) {
      return { success: false, error: "Not authenticated" };
    }

    // Call the payment API directly - it handles everything including signing
    // This is the same API that wallet send uses
    const response = await fetch("/api/wallet/stellar/payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
      body: JSON.stringify({
        destination,
        amount: amountUsd,
        sender: walletAddress,
        memo: sessionId, // Include session ID for merchant reconciliation
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || "Payment failed",
        code: errorData.code,
      };
    }

    const data = await response.json();

    if (!data.transactionHash) {
      return { success: false, error: "No transaction hash returned" };
    }

    // Mark checkout complete
    try {
      await fetch(`${SOZUPAY_URL}/api/checkout/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: sessionId,
          transactionHash: data.transactionHash,
          paymentMethod: "sozu",
        }),
      });
    } catch (completeErr) {
      console.error("[checkout] Complete API call failed:", completeErr);
      // Continue - payment succeeded, completion just needs polling
    }

    // Build receipt matching PaymentReceipt type
    const stellarConfig = getStellarConfig();
    const receipt: PaymentReceipt = {
      amount: parseFloat(amountUsd),
      currency: "USDC",
      fromLabel: getSenderDisplayLabel(),
      toLabel: merchantName,
      toAddress: destination,
      transactionHash: data.transactionHash,
      network: stellarConfig.network,
      memo: sessionId,
      completedAt: new Date().toISOString(),
    };

    return {
      success: true,
      transactionHash: data.transactionHash,
      receipt,
    };
  } catch (err) {
    console.error("[submitSozuCheckoutPayment] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Payment failed",
    };
  }
}
