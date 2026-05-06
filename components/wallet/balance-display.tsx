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
    <div className="relative mb-8 lg:mb-0">
      <div className="rounded-lg border border-white/20 p-6 text-center sm:p-8 lg:flex lg:items-center lg:justify-between lg:gap-8 lg:p-9 xl:gap-10 xl:p-10 lg:text-left">
        <div
          className="flex min-h-[4rem] min-w-0 cursor-pointer select-none flex-col items-center justify-center lg:items-start"
          onClick={onToggleVisibility}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onToggleVisibility()
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={isBalanceVisible ? "Ocultar saldo" : "Mostrar saldo"}
        >
          <div className="text-5xl font-bold tabular-nums text-white sm:text-6xl lg:text-6xl xl:text-7xl">
            {isBalanceVisible ? (
              <SlidingNumber value={animatedBalance} />
            ) : (
              <span className="tabular-nums">{maskedBalance}</span>
            )}
          </div>
          <div className="mt-2 text-xl font-bold text-white sm:text-2xl">{t.currencyDisplay}</div>
        </div>
        <div className="mt-4 flex justify-center lg:mt-0 lg:flex-shrink-0 lg:justify-end lg:self-stretch lg:border-l lg:border-white/15 lg:pl-8 xl:pl-10">
          <button
            type="button"
            onClick={() => {
              if (apyLoading && onFetchAPY) {
                onFetchAPY()
              }
              onOpenBalanceAudit()
            }}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-green-400 transition-colors hover:bg-white/5 hover:text-green-300 lg:flex-col lg:py-4"
            aria-label="View Balance Audit"
          >
            <TrendingUp className="h-5 w-5 shrink-0 lg:h-6 lg:w-6" aria-hidden />
            <span className="text-base font-semibold tabular-nums sm:text-lg">{displayAPY}</span>
            <span className="max-w-[10rem] text-center text-[11px] leading-snug text-white/45 lg:block">
              Rendimiento / auditoría
            </span>
          </button>
        </div>
      </div>
    </div>
  )
})
