"use client";

import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PaymentReceipt } from "@/lib/payment/payment-receipt";

export function CheckoutSuccessScreen({
  merchantName,
  amountUsd,
  transactionHash,
  receipt,
}: {
  merchantName: string;
  amountUsd: string;
  transactionHash: string | null;
  receipt: PaymentReceipt;
}) {
  const router = useRouter();

  const handleDone = () => {
    router.push("/home");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        {/* Success icon */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20">
          <Check className="h-10 w-10 text-emerald-400" />
        </div>

        {/* Success message */}
        <div>
          <h1 className="mb-2 text-3xl font-bold text-white">Payment sent</h1>
          <p className="text-white/60">Your payment has been confirmed</p>
        </div>

        {/* Amount paid */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="mb-4">
            <div className="text-sm text-white/60">You paid</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">${amountUsd}</div>
            <div className="mt-1 text-sm text-white/60">to {merchantName}</div>
          </div>

          {/* Cashback badge */}
          <div className="rounded-lg bg-emerald-500/10 px-4 py-3 text-center">
            <div className="text-sm font-medium text-emerald-400">
              You earned 3% cashback instantly
            </div>
            <div className="mt-1 text-xs text-emerald-400/60">
              ${(parseFloat(amountUsd) * 0.03).toFixed(2)} USDC credited to your wallet
            </div>
          </div>
        </div>

        {/* Transaction details */}
        {transactionHash && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-left">
            <div className="text-xs font-medium text-white/40 uppercase tracking-wide mb-2">
              Transaction
            </div>
            <div className="break-all text-xs font-mono text-white/60">
              {transactionHash}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={handleDone}
            className="w-full bg-white text-black hover:bg-white/90 font-medium py-6 text-lg"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
