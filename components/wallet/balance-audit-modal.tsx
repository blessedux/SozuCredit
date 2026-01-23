/**
 * Balance audit modal component
 * Shows detailed breakdown of wallet balance
 */

"use client"

import { memo } from "react"
import { TrendingUp } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { getWalletTexts } from "@/lib/wallet-texts"
import type { DefindexBalance } from "@/hooks/use-wallet-data"

interface BalanceAuditModalProps {
  isOpen: boolean
  onClose: () => void
  defindexBalance: DefindexBalance | null
  apyValue: number | null
  apyLoading: boolean
}

export const BalanceAuditModal = memo(function BalanceAuditModal({
  isOpen,
  onClose,
  defindexBalance,
  apyValue,
  apyLoading,
}: BalanceAuditModalProps) {
  const t = getWalletTexts("es")
  const displayAPY = apyLoading 
    ? "..." 
    : (typeof apyValue === 'number' && !isNaN(apyValue)) 
      ? `${apyValue.toFixed(2)}` 
      : (typeof defindexBalance?.apy === 'number' && !isNaN(defindexBalance.apy)) 
        ? `${defindexBalance.apy.toFixed(2)}` 
        : "15.50"

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-black/80 backdrop-blur-md border-white/20 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white text-2xl">
            {t.balanceAudit}
          </DialogTitle>
          <DialogDescription className="text-white/60">
            {t.balanceAuditDesc}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {defindexBalance ? (
            <>
              <div className="space-y-3">
                {/* Wallet Balance */}
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
                  <span className="text-white/80">{t.wallet}</span>
                  <span className="text-white font-medium text-lg">
                    ${defindexBalance.walletBalance === 0 ? "0" : defindexBalance.walletBalance.toFixed(2)} {t.currencyDisplay}
                  </span>
                </div>

                {/* Strategy Balance */}
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
                  <span className="text-white/80">{t.defiStrategy}</span>
                  <span className="text-green-400 font-medium text-lg">
                    ${defindexBalance.strategyBalance === 0 ? "0" : defindexBalance.strategyBalance.toFixed(2)} {t.currencyDisplay}
                  </span>
                </div>

                {/* Total Balance */}
                <div className="flex justify-between items-center p-4 bg-white/10 rounded-lg border-2 border-white/20">
                  <span className="text-white font-semibold">{t.total}</span>
                  <span className="text-white font-bold text-xl">
                    ${defindexBalance.totalBalance === 0 ? "0" : defindexBalance.totalBalance.toFixed(2)} {t.currencyDisplay}
                  </span>
                </div>

                {/* Shares */}
                {defindexBalance.strategyShares > 0 && (
                  <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
                    <span className="text-white/60 text-sm">{t.shares}</span>
                    <span className="text-white/80 text-sm">
                      {defindexBalance.strategyShares.toFixed(4)}
                    </span>
                  </div>
                )}
              </div>

              {/* APY and View Blend Strategy Button */}
              <div className="mt-4 pt-4 border-t border-white/20">
                <button
                  onClick={() => {
                    window.open('https://mainnet.blend.capital/asset/?poolId=CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD&assetId=CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75', '_blank')
                  }}
                  className="w-full py-3 px-4 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    <span>{t.viewBlendStrategy}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>{displayAPY}</span>
                    <span>%</span>
                    <span>APY</span>
                  </div>
                </button>
              </div>
            </>
          ) : (
            <p className="text-white/60 text-center py-8">
              {t.noBalanceData}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
})
