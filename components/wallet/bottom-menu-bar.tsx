/**
 * Bottom menu bar component
 * Displays send and wallet buttons (QR code removed)
 */

"use client"

import { memo } from "react"
import { ArrowUp, Wallet } from "lucide-react"
import { getWalletTexts } from "@/lib/wallet-texts"

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
  const t = getWalletTexts("es")

  return (
    <div className="fixed bottom-0 left-0 right-0 z-10 px-4 py-3 md:px-6 md:py-4">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Left: Empty space (QR code removed) */}
        <div />

        {/* Center: Circular Button with Upwards Arrow - Send Payment */}
        <button
          onClick={onSendClick}
          className="flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full bg-white text-black hover:bg-white/90 transition-colors shadow-lg"
          aria-label={t.sendPayment}
        >
          <ArrowUp className="w-7 h-7 md:w-8 md:h-8" />
        </button>

        {/* Right: Wallet Button */}
        <button
          onClick={onWalletClick}
          className="flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-colors relative backdrop-blur-sm"
          aria-label={t.openProfile}
        >
          <Wallet className="w-6 h-6 md:w-7 md:h-7 text-white" />
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
