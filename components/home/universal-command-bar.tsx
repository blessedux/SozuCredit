"use client"

import { cn } from "@/lib/utils"
import { useWalletLanguage } from "@/lib/wallet-language"

const commandButtonClass = cn(
  "flex h-12 flex-col items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04]",
  "text-[9px] font-medium uppercase tracking-[0.16em] text-white/90",
  "transition-colors hover:bg-white/[0.08] active:scale-[0.97] active:bg-white/12",
)

export function UniversalCommandBar({
  className,
  onPayClick,
  onDepositClick,
  bare = false,
}: {
  className?: string
  onPayClick?: () => void
  onDepositClick?: () => void
  bare?: boolean
}) {
  const { t } = useWalletLanguage()

  const grid = (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" className={commandButtonClass} onClick={onPayClick}>
        {t.cmdPay}
      </button>
      <button type="button" className={commandButtonClass} onClick={onDepositClick}>
        {t.cmdDeposit}
      </button>
    </div>
  )

  if (bare) return <div className={cn("w-full", className)}>{grid}</div>

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[17rem] rounded-[2rem] border border-white/10 bg-black/20 p-3 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md",
        className,
      )}
    >
      <div className="mb-2 text-center text-[8px] font-light uppercase tracking-[0.28em] text-white/40">
        {t.commandTitle}
      </div>
      {grid}
    </div>
  )
}
