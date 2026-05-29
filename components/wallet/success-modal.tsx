/**
 * Success / receipt modal component
 * Displays transaction confirmation or history receipt with share options
 */

"use client"

import { memo } from "react"
import { Check } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useWalletLanguage } from "@/lib/wallet-language"
import type { PaymentReceipt } from "@/lib/payment/payment-receipt"
import { TransactionReceiptCard } from "@/components/wallet/transaction-receipt-card"
import { TransactionReceiptShare } from "@/components/wallet/transaction-receipt-share"

export type ReceiptModalVariant = "success" | "history"

interface SuccessModalProps {
  isOpen: boolean
  onClose: () => void
  receipt: PaymentReceipt | null
  variant?: ReceiptModalVariant
}

export const SuccessModal = memo(function SuccessModal({
  isOpen,
  onClose,
  receipt,
  variant = "success",
}: SuccessModalProps) {
  const { t } = useWalletLanguage()
  const isSuccess = variant === "success"

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/20 bg-black/80 text-white backdrop-blur-md sm:max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>{isSuccess ? t.transactionSuccessful : t.receiptDetailTitle}</DialogTitle>
          <DialogDescription>
            {isSuccess ? t.transactionSuccessfulDesc : t.receiptDetailDesc}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2 text-center">
          {isSuccess ? (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                <Check className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{t.transactionSuccessful}</div>
                <p className="mt-1 text-sm text-white/55">{t.transactionSuccessfulDesc}</p>
              </div>
            </>
          ) : (
            <div>
              <div className="text-2xl font-bold text-white">{t.receiptDetailTitle}</div>
              <p className="mt-1 text-sm text-white/55">{t.receiptDetailDesc}</p>
            </div>
          )}

          {receipt ? (
            <>
              <TransactionReceiptCard receipt={receipt} />
              <TransactionReceiptShare receipt={receipt} />
            </>
          ) : null}

          <Button
            onClick={onClose}
            className="h-14 w-full bg-white text-lg font-semibold text-black hover:bg-white/90"
          >
            {t.done}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
})
