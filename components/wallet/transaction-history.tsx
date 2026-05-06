/**
 * Transaction history component
 * Displays list of transactions with expand/collapse functionality
 */

"use client"

import { memo, useState } from "react"
import { motion } from "framer-motion"
import { ArrowUp, ExternalLink, ChevronDown, ChevronUp, Activity } from "lucide-react"
import { getStellarExpertTxUrl, formatAddress } from "@/lib/wallet-utils"
import { getWalletTexts } from "@/lib/wallet-texts"
import type { Transaction } from "@/hooks/use-wallet-data"

interface TransactionHistoryProps {
  transactions: Transaction[]
  walletAddress: string
  walletNetwork: "testnet" | "mainnet"
  addressToTagMap: Record<string, string>
  isLoading: boolean
}

export const TransactionHistory = memo(function TransactionHistory({
  transactions,
  walletAddress,
  walletNetwork,
  addressToTagMap,
  isLoading,
}: TransactionHistoryProps) {
  const t = getWalletTexts("es")
  const [isExpanded, setIsExpanded] = useState(false)

  if (!walletAddress) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="mb-8 lg:mb-0"
    >
      <div className="rounded-lg border border-white/20 bg-white/5 p-4 sm:p-5 lg:p-6">
        <ul className="list-none space-y-2 sm:space-y-3">
          {isLoading ? (
            <li className="py-4 text-center text-sm text-white/60" aria-live="polite">
              {t.loadingTransactions}
            </li>
          ) : transactions.length === 0 ? (
            <li className="py-4 text-center text-sm text-white/60">{t.noTransactions}</li>
          ) : (
            <>
              {(isExpanded ? transactions : transactions.slice(0, 3)).map((tx, index) => {
                const paymentOp = tx.operations.find((op: any) => op.type === "payment")
                if (!paymentOp) return null

                const isSent = paymentOp.from === walletAddress
                const isReceived = paymentOp.to === walletAddress
                const amount = paymentOp.amount
                const otherAddress = isSent ? paymentOp.to : paymentOp.from
                const otherTag = addressToTagMap[otherAddress] || null

                const stellarExpertUrl = getStellarExpertTxUrl(tx.hash, walletNetwork)
                const isFading = !isExpanded && index >= 2
                const opacity = isFading ? 0.3 : 1

                return (
                  <li key={tx.id} className="list-none">
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: opacity, x: 0 }}
                      transition={{ duration: 0.3 }}
                      onClick={() => !isExpanded && setIsExpanded(true)}
                      className={`flex items-center gap-3 rounded-lg bg-white/5 p-3 transition-colors hover:bg-white/10 sm:gap-4 sm:p-4 ${
                        !isExpanded ? "cursor-pointer" : ""
                      }`}
                    >
                      <div className="mt-0.5 shrink-0 sm:mt-0">
                        {isReceived ? (
                          <Activity className="h-5 w-5 text-green-400 sm:h-6 sm:w-6" aria-hidden />
                        ) : (
                          <ArrowUp className="h-5 w-5 text-red-400 sm:h-6 sm:w-6" aria-hidden />
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-6">
                        <span
                          className={`text-lg font-semibold tabular-nums sm:text-xl md:shrink-0 ${
                            isReceived ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {isReceived ? "+" : "−"}
                          {amount.toFixed(2)} {t.currencyDisplay}
                        </span>

                        <div className="flex min-w-0 flex-1 items-center justify-between gap-3 md:justify-end">
                          <span className="min-w-0 truncate text-left text-sm text-white/60 md:text-right">
                            <span className="text-white/45">{isSent ? "To" : "From"}:</span>{" "}
                            {otherTag ? (
                              <span className="font-medium text-white">${otherTag}</span>
                            ) : (
                              <span className="font-mono text-xs text-white/50">
                                {formatAddress(otherAddress, 8, 8)}
                              </span>
                            )}
                          </span>
                          <a
                            href={stellarExpertUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/10 hover:text-white/75"
                            aria-label="View on Stellar Expert"
                          >
                            <ExternalLink className="h-4 w-4 sm:h-5 sm:w-5" />
                          </a>
                        </div>
                      </div>
                    </motion.div>
                  </li>
                )
              })}

              {transactions.length > 3 && (
                <li className="list-none border-t border-white/10 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg py-2 text-white/60 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        <span className="text-sm">{t.showLess}</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        <span className="text-sm">
                          {t.showAll} ({transactions.length} {t.transactions})
                        </span>
                      </>
                    )}
                  </button>
                </li>
              )}
            </>
          )}
        </ul>
      </div>
    </motion.div>
  )
})
