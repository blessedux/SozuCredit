/**
 * Transaction history component
 * Displays list of transactions with expand/collapse functionality
 */

"use client"

import { memo, useState } from "react"
import { motion } from "framer-motion"
import { ArrowDown, ArrowUp, ExternalLink, ChevronDown, ChevronUp, TrendingUp, Activity, ArrowRightLeft } from "lucide-react"
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
      className="mb-8"
    >
      <div className="border border-white/20 rounded-lg p-4 bg-white/5">
        <ul className="space-y-3 list-none">
          {isLoading ? (
            <li className="text-white/60 text-sm text-center py-4">{t.loadingTransactions}</li>
          ) : transactions.length === 0 ? (
            <li className="text-white/60 text-sm text-center py-4">{t.noTransactions}</li>
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
                  <motion.li
                    key={tx.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: opacity, x: 0 }}
                    transition={{ duration: 0.3 }}
                    onClick={() => !isExpanded && setIsExpanded(true)}
                    className={`flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors ${!isExpanded ? 'cursor-pointer' : ''}`}
                  >
                    <div className="flex-shrink-0 mt-1">
                      {isReceived ? (
                        <Activity className="w-5 h-5 text-green-400" />
                      ) : (
                        <ArrowUp className="w-5 h-5 text-red-400" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`text-lg font-semibold ${isReceived ? "text-green-400" : "text-red-400"}`}>
                          {isReceived ? "+" : "−"}{amount.toFixed(2)} {t.currencyDisplay}
                        </span>
                        <a
                          href={stellarExpertUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-white/40 hover:text-white/60 transition-colors flex-shrink-0"
                          aria-label="View on Stellar Expert"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                      
                      <div className="flex items-center justify-end text-sm text-white/60">
                        {isSent ? "To" : "From"}: {otherTag ? (
                          <span className="text-white font-medium ml-1">${otherTag}</span>
                        ) : (
                          <span className="text-white/40 font-mono text-xs ml-1">
                            {formatAddress(otherAddress, 8, 8)}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.li>
                )
              })}
              
              {transactions.length > 3 && (
                <li className="pt-2 border-t border-white/10">
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full flex items-center justify-center gap-2 text-white/60 hover:text-white transition-colors py-2"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        <span className="text-sm">{t.showLess}</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        <span className="text-sm">{t.showAll} ({transactions.length} {t.transactions})</span>
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
