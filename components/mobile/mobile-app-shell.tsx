"use client"

import dynamic from "next/dynamic"
import { Suspense, useState, useCallback, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { useHorizontalPanelSwipe } from "@/hooks/use-horizontal-panel-swipe"
import { useAppViewportLock } from "@/hooks/use-app-viewport-lock"
import { WalletDataProvider } from "@/components/wallet/wallet-data-provider"
import { WalletLanguageProvider } from "@/lib/wallet-language"
import { signalShellReady } from "@/lib/app-ready"
// Static import: landing panel is always mounted, so paying the dynamic chunk
// cost on cold start would delay the first paint unnecessarily.
import { WalletScreen } from "@/components/wallet/wallet-screen"

const SettingsPanel = dynamic(
  () => import("@/app/settings/page").then(mod => ({ default: mod.default })),
  { ssr: false, loading: () => null },
)

// History panel lazy-loads — only needed after the user swipes right.
const WalletScreenHistory = dynamic(
  () => import("@/components/wallet/wallet-screen").then((mod) => ({ default: mod.WalletScreen })),
  { ssr: false },
)

// 0 = Settings  |  1 = Landing (balance + commands)  |  2 = History
const PANEL_COUNT = 3

const PANEL_NAMES = ["settings", "home", "history"] as const
type PanelName = (typeof PANEL_NAMES)[number]

function panelIndex(name: string | null): number {
  if (!name) return 1
  const idx = PANEL_NAMES.indexOf(name as PanelName)
  if (idx >= 0) return idx
  // Legacy ?panel=wallet lands on balance + commands
  if (name === "wallet") return 1
  return 1
}

export function MobileAppShell() {
  const searchParams = useSearchParams()
  const [activePanel, setActivePanel] = useState(() => panelIndex(searchParams?.get("panel")))
  const [isSendModalOpen, setIsSendModalOpen] = useState(false)
  const [historyMounted, setHistoryMounted] = useState(false)
  const panelParamConsumedRef = useRef(false)

  useEffect(() => {
    if (activePanel === 2) setHistoryMounted(true)
  }, [activePanel])

  useAppViewportLock()

  useEffect(() => {
    if (panelParamConsumedRef.current) return
    const panel = searchParams?.get("panel")
    if (!panel) return

    panelParamConsumedRef.current = true
    setActivePanel(panelIndex(panel))

    const url = new URL(window.location.href)
    if (!url.searchParams.has("panel")) return
    url.searchParams.delete("panel")
    const next = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState(window.history.state, "", next)
  }, [searchParams])

  // Signal that the shell has painted so the preloader can dismiss immediately.
  // Double-rAF ensures we're past the first composite frame before fading.
  useEffect(() => {
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        signalShellReady()
      })
      return () => cancelAnimationFrame(raf2)
    })
    return () => cancelAnimationFrame(raf1)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, [])

  const goLeft = useCallback(() => {
    setActivePanel(p => Math.max(0, p - 1))
  }, [])

  const goRight = useCallback(() => {
    setActivePanel(p => Math.min(PANEL_COUNT - 1, p + 1))
  }, [])

  const swipeHandlers = useHorizontalPanelSwipe({
    onSwipeLeft: goRight,
    onSwipeRight: goLeft,
    disabled: isSendModalOpen,
  })

  const handlePayClick = useCallback(() => {
    setIsSendModalOpen(true)
  }, [])

  const translateX = -((100 / PANEL_COUNT) * activePanel)

  return (
    <WalletLanguageProvider>
      <WalletDataProvider>
        <div
          className={`sozu-app-shell sozu-app-viewport overscroll-none select-none touch-pan-x ${
            isSendModalOpen ? "cursor-default" : "cursor-grab active:cursor-grabbing"
          }`}
      onTouchStart={swipeHandlers.onTouchStart}
      onTouchMove={swipeHandlers.onTouchMove}
      onTouchEnd={swipeHandlers.onTouchEnd}
      onMouseDown={swipeHandlers.onMouseDown}
      onMouseMove={swipeHandlers.onMouseMove}
      onMouseUp={swipeHandlers.onMouseUp}
      onMouseLeave={swipeHandlers.onMouseLeave}
    >
      <div
        className="flex h-full overflow-hidden"
        style={{
          width: `${PANEL_COUNT * 100}%`,
          transform: `translateX(${translateX}%)`,
          transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
          willChange: "transform",
        }}
      >
        {/* Panel 0 — Settings (lazy: only mount when visited) */}
        <div
          className="h-full overflow-y-auto overscroll-none no-scrollbar"
          style={{ width: `${100 / PANEL_COUNT}%` }}
        >
          {activePanel === 0 ? (
            <Suspense fallback={null}>
              <SettingsPanel />
            </Suspense>
          ) : null}
        </div>

        {/* Panel 1 — Landing: balance card + commands (statically imported, critical path) */}
        <div className="h-full overflow-hidden" style={{ width: `${100 / PANEL_COUNT}%` }}>
          <WalletScreen
            shellLayout="landing"
            isSendModalOpen={isSendModalOpen}
            onSendModalOpenChange={setIsSendModalOpen}
            onPayClick={handlePayClick}
            hideBottomBar
          />
        </div>

        {/* Panel 2 — Transaction history (lazy: only mounted after first swipe) */}
        <div className="relative h-full overflow-hidden" style={{ width: `${100 / PANEL_COUNT}%` }}>
          {historyMounted ? (
            <Suspense fallback={null}>
              <WalletScreenHistory shellLayout="history" hideBottomBar />
            </Suspense>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] left-1/2 z-50 flex -translate-x-1/2 gap-1.5">
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
      </WalletDataProvider>
    </WalletLanguageProvider>
  )
}
