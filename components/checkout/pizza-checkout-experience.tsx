"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckoutMethodPicker } from "./checkout-method-picker";
import { CheckoutAmountHeader } from "./checkout-amount-header";
import { CheckoutSuccessScreen } from "./checkout-success-screen";
import { isClientAuthed } from "@/lib/client-auth-gate";
import { loadClientWalletSession } from "@/lib/client-wallet-session";
import { signPizzaRedeemIntent } from "@/lib/pizza/sign-redeem";
import { warmKitForPay } from "@/lib/stellar/smartAccounts/warm-kit-for-pay";
import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation";

type PizzaSku = {
  slug: string;
  name: string;
  merchantName: string;
  sku: string;
  amount: number;
  asset: string;
  online: boolean;
};

type PizzaCheckoutPhase = "loading" | "ready" | "paying" | "success" | "offline" | "error";

function CheckoutShell({ children }: { children: React.ReactNode }) {
  return (
    <BackgroundGradientAnimation
      firstColor="255, 100, 0"
      secondColor="255, 140, 0"
      thirdColor="255, 69, 0"
      fourthColor="0, 0, 0"
      fifthColor="255, 100, 0"
      size="80%"
      blendingValue="hard-light"
      interactive={false}
      containerClassName="min-h-screen"
    >
      <div className="flex min-h-screen flex-col items-center justify-center text-white p-4">
        <div className="w-full max-w-md space-y-6">{children}</div>
      </div>
    </BackgroundGradientAnimation>
  );
}

export function PizzaCheckoutExperience({ slug }: { slug: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<PizzaCheckoutPhase>("loading");
  const [sku, setSku] = useState<PizzaSku | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/pizza/sku?slug=${encodeURIComponent(slug)}`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as PizzaSku & { error?: string };
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error ?? "Pizza checkout not found");
        setPhase("error");
        return;
      }
      setSku(data);
      if (!data.online) {
        setPhase("offline");
        return;
      }

      const authed = await isClientAuthed();
      setIsAuthenticated(authed);
      if (authed) {
        const walletSession = await loadClientWalletSession();
        if (walletSession.publicKey) {
          setWalletAddress(walletSession.publicKey);
        }
        void warmKitForPay(walletSession.publicKey, walletSession.credentialId);
      }
      setPhase("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handlePayWithSozu = useCallback(async () => {
    if (!isAuthenticated || !walletAddress) {
      router.push(`/auth?redirect=/checkout/pizza/${encodeURIComponent(slug)}`);
      return;
    }

    setPhase("paying");
    setError(null);

    try {
      const createRes = await fetch("/api/pizza/redeems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, guestAddress: walletAddress }),
      });
      const created = (await createRes.json().catch(() => ({}))) as {
        error?: string;
        redeem?: { id?: string };
      };
      if (!createRes.ok || !created.redeem?.id) {
        setError(created.error ?? "Could not start pizza checkout");
        setPhase("error");
        return;
      }

      const result = await signPizzaRedeemIntent({
        intentId: created.redeem.id,
        guestAddress: walletAddress,
      });
      if (!result.ok) {
        setError(result.error);
        setPhase("error");
        return;
      }

      setTransactionHash(result.txHash === "already-submitted" ? null : result.txHash);
      setPhase("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pizza checkout failed");
      setPhase("error");
    }
  }, [isAuthenticated, walletAddress, router, slug]);

  if (phase === "loading") {
    return (
      <CheckoutShell>
        <div className="text-center">
          <div className="mb-4 text-lg">Loading checkout...</div>
        </div>
      </CheckoutShell>
    );
  }

  if (phase === "error") {
    return (
      <CheckoutShell>
        <div className="text-center">
          <div className="mb-4 text-xl font-bold">Unable to complete payment</div>
          <div className="mb-6 text-white/60">{error}</div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              if (sku?.online) setPhase("ready");
              else window.location.reload();
            }}
            className="rounded-lg bg-white/10 px-6 py-3 font-medium hover:bg-white/20"
          >
            Try again
          </button>
        </div>
      </CheckoutShell>
    );
  }

  if (phase === "offline" && sku) {
    return (
      <CheckoutShell>
        <div className="text-center">
          <div className="mb-4 text-xl font-bold">Payment point offline</div>
          <div className="text-white/60">
            {sku.name} is not accepting payments right now.
          </div>
        </div>
      </CheckoutShell>
    );
  }

  if (phase === "success" && sku) {
    return (
      <CheckoutSuccessScreen
        merchantName={sku.merchantName}
        amountDisplay="1"
        assetLabel="PIZZA"
        showCashback={false}
        transactionHash={transactionHash}
      />
    );
  }

  if (!sku) return null;

  return (
    <CheckoutShell>
      <CheckoutAmountHeader
        merchantName={sku.merchantName}
        amountDisplay="1"
        assetLabel="PIZZA"
        reference={sku.sku}
      />

      {phase === "ready" && (
        <>
          {!isAuthenticated && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center text-sm text-white/60">
              Sign in to pay with your SOZU wallet
            </div>
          )}
          <CheckoutMethodPicker
            allowDebit={true}
            allowCredit={true}
            allowBankTransfer={false}
            onPayWithSozu={() => void handlePayWithSozu()}
            disabled={false}
            sozuSubtitle="Confirm 1 PIZZA with passkey"
            sozuBadge="1 PIZZA"
          />
        </>
      )}

      {phase === "paying" && (
        <div className="text-center">
          <div className="mb-4 text-lg">Processing payment...</div>
          <div className="text-sm text-white/60">Please complete the passkey prompt</div>
        </div>
      )}
    </CheckoutShell>
  );
}
