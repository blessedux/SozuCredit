import { getUserId } from "@/lib/wallet-utils";
import type { PaymentReceipt } from "@/lib/payment/payment-receipt";
import { formatRecipientDisplayLabel } from "@/lib/payment/payment-receipt";

const SOZUPAY_URL = process.env.NEXT_PUBLIC_SOZUPAY_URL || "https://pay.sozu.capital";

export type CheckoutPaymentResult =
  | { success: true; transactionHash: string; receipt: PaymentReceipt }
  | { success: false; error: string; code?: string };

/**
 * Submit SOZU payment for checkout using existing wallet payment flow.
 * Reuses the passkey signing infrastructure from use-send-payment.
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

    // Build and submit payment via existing API
    const buildResponse = await fetch("/api/wallet/stellar/payment", {
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

    if (!buildResponse.ok) {
      const errorData = await buildResponse.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || "Failed to prepare payment",
        code: errorData.code,
      };
    }

    const buildData = await buildResponse.json();

    // If we got a transaction to sign
    if (buildData.transactionXdr) {
      // Dynamic import to keep bundle size down
      const { signSorobanTransferC } = await import(
        "@/lib/stellar/smartAccounts/signSorobanTransferC"
      );

      const signResult = await signSorobanTransferC({
        recipientAddress: destination,
        amountUsdc: parseFloat(amountUsd),
        userId,
        unsignedEnvelopeXdr: buildData.transactionXdr,
        contractId: buildData.contractId,
        signer: buildData.signer,
        credentialId: buildData.credentialId,
      });

      if (!signResult.success) {
        return {
          success: false,
          error: signResult.error || "Payment signing failed",
        };
      }

      // Submit signed transaction
      const submitResponse = await fetch("/api/wallet/stellar/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          signedEnvelopeXdr: signResult.signedEnvelopeXdr,
        }),
      });

      if (!submitResponse.ok) {
        const errorData = await submitResponse.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || "Payment submission failed",
          code: errorData.code,
        };
      }

      const submitData = await submitResponse.json();

      if (!submitData.transactionHash) {
        return { success: false, error: "No transaction hash returned" };
      }

      // Mark checkout complete
      try {
        await fetch(`${SOZUPAY_URL}/api/checkout/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: sessionId,
            transactionHash: submitData.transactionHash,
            paymentMethod: "sozu",
          }),
        });
      } catch (completeErr) {
        console.error("[checkout] Complete API call failed:", completeErr);
        // Continue - payment succeeded, completion just needs polling
      }

      // Build receipt
      const receipt: PaymentReceipt = {
        hash: submitData.transactionHash,
        amount: amountUsd,
        recipient: formatRecipientDisplayLabel(destination, merchantName),
        timestamp: Date.now(),
        confirmed: true,
      };

      return {
        success: true,
        transactionHash: submitData.transactionHash,
        receipt,
      };
    }

    return { success: false, error: "Unexpected response from payment API" };
  } catch (err) {
    console.error("[submitSozuCheckoutPayment] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Payment failed",
    };
  }
}
