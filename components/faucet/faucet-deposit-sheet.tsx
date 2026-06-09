"use client";

/**
 * Bottom sheet for depositing USDC into a faucet vault:
 * tap "Deposit into faucet" → enter amount → sign with passkey → done.
 */

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useFaucetDeposit } from "@/hooks/use-faucet-deposit";
import { isClientAuthed } from "@/lib/client-auth-gate";
import { getFaucetTexts, readFaucetLanguage } from "@/lib/faucet/texts";
import { iosHapticSingle } from "@/lib/haptics/ios-switch-pulse";

type FaucetDepositSheetProps = {
  open: boolean;
  onClose: () => void;
  faucetName: string;
  vaultAddress: string;
  /** Called after a confirmed deposit (e.g. refresh map data). */
  onDeposited?: (amount: number) => void;
};

export function FaucetDepositSheet({
  open,
  onClose,
  faucetName,
  vaultAddress,
  onDeposited,
}: FaucetDepositSheetProps) {
  const router = useRouter();
  const t = useMemo(() => getFaucetTexts(readFaucetLanguage()), []);
  const { deposit, isDepositing, phase, error, clearError } = useFaucetDeposit();
  const [amount, setAmount] = useState("");
  const [depositedAmount, setDepositedAmount] = useState<number | null>(null);

  const authed = typeof window !== "undefined" && isClientAuthed();
  const parsedAmount = parseFloat(amount);
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;

  const close = useCallback(() => {
    if (isDepositing) return;
    setAmount("");
    setDepositedAmount(null);
    clearError();
    onClose();
  }, [isDepositing, clearError, onClose]);

  const handleDeposit = useCallback(async () => {
    if (!validAmount || isDepositing) return;
    iosHapticSingle();
    const result = await deposit({ vaultAddress, amount: parsedAmount });
    if (result) {
      setDepositedAmount(parsedAmount);
      onDeposited?.(parsedAmount);
    }
  }, [validAmount, isDepositing, deposit, vaultAddress, parsedAmount, onDeposited]);

  const phaseLabel =
    phase === "preparing"
      ? t.depositPreparing
      : phase === "signing"
        ? t.depositSigning
        : phase === "submitting"
          ? t.depositSubmitting
          : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl border-t border-amber-200/15 bg-zinc-950/95 px-7 pb-10 pt-6 backdrop-blur-xl"
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-amber-100/20" />

            {depositedAmount !== null ? (
              <div className="flex flex-col items-center gap-4 text-center">
                <div
                  className="size-14 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at 35% 30%, #fffbeb 0%, #fcd34d 30%, #f97316 70%, #9a3412 100%)",
                    boxShadow: "0 0 40px rgba(251,146,60,0.5)",
                  }}
                />
                <h2 className="text-lg font-semibold text-amber-50">
                  {t.depositSuccessTitle}
                </h2>
                <p className="text-sm text-amber-100/70">
                  {t.depositSuccessBody(depositedAmount)}
                </p>
                <button
                  onClick={close}
                  className="mt-2 w-full rounded-full border border-amber-300/30 px-8 py-3 text-sm font-medium text-amber-100/80 transition-colors hover:bg-amber-300/10"
                >
                  {t.depositClose}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-amber-50">
                    {t.depositTitle}
                  </h2>
                  <p className="mt-1 text-xs text-amber-100/50">{faucetName}</p>
                  <p className="mt-2 text-sm leading-relaxed text-amber-100/70">
                    {t.depositBody}
                  </p>
                </div>

                {!authed ? (
                  <>
                    <p className="text-sm text-amber-100/60">{t.depositNeedAuth}</p>
                    <button
                      onClick={() => router.push("/auth")}
                      className="w-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-8 py-3.5 text-base font-semibold text-black transition-transform active:scale-95"
                    >
                      {t.createWalletCta}
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        clearError();
                      }}
                      placeholder={t.depositAmountPlaceholder}
                      disabled={isDepositing}
                      className="w-full rounded-2xl border border-amber-200/15 bg-black/50 px-5 py-4 text-center text-2xl font-semibold tracking-tight text-amber-50 placeholder:text-base placeholder:font-normal placeholder:text-amber-100/30 focus:border-amber-300/40 focus:outline-none"
                    />

                    {error && (
                      <p className="text-center text-sm text-red-300/90">
                        {t.depositError}
                      </p>
                    )}

                    <button
                      onClick={handleDeposit}
                      disabled={!validAmount || isDepositing}
                      className="w-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-8 py-3.5 text-base font-semibold text-black shadow-[0_0_30px_rgba(251,146,60,0.35)] transition-transform active:scale-95 disabled:opacity-40 disabled:shadow-none"
                    >
                      {phaseLabel ?? t.depositConfirm}
                    </button>
                  </>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
