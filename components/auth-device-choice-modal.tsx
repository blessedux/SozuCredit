"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Smartphone, UserPlus, X } from "lucide-react"
import { useWalletLanguage } from "@/lib/wallet-language"

export interface AuthDeviceChoiceModalProps {
  isOpen: boolean
  onClose: () => void
  /** Existing account: browser hybrid / scan with a passkey-capable device. */
  onScanOtherDevice: () => void
  /** New account: username → create flow (QR on desktop without biometrics). */
  onCreateAccount: () => void
}

export function AuthDeviceChoiceModal({
  isOpen,
  onClose,
  onScanOtherDevice,
  onCreateAccount,
}: AuthDeviceChoiceModalProps) {
  const { t } = useWalletLanguage()

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            key="auth-choice-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            key="auth-choice-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-[#111] border-t border-white/10 px-6 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-device-choice-title"
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />

            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p
                  id="auth-device-choice-title"
                  className="text-base font-semibold text-white"
                >
                  {t.authDeviceChoiceTitle}
                </p>
                <p className="mt-1 text-xs text-white/45 leading-snug">
                  {t.authDeviceChoiceBody}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10"
                aria-label={t.authClose}
              >
                <X className="h-3.5 w-3.5 text-white/60" />
              </button>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={onScanOtherDevice}
                className="flex w-full items-start gap-3 rounded-2xl bg-white/[0.06] px-4 py-3.5 text-left transition-colors hover:bg-white/[0.1] active:scale-[0.99]"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08]">
                  <Smartphone className="h-4 w-4 text-white/80" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-white">
                    {t.authDeviceChoiceScan}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-white/45">
                    {t.authDeviceChoiceScanHint}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={onCreateAccount}
                className="flex w-full items-start gap-3 rounded-2xl bg-white px-4 py-3.5 text-left text-black transition-transform hover:bg-white/90 active:scale-[0.99]"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/10">
                  <UserPlus className="h-4 w-4 text-black/80" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold">
                    {t.authDeviceChoiceCreate}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-black/50">
                    {t.authDeviceChoiceCreateHint}
                  </span>
                </span>
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
