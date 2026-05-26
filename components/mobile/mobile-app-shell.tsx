"use client"

import dynamic from "next/dynamic"
import { Suspense, useState, useCallback, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useHorizontalPanelSwipe } from "@/hooks/use-horizontal-panel-swipe"
import { HomePanel } from "@/components/mobile/home-panel"
import { WalletScreen } from "@/components/wallet/wallet-screen"

// Lazy-load the heavy settings page to avoid bundling it until first visit
const SettingsPanel = dynamic(
  () => import("@/app/settings/page").then(mod => ({ default: mod.default })),
  { ssr: false },
)

// 0 = Settings  |  1 = Home (default)  |  2 = Wallet
const PANEL_COUNT = 3

const PANEL_NAMES = ["settings", "home", "wallet"] as const
type PanelName = (typeof PANEL_NAMES)[number]

function panelIndex(name: string | null): number {
  const idx = PANEL_NAMES.indexOf(name as PanelName)
  return idx >= 0 ? idx : 1
}

export function MobileAppShell() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [activePanel, setActivePanel] = useState(() => panelIndex(searchParams?.get("panel")))
  const [isSendModalOpen, setIsSendModalOpen] = useState(false)
  const [isProfileSheetOpen, setIsProfileSheetOpen] = useState(false)
  // Track whether send modal was opened via Pay (so closing returns to Home)
  const payReturnRef = useRef(false)

  // Sync panel from URL on mount (handles redirects from /wallet and /settings)
  useEffect(() => {
    const panel = searchParams?.get("panel")
    if (panel) {
      setActivePanel(panelIndex(panel))
      router.replace("/home")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goLeft = useCallback(() => {
    setActivePanel(p => Math.max(0, p - 1))
  }, [])

  const goRight = useCallback(() => {
    setActivePanel(p => Math.min(PANEL_COUNT - 1, p + 1))
  }, [])

  // Disable shell swipe when the profile sheet is open so it doesn't conflict
  const swipeHandlers = useHorizontalPanelSwipe({
    onSwipeLeft: goRight,
    onSwipeRight: goLeft,
    disabled: isProfileSheetOpen,
  })

  const handlePayClick = useCallback(() => {
    payReturnRef.current = true
    setActivePanel(2)
    setIsSendModalOpen(true)
  }, [])

  const handleSendModalChange = useCallback((open: boolean) => {
    setIsSendModalOpen(open)
    if (!open && payReturnRef.current) {
      payReturnRef.current = false
      setActivePanel(1) // return to Home
    }
  }, [])

  const translateX = -((100 / PANEL_COUNT) * activePanel)

  return (
    <div
      className="relative h-svh w-full overflow-hidden cursor-grab active:cursor-grabbing select-none"
      onTouchStart={swipeHandlers.onTouchStart}
      onTouchMove={swipeHandlers.onTouchMove}
      onTouchEnd={swipeHandlers.onTouchEnd}
      onMouseDown={swipeHandlers.onMouseDown}
      onMouseMove={swipeHandlers.onMouseMove}
      onMouseUp={swipeHandlers.onMouseUp}
      onMouseLeave={swipeHandlers.onMouseLeave}
    >
      {/* 3-panel horizontal track */}
      <div
        className="flex h-full"
        style={{
          width: `${PANEL_COUNT * 100}%`,
          transform: `translateX(${translateX}%)`,
          transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
          willChange: "transform",
        }}
      >
        {/* Panel 0 — Settings */}
        <div className="h-full overflow-y-auto" style={{ width: `${100 / PANEL_COUNT}%` }}>
          <SettingsPanel />
        </div>

        {/* Panel 1 — Home */}
        <div className="h-full" style={{ width: `${100 / PANEL_COUNT}%` }}>
          <HomePanel onPayClick={handlePayClick} />
        </div>

        {/* Panel 2 — Wallet */}
        <div className="relative h-full" style={{ width: `${100 / PANEL_COUNT}%` }}>
          <Suspense fallback={null}>
            <WalletScreen
              isSendModalOpen={isSendModalOpen}
              onSendModalOpenChange={handleSendModalChange}
              hideBottomBar
            />
          </Suspense>
        </div>
      </div>

      {/* Swipe indicator dots */}
      <div className="pointer-events-none absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex -translate-x-1/2 gap-1.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className={`block h-1 rounded-full transition-all duration-300 ${
              i === activePanel ? "w-5 bg-white/70" : "w-1 bg-white/25"
            }`}
          />
        ))}
      </div>
    </div>
  )
}
