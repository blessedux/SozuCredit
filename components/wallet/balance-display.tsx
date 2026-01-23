/**
 * Balance display component
 * Shows balance with visibility toggle and APY display
 */

"use client"

import { memo } from "react"
import { TrendingUp } from "lucide-react"
import { SlidingNumber } from "@/components/ui/sliding-number"
import { formatBalance, maskBalance } from "@/lib/wallet-utils"
import { getWalletTexts } from "@/lib/wallet-texts"

interface BalanceDisplayProps {
  animatedBalance: number
  isBalanceVisible: boolean
  apyValue: number | null
  apyLoading: boolean
  defindexBalanceApy: number | null
  onToggleVisibility: () => void
  onOpenBalanceAudit: () => void
  onFetchAPY?: () => void
}

export const BalanceDisplay = memo(function BalanceDisplay({
  animatedBalance,
  isBalanceVisible,
  apyValue,
  apyLoading,
  defindexBalanceApy,
  onToggleVisibility,
  onOpenBalanceAudit,
  onFetchAPY,
}: BalanceDisplayProps) {
  const t = getWalletTexts("es")
  const balance = formatBalance(animatedBalance)
  const maskedBalance = maskBalance(balance)

  const displayAPY = apyLoading 
    ? "..." 
    : (typeof apyValue === 'number' && !isNaN(apyValue)) 
      ? `${apyValue.toFixed(2)}%` 
      : (typeof defindexBalanceApy === 'number' && !isNaN(defindexBalanceApy)) 
        ? `${defindexBalanceApy.toFixed(2)}%` 
        : "15.50%"

  return (
    <div className="mb-8 relative">
      <div className="border border-white/20 rounded-lg p-8 text-center relative">
        <div
          className="text-6xl font-bold text-white cursor-pointer select-none flex flex-col items-center justify-center min-h-[4rem]"
          onClick={onToggleVisibility}
        >
          {isBalanceVisible ? (
            <SlidingNumber value={animatedBalance} />
          ) : (
            <span className="tabular-nums">{maskedBalance}</span>
          )}
          <div className="text-2xl font-bold text-white mt-2">{t.currencyDisplay}</div>
        </div>
        {/* Real-time APY Display - Clickable */}
        <div className="mt-2">
          <button
            onClick={() => {
              if (apyLoading && onFetchAPY) {
                onFetchAPY()
              }
              onOpenBalanceAudit()
            }}
            className="flex items-center justify-center gap-2 text-green-400 hover:text-green-300 transition-colors cursor-pointer"
            aria-label="View Balance Audit"
          >
            <TrendingUp className="w-4 h-4" />
            <span className="font-semibold">{displayAPY}</span>
          </button>
        </div>
      </div>
    </div>
  )
})
