"use client";

import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PaymentReceipt } from "@/lib/payment/payment-receipt";
import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation";
import { useWalletLanguage } from "@/lib/wallet-language";
import { formatWalletText } from "@/lib/wallet-texts";

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
  const { t } = useWalletLanguage();

  const handleDone = () => {
    router.push("/home");
  };

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
        <div className="w-full max-w-md space-y-6 text-center">
          {/* Success icon */}
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-white/30 bg-white/10">
            <Check className="h-10 w-10 text-white" />
          </div>

          {/* Success message */}
          <div>
            <h1 className="mb-2 text-3xl font-bold text-white">{t.checkoutPaid}</h1>
            <p className="text-white/60">{t.transactionSuccessfulDesc}</p>
          </div>

          {/* Amount paid */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="mb-4">
              <div className="text-sm text-white/60">{t.checkoutPaid}</div>
              <div className="mt-1 text-3xl font-bold tabular-nums">${amountUsd}</div>
              <div className="mt-1 text-sm text-white/60">
                {formatWalletText(t.checkoutToMerchant, { merchant: merchantName })}
              </div>
            </div>

            {/* Reward badge — plain money language, not USDC jargon */}
            <div className="rounded-lg border border-white/30 bg-white/10 px-4 py-3 text-center">
              <div className="text-sm font-medium text-white">
                {t.checkoutCashback}
              </div>
              <div className="mt-1 text-xs text-white/60">
                ${(parseFloat(amountUsd) * 0.03).toFixed(2)}
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
    </BackgroundGradientAnimation>
  );
}
