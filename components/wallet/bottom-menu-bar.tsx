/**
 * Bottom menu bar component
 * Displays send and wallet buttons (QR code removed)
 */

"use client"

import { memo } from "react"
import { ArrowUp, Wallet } from "lucide-react"
import { useWalletLanguage } from "@/lib/wallet-language"

interface BottomMenuBarProps {
  onSendClick: () => void
  onWalletClick: () => void
  unreadCount?: number
}

export const BottomMenuBar = memo(function BottomMenuBar({
  onSendClick,
  onWalletClick,
  unreadCount = 0,
}: BottomMenuBarProps) {
  const { t } = useWalletLanguage()

  return (
    <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-white/10 bg-black/40 px-4 py-3 backdrop-blur-md md:px-6 md:py-4 lg:px-10 xl:px-12">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(3rem,1fr)_auto_minmax(3rem,1fr)] items-center gap-2 xl:max-w-[1320px]">
        <div aria-hidden className="min-w-[3rem]" />

        <button
          type="button"
          onClick={onSendClick}
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-lg transition-colors hover:bg-white/90 md:h-[4.5rem] md:w-[4.5rem]"
          aria-label={t.sendPayment}
        >
          <ArrowUp className="h-7 w-7 md:h-8 md:w-8" />
        </button>

        <button
          type="button"
          onClick={onWalletClick}
          className="relative ml-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-sm transition-colors hover:bg-white/20 md:h-16 md:w-16"
          aria-label={t.openProfile}
        >
          <Wallet className="h-6 w-6 text-white md:h-7 md:w-7" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </div>
    </div>
  )
})
