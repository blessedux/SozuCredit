"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckoutMethodPicker } from "./checkout-method-picker";
import { CheckoutAmountHeader } from "./checkout-amount-header";
import { CheckoutSuccessScreen } from "./checkout-success-screen";
import { fetchCheckoutSession } from "@/lib/checkout/fetch-checkout-session";
import { submitSozuCheckoutPayment } from "@/lib/checkout/submit-sozu-checkout-payment";
import { isClientAuthed } from "@/lib/client-auth-gate";
import { loadClientWalletSession } from "@/lib/client-wallet-session";
import type { CheckoutSession } from "@/lib/checkout/types";
import type { PaymentReceipt } from "@/lib/payment/payment-receipt";

type CheckoutPhase =
  | "loading"
  | "ready"
  | "paying"
  | "success"
  | "expired"
  | "already_paid"
  | "error";

export function CheckoutExperience({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<CheckoutPhase>("loading");
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

  // Load session
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await fetchCheckoutSession(sessionId);

      if (cancelled) return;

      if ("error" in result) {
        if (result.status === 410) {
          setPhase("already_paid");
        } else {
          setError(result.error);
          setPhase("error");
        }
        return;
      }

      setSession(result.session);

      // Check auth status and load wallet
      const authed = await isClientAuthed();
      setIsAuthenticated(authed);

      if (authed) {
        const walletSession = await loadClientWalletSession();
        if (walletSession.publicKey) {
          setWalletAddress(walletSession.publicKey);
        }
      }

      setPhase("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const handlePayWithSozu = useCallback(async () => {
    if (!isAuthenticated || !walletAddress || !session) {
      // Redirect to auth with return path
      router.push(`/auth?redirect=/checkout/${sessionId}`);
      return;
    }

    setPhase("paying");

    const result = await submitSozuCheckoutPayment({
      sessionId,
      walletAddress,
      destination: session.destinationStellarAddress,
      amountUsd: session.amountUsd,
      merchantName: session.merchantName,
    });

    if (result.success) {
      setReceipt(result.receipt);
      setTransactionHash(result.transactionHash);
      setPhase("success");
    } else {
      setError(result.error);
      setPhase("error");
    }
  }, [isAuthenticated, walletAddress, session, router, sessionId]);

  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="mb-4 text-lg">Loading checkout...</div>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="max-w-md text-center">
          <div className="mb-4 text-xl font-bold">Unable to complete payment</div>
          <div className="mb-6 text-white/60">{error}</div>
          <button
            onClick={() => {
              setError(null);
              setPhase("ready");
            }}
            className="rounded-lg bg-white/10 px-6 py-3 font-medium hover:bg-white/20"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (phase === "already_paid") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="max-w-md text-center">
          <div className="mb-4 text-xl font-bold">Already paid</div>
          <div className="text-white/60">This payment link has already been used.</div>
        </div>
      </div>
    );
  }

  if (phase === "expired") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="max-w-md text-center">
          <div className="mb-4 text-xl font-bold">Payment link expired</div>
          <div className="text-white/60">
            This payment link is no longer valid. Please contact the merchant for a new link.
          </div>
        </div>
      </div>
    );
  }

  if (phase === "success" && session && receipt) {
    return (
      <CheckoutSuccessScreen
        merchantName={session.merchantName}
        amountUsd={session.amountUsd}
        transactionHash={transactionHash}
        receipt={receipt}
      />
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-4">
      <div className="w-full max-w-md space-y-6">
        <CheckoutAmountHeader
          merchantName={session.merchantName}
          amountUsd={session.amountUsd}
          reference={session.reference}
        />

        {phase === "ready" && (
          <>
            {!isAuthenticated && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center text-sm text-white/60">
                Sign in to pay with your SOZU wallet
              </div>
            )}
            <CheckoutMethodPicker
              allowDebit={session.allowDebit}
              allowCredit={session.allowCredit}
              allowBankTransfer={session.allowBankTransfer}
              onPayWithSozu={handlePayWithSozu}
              disabled={false}
            />
          </>
        )}

        {phase === "paying" && (
          <div className="text-center">
            <div className="mb-4 text-lg">Processing payment...</div>
            <div className="text-sm text-white/60">Please complete the passkey prompt</div>
          </div>
        )}
      </div>
    </div>
  );
}
