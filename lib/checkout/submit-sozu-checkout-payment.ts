import { getUserId } from "@/lib/wallet-utils";
import type { PaymentReceipt } from "@/lib/payment/payment-receipt";
import { getSenderDisplayLabel } from "@/lib/payment/payment-receipt";
import { getStellarConfig } from "@/lib/turnkey/config";

const SOZUPAY_URL = process.env.NEXT_PUBLIC_SOZUPAY_URL || "https://pay.sozu.capital";
// Override destination to use org treasury smart account (disbursement contract)
// instead of the classic G wallet returned by checkout session
const ORG_TREASURY_SMART_ACCOUNT = process.env.NEXT_PUBLIC_ORG_TREASURY_SMART_ACCOUNT || "CCVXRJR3WR4Y33J527JECXILVFDQEGCPBUQOYVGQDSJUKJOPVAKUSIWX";

export type CheckoutPaymentResult =
  | { success: true; transactionHash: string; receipt: PaymentReceipt }
  | { success: false; error: string; code?: string };

/**
 * Submit SOZU payment for checkout using existing wallet payment flow.
 * This follows the same pattern as use-send-payment: build transaction, sign with passkey, submit.
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

    const senderC = walletAddress.trim().toUpperCase();

    // Override destination to use org treasury smart account (disbursement contract)
    // instead of the classic G wallet returned by checkout session
    const actualDestination = ORG_TREASURY_SMART_ACCOUNT;

    console.log("[Checkout Payment] Payment details:", {
      sessionId,
      sender: senderC,
      originalDestination: destination,
      actualDestination,
      amountUsd,
      merchantName,
    });

    // Step 1: Build the unsigned transaction
    const buildResponse = await fetch("/api/wallet/stellar/payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
      body: JSON.stringify({
        destination: actualDestination,
        amount: amountUsd,
        sender: senderC,
        memo: sessionId,
      }),
    });

    if (!buildResponse.ok) {
      const errorData = await buildResponse.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || "Failed to build payment transaction",
        code: errorData.code,
      };
    }

    const build = await buildResponse.json();

    const unsignedXdr =
      typeof build.unsignedXdr === "string"
        ? build.unsignedXdr
        : typeof build.envelopeXdr === "string"
          ? build.envelopeXdr
          : null;

    if (!unsignedXdr) {
      return { success: false, error: "No unsigned transaction returned" };
    }

    const signMethod = build.signMethod as string | undefined;
    const signerPublicKey = typeof build.signerPublicKey === "string" ? build.signerPublicKey : null;
    const walletContractId = typeof build.walletAddress === "string" ? build.walletAddress : senderC;

    if (!signerPublicKey) {
      return { success: false, error: "Smart wallet signer (G…) missing. Sign out, sign in with passkey again, then retry." };
    }

    // Step 2: Get credential ID
    const { getCurrentCredentialId, storeCredentialIdInSession } = await import("@/lib/storage/key-utils");
    const credentialId =
      (typeof build.ozCredentialId === "string" ? build.ozCredentialId : null) ||
      (await getCurrentCredentialId(signerPublicKey));

    if (!credentialId) {
      return { success: false, error: "Credential ID not found. Please log in again." };
    }
    storeCredentialIdInSession(credentialId);

    // Step 3: Sign the transaction with passkey
    const stellarConfig = getStellarConfig();
    const { Networks } = await import("@stellar/stellar-sdk");
    const networkPassphrase = stellarConfig.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

    let signedEnvelopeXdr: string;

    if (signMethod === "oz_passkey" || signMethod === "oz_passkey_local") {
      const { getSmartAccountKit } = await import("@/lib/stellar/smartAccounts/client");
      const { signSorobanPreparedTxWithPasskey } = await import("@/lib/stellar/smartAccounts/signSorobanUsdc");
      const { extractSorobanDataXdr } = await import("@/lib/stellar/soroban-prepared-envelope");
      const { kit, config } = await getSmartAccountKit();
      const sorobanDataXdr =
        typeof build.sorobanDataXdr === "string" && build.sorobanDataXdr.length > 0
          ? build.sorobanDataXdr
          : extractSorobanDataXdr(unsignedXdr, config.networkPassphrase);

      signedEnvelopeXdr = await signSorobanPreparedTxWithPasskey({
        kit,
        unsignedXdr,
        sorobanDataXdr,
        networkPassphrase: config.networkPassphrase,
        credentialId,
        smartAccountContractId: walletContractId,
        webauthnVerifierAddress: config.webauthnVerifierAddress,
        supportsOzKitApi: build.supportsOzKitApi === true,
        signMethod: signMethod ?? "oz_passkey",
      });
    } else if (signMethod === "smart_g_signer") {
      const { signSorobanUsdcWithGSigner } = await import("@/lib/stellar/smartAccounts/signSorobanTransferG");
      signedEnvelopeXdr = await signSorobanUsdcWithGSigner({
        unsignedXdr,
        signerPublicKey,
        credentialId,
        userId,
        networkPassphrase,
      });
    } else {
      return { success: false, error: `Unsupported sign method: ${signMethod ?? "unknown"}` };
    }

    // Step 4: Submit the signed transaction
    const submitResponse = await fetch("/api/wallet/stellar/payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
      body: JSON.stringify({
        signedEnvelopeXdr,
      }),
    });

    if (!submitResponse.ok) {
      const submitErr = await submitResponse.json().catch(() => ({})) as { error?: string; code?: string };
      const code = submitErr.code ?? "";
      console.error("[Checkout Payment] Submit failed", { code, error: submitErr.error });
      return {
        success: false,
        error: submitErr.error || "Failed to submit payment",
        code,
      };
    }

    const result = await submitResponse.json();

    if (!result.success || !result.transactionHash) {
      return { success: false, error: "Payment submission failed" };
    }

    // Step 5: Mark checkout complete
    try {
      await fetch("/api/checkout/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: sessionId,
          transactionHash: result.transactionHash,
          paymentMethod: "sozu",
        }),
      });
    } catch (completeErr) {
      console.error("[checkout] Complete API call failed:", completeErr);
      // Continue - payment succeeded, completion just needs polling
    }

    // Build receipt matching PaymentReceipt type
    const receipt: PaymentReceipt = {
      amount: parseFloat(amountUsd),
      currency: "USDC",
      fromLabel: getSenderDisplayLabel(),
      toLabel: merchantName,
      toAddress: actualDestination,
      transactionHash: result.transactionHash,
      network: stellarConfig.network,
      memo: sessionId,
      completedAt: new Date().toISOString(),
    };

    return {
      success: true,
      transactionHash: result.transactionHash,
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
