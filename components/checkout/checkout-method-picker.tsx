"use client";

import { Fingerprint, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { iosHapticSingle } from "@/lib/haptics/ios-switch-pulse";

export function CheckoutMethodPicker({
  allowDebit,
  allowCredit,
  allowBankTransfer,
  onPayWithSozu,
  disabled,
}: {
  allowDebit: boolean;
  allowCredit: boolean;
  allowBankTransfer: boolean;
  onPayWithSozu: () => void;
  disabled: boolean;
}) {
  const handleSozuClick = () => {
    iosHapticSingle();
    onPayWithSozu();
  };

  return (
    <div className="space-y-4">
      <div className="text-center text-sm font-medium text-white/60">
        Choose payment method
      </div>

      {/* SOZU - primary option */}
      <button
        onClick={handleSozuClick}
        disabled={disabled}
        className="relative w-full rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-900/20 to-emerald-950/20 p-6 text-left transition-all hover:border-emerald-500/50 hover:from-emerald-900/30 hover:to-emerald-950/30 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
              <Fingerprint className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <div className="text-lg font-bold text-white">Pay with SOZU</div>
              <div className="text-sm text-white/60">One-tap passkey payment</div>
            </div>
          </div>
          <div className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-400">
            3% cashback instantly
          </div>
        </div>
      </button>

      {/* Credit/Debit cards - coming soon */}
      {(allowCredit || allowDebit) && (
        <div className="relative">
          <button
            disabled
            className="w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/5 p-6 text-left opacity-50"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                  <CreditCard className="h-6 w-6 text-white/60" />
                </div>
                <div>
                  <div className="text-lg font-bold text-white">
                    Credit / Debit Card
                  </div>
                  <div className="text-sm text-white/60">Apple Pay & card entry</div>
                </div>
              </div>
              <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/60">
                Coming soon
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
