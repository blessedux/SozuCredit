"use client"

import { memo, useState } from "react"
import { motion } from "framer-motion"
import { Activity, ArrowUp, ChevronDown, ChevronUp, ExternalLink } from "lucide-react"
import { TransactionHistorySkeleton } from "@/components/wallet/wallet-skeleton-parts"
import { getStellarExpertTxUrl } from "@/lib/wallet-utils"
import { useWalletLanguage } from "@/lib/wallet-language"
import type { WalletActivityItem, WalletActivityKind } from "@/hooks/use-wallet-activity"
import { cn } from "@/lib/utils"

const PREVIEW_COUNT = 8

const KIND_TAG: Record<WalletActivityKind, { label: string; className: string }> = {
  chain: {
    label: "chain",
    className: "border-sky-400/25 bg-sky-400/10 text-sky-200/80",
  },
  gmail: {
    label: "gmail",
    className: "border-violet-400/25 bg-violet-400/10 text-violet-200/80",
  },
  manual: {
    label: "manual",
    className: "border-white/15 bg-white/5 text-white/45",
  },
}

type Props = {
  items: WalletActivityItem[]
  walletNetwork: "testnet" | "mainnet"
  isLoading: boolean
  onSelectChainTx?: (item: WalletActivityItem) => void
  onEmptyDepositClick?: () => void
}

export const WalletActivityList = memo(function WalletActivityList({
  items,
  walletNetwork,
  isLoading,
  onSelectChainTx,
  onEmptyDepositClick,
}: Props) {
  const { t } = useWalletLanguage()
  const [isExpanded, setIsExpanded] = useState(false)

  if (isLoading && items.length === 0) {
    return (
      <div className="pb-6" aria-busy aria-label={t.loadingTransactions}>
        <TransactionHistorySkeleton rows={8} />
      </div>
    )
  }

  const visible = isExpanded ? items : items.slice(0, PREVIEW_COUNT)
  const hasMore = items.length > PREVIEW_COUNT

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="pb-6"
    >
      <div className="rounded-lg border border-white/20 bg-white/5 p-4 sm:p-5">
        <button
          type="button"
          onClick={() => hasMore && setIsExpanded((v) => !v)}
          disabled={!hasMore}
          className={cn(
            "sticky top-0 z-10 -mx-1 mb-3 flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg border-b border-white/10 bg-black/50 px-1 py-2 text-left backdrop-blur-md",
            hasMore ? "hover:bg-white/5" : "cursor-default",
          )}
          aria-expanded={hasMore ? isExpanded : undefined}
        >
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/50">
            {t.recentActivity}
          </span>
          {hasMore ? (
            <span className="inline-flex items-center gap-1 text-sm text-white/70">
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
                  {t.showLess}
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                  {t.showAll} ({items.length})
                </>
              )}
            </span>
          ) : (
            <span className="text-xs tabular-nums text-white/40">
              {items.length} {t.transactions}
            </span>
          )}
        </button>

        <ul className="list-none space-y-2">
          {items.length === 0 ? (
            <li className="list-none py-8 text-center">
              <p className="text-sm text-white/60">{t.noTransactions}</p>
              <p className="mt-1 text-xs text-white/40">{t.emptyHistoryHint}</p>
              {onEmptyDepositClick ? (
                <button
                  type="button"
                  onClick={onEmptyDepositClick}
                  className="mt-4 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-white/90"
                >
                  {t.emptyHistoryCta}
                </button>
              ) : null}
            </li>
          ) : (
            visible.map((item) => {
              const tag = KIND_TAG[item.kind]
              const isChain = item.kind === "chain"
              const hash = item.chainTx?.hash
              const explorerUrl = hash ? getStellarExpertTxUrl(hash, walletNetwork) : null

              return (
                <li key={item.id} className="list-none">
                  <div
                    role={isChain && onSelectChainTx ? "button" : undefined}
                    tabIndex={isChain && onSelectChainTx ? 0 : undefined}
                    onClick={() => {
                      if (isChain && onSelectChainTx) onSelectChainTx(item)
                    }}
                    onKeyDown={(e) => {
                      if (!isChain || !onSelectChainTx) return
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        onSelectChainTx(item)
                      }
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-lg bg-white/5 p-3 transition-colors sm:gap-4 sm:p-4",
                      isChain && onSelectChainTx && "cursor-pointer hover:bg-white/10",
                    )}
                  >
                    <div className="shrink-0">
                      {item.direction === "in" ? (
                        <Activity className="h-5 w-5 text-green-400 sm:h-6 sm:w-6" aria-hidden />
                      ) : (
                        <ArrowUp className="h-5 w-5 text-red-400 sm:h-6 sm:w-6" aria-hidden />
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "text-lg font-semibold tabular-nums sm:text-xl",
                            item.direction === "in" ? "text-green-400" : "text-red-400",
                          )}
                        >
                          {item.amountLabel}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide border",
                            tag.className,
                          )}
                        >
                          {tag.label}
                        </span>
                      </div>

                      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 sm:justify-end">
                        <span className="min-w-0 truncate text-sm text-white/55">{item.subtitle}</span>
                        {explorerUrl ? (
                          <a
                            href={explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/10 hover:text-white/75"
                            aria-label="View on Stellar Expert"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </motion.div>
  )
})
