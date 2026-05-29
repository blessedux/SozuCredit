"use client"

import { forwardRef, memo } from "react"
import Link from "next/link"
import type { PaymentReceipt } from "@/lib/payment/payment-receipt"
import {
  formatReceiptAmount,
  formatReceiptDate,
} from "@/lib/payment/payment-receipt"
import { getStellarExpertTxUrl } from "@/lib/wallet-utils"
import { useWalletLanguage } from "@/lib/wallet-language"
import { cn } from "@/lib/utils"

type TransactionReceiptCardProps = {
  receipt: PaymentReceipt
  className?: string
}

export const TransactionReceiptCard = memo(
  forwardRef<HTMLDivElement, TransactionReceiptCardProps>(function TransactionReceiptCard(
    { receipt, className },
    ref,
  ) {
    const { t, language } = useWalletLanguage()

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border border-white/12 bg-[#0a0a0a] p-4 text-left",
          className,
        )}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
          {t.receiptShareTitle}
        </p>
        <p className="mt-3 text-2xl font-bold tabular-nums text-white">
          {formatReceiptAmount(receipt.amount, receipt.currency)}
        </p>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-white/45">{t.receiptFromLabel}</span>
            <span className="truncate font-medium text-white/90">{receipt.fromLabel}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-white/45">{t.receiptToLabel}</span>
            <span className="truncate font-medium text-white/90">{receipt.toLabel}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-white/45">{t.receiptDateLabel}</span>
            <span className="text-white/80">
              {formatReceiptDate(receipt.completedAt, language)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-white/45">{t.receiptNetworkLabel}</span>
            <span className="text-white/80">
              {receipt.network === "testnet"
                ? t.receiptNetworkTestnet
                : t.receiptNetworkMainnet}
            </span>
          </div>
          {receipt.memo ? (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-white/45">{t.receiptMemoLabel}</span>
              <span className="truncate text-white/80">{receipt.memo}</span>
            </div>
          ) : null}
        </div>
        {receipt.transactionHash ? (
          <Link
            href={getStellarExpertTxUrl(receipt.transactionHash, receipt.network)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block truncate font-mono text-[11px] text-emerald-300/80 hover:text-emerald-300"
          >
            {receipt.transactionHash.substring(0, 10)}…
            {receipt.transactionHash.substring(receipt.transactionHash.length - 8)}
          </Link>
        ) : null}
        <p className="mt-3 text-[10px] text-white/35">{t.receiptShareFooter}</p>
      </div>
    )
  }),
)
