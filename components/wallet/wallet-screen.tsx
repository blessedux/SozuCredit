"use client"

import { Suspense, lazy, useEffect, useState, useRef, useCallback, useMemo } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Wallet } from "lucide-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCoins } from "@fortawesome/free-solid-svg-icons"
import { Button } from "@/components/ui/button"
import { WalletLazySectionSkeleton, WalletSkeleton } from "@/components/ui/wallet-skeleton"
import { BalanceCardSkeleton } from "@/components/wallet/wallet-skeleton-parts"
import { WalletErrorBoundary } from "@/components/wallet/wallet-error-boundary"
import { useWalletLanguage } from "@/lib/wallet-language"
import { getUserId } from "@/lib/wallet-utils"
import { cn } from "@/lib/utils"
import { checkAccountStatus, getOrCreateRealWallet } from "@/lib/stellar/wallet-creator"

// Hooks
import { useWalletDataContext } from "@/components/wallet/wallet-data-provider"
import { useNotifications } from "@/hooks/use-notifications"
import { useSwipeGestures } from "@/hooks/use-swipe-gestures"
import { useTreasuryProjection } from "@/hooks/use-treasury-projection"
import { useCashflowSummary } from "@/hooks/use-cashflow-summary"
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh"
import { signalAppReady } from "@/lib/app-ready"

// Components
import { BalanceDisplay } from "@/components/wallet/balance-display"
import { TransactionHistory } from "@/components/wallet/transaction-history"
import { BottomMenuBar } from "@/components/wallet/bottom-menu-bar"
import { PullToRefreshIndicator } from "@/components/wallet/pull-to-refresh-indicator"
import { CashflowSummaryCard } from "@/components/wallet/cashflow-summary-card"
import { UniversalCommandBar } from "@/components/home/universal-command-bar"

// Lazy load modals
const SendPaymentModal = lazy(() => import("@/components/wallet/send-payment-modal").then(mod => ({ default: mod.SendPaymentModal })))
const DepositModal = lazy(() => import("@/components/home/deposit-modal").then(mod => ({ default: mod.DepositModal })))
const ProfileSheet = lazy(() => import("@/components/wallet/profile-sheet").then(mod => ({ default: mod.ProfileSheet })))
const TrustPointsModal = lazy(() => import("@/components/wallet/trust-points-modal").then(mod => ({ default: mod.TrustPointsModal })))
const BalanceAuditModal = lazy(() => import("@/components/wallet/balance-audit-modal").then(mod => ({ default: mod.BalanceAuditModal })))
const NotificationsDialog = lazy(() => import("@/components/wallet/notifications-dialog").then(mod => ({ default: mod.NotificationsDialog })))
const SuccessModal = lazy(() => import("@/components/wallet/success-modal").then(mod => ({ default: mod.SuccessModal })))

export type WalletShellLayout = "landing" | "history"

export type WalletScreenProps = {
  /** Controlled from outside (mobile shell). If omitted, state is managed internally. */
  isSendModalOpen?: boolean
  onSendModalOpenChange?: (open: boolean) => void
  /** Hide the fixed bottom bar (mobile shell renders its own nav). */
  hideBottomBar?: boolean
  /** Mobile shell panel layout — landing merges balance + commands; history is tx list only. */
  shellLayout?: WalletShellLayout
  onPayClick?: () => void
}

export function WalletScreen({
  isSendModalOpen: isSendModalOpenProp,
  onSendModalOpenChange,
  hideBottomBar = false,
  shellLayout,
  onPayClick,
}: WalletScreenProps) {
  const searchParams = useSearchParams()
  const { t } = useWalletLanguage()

  // Wallet data hook
  const walletData = useWalletDataContext()
  const {
    vault,
    isLoading,
    error,
    isBalanceLoading,
    walletAddress,
    walletNetwork,
    username,
    defindexBalance,
    apyValue,
    apyLoading,
    transactionHistory,
    isLoadingTransactions,
    addressToTagMap,
    fetchWalletUSDCBalance,
    fetchXLMBalance,
    fetchTransactionHistory,
    fetchAPY,
    setWalletAddress,
    setWalletNetwork,
  } = walletData

  // Notifications hook
  const { notifications, unreadCount, markAsRead } = useNotifications()

  // UI State
  const [isBalanceVisible, setIsBalanceVisible] = useState(true)
  const [animatedBalance, setAnimatedBalance] = useState<number>(0)
  const [isTrustModalOpen, setIsTrustModalOpen] = useState(false)
  const [isProfileSheetOpen, setIsProfileSheetOpen] = useState(false)

  // Send modal: controlled externally or internally
  const [isSendModalOpenInternal, setIsSendModalOpenInternal] = useState(false)
  const isSendModalOpen = isSendModalOpenProp !== undefined ? isSendModalOpenProp : isSendModalOpenInternal
  const setSendModalOpen = useCallback((open: boolean) => {
    if (onSendModalOpenChange) onSendModalOpenChange(open)
    else setIsSendModalOpenInternal(open)
  }, [onSendModalOpenChange])

  // Desktop deep-link: /wallet?send=1 opens send modal on mount
  useEffect(() => {
    if (searchParams?.get("send") !== "1") return

    setSendModalOpen(true)

    const url = new URL(window.location.href)
    url.searchParams.delete("send")
    const next = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState(window.history.state, "", next)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [isBalanceAuditOpen, setIsBalanceAuditOpen] = useState(false)
  const [isBalanceAuditExpanded, setIsBalanceAuditExpanded] = useState(false)
  const [isDepositOpen, setIsDepositOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [transactionHash, setTransactionHash] = useState<string | null>(null)
  const [activationNeeded, setActivationNeeded] = useState(false)
  const [isActivating, setIsActivating] = useState(false)
  const [activationMessage, setActivationMessage] = useState<string | null>(null)

  // Balance animation refs
  const animatedBalanceRef = useRef(0)
  const baseBalanceRef = useRef(0)

  // Get base balance
  const baseBalance = useMemo(() => {
    if (defindexBalance) return defindexBalance.totalBalance
    return Number(vault?.balance || 0)
  }, [defindexBalance, vault?.balance])

  // Balance animation effect
  useEffect(() => {
    const baseChanged = Math.abs(baseBalance - baseBalanceRef.current) / (baseBalanceRef.current || 1) > 0.001
    if (defindexBalance !== null && isBalanceLoading) {
      if (baseBalance > 0 && animatedBalanceRef.current === 0) {
        animatedBalanceRef.current = 0
        setAnimatedBalance(0)
        setTimeout(() => {
          animatedBalanceRef.current = baseBalance
          baseBalanceRef.current = baseBalance
          setAnimatedBalance(baseBalance)
        }, 100)
        return
      }
    }
    if (baseChanged) {
      animatedBalanceRef.current = baseBalance
      baseBalanceRef.current = baseBalance
      setAnimatedBalance(baseBalance)
    } else if (animatedBalanceRef.current === 0 && baseBalance > 0) {
      setTimeout(() => {
        animatedBalanceRef.current = baseBalance
        baseBalanceRef.current = baseBalance
        setAnimatedBalance(baseBalance)
      }, 100)
    } else if (animatedBalanceRef.current === 0) {
      animatedBalanceRef.current = baseBalance
      baseBalanceRef.current = baseBalance
      setAnimatedBalance(baseBalance)
    }
  }, [baseBalance, defindexBalance, isBalanceLoading])

  // Treasury projection
  const treasuryData = useTreasuryProjection(animatedBalance)
  const cashflowSummary = useCashflowSummary(shellLayout === "history")

  useEffect(() => {
    if (shellLayout !== "landing" || isBalanceLoading) return
    signalAppReady()
  }, [shellLayout, isBalanceLoading])

  const historyChartsLoading =
    cashflowSummary.loading ||
    (animatedBalance > 0 && treasuryData.loading && !treasuryData.projection)
  const historyTxLoading =
    Boolean(walletAddress) &&
    (isLoadingTransactions || (isLoading && transactionHistory.length === 0))

  // Toggle balance visibility
  const toggleBalanceVisibility = useCallback(() => {
    const newVisibility = !isBalanceVisible
    setIsBalanceVisible(newVisibility)
    if (newVisibility && baseBalance > 0) {
      animatedBalanceRef.current = 0
      setAnimatedBalance(0)
      setTimeout(() => {
        animatedBalanceRef.current = baseBalance
        setAnimatedBalance(baseBalance)
      }, 50)
    }
  }, [isBalanceVisible, baseBalance])

  // Swipe gestures (profile sheet)
  const swipeHandlers = useSwipeGestures(
    isProfileSheetOpen,
    () => setIsProfileSheetOpen(true),
    () => setIsProfileSheetOpen(false),
  )

  // Scroll handling
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const lastScrollTop = useRef(0)
  const lastBalanceRefresh = useRef(0)

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget
    const currentScrollTop = container.scrollTop
    if (currentScrollTop < lastScrollTop.current) {
      container.scrollTop = lastScrollTop.current
      return
    }
    const now = Date.now()
    if (currentScrollTop > lastScrollTop.current && now - lastBalanceRefresh.current > 2000) {
      lastBalanceRefresh.current = now
      if (walletAddress) fetchWalletUSDCBalance(walletAddress)
    }
    lastScrollTop.current = currentScrollTop
  }, [walletAddress, fetchWalletUSDCBalance])

  useEffect(() => {
    if (scrollContainerRef.current) {
      lastScrollTop.current = scrollContainerRef.current.scrollTop
    }
  }, [])

  // Refresh handler
  const handleRefresh = useCallback(() => {
    if (walletAddress) {
      const uid = typeof window !== "undefined" ? sessionStorage.getItem("dev_username") : null
      if (uid) fetchXLMBalance(walletAddress, uid, { gateBalance: true })
      fetchWalletUSDCBalance(walletAddress)
      fetchTransactionHistory(walletAddress)
    }
  }, [walletAddress, fetchXLMBalance, fetchWalletUSDCBalance, fetchTransactionHistory])

  const handleBalanceRefresh = useCallback(async () => {
    if (!walletAddress) return
    const uid = typeof window !== "undefined" ? sessionStorage.getItem("dev_username") : null
    if (uid) fetchXLMBalance(walletAddress, uid, { gateBalance: true })
    await fetchWalletUSDCBalance(walletAddress)
    if (uid) fetchAPY(uid)
  }, [walletAddress, fetchXLMBalance, fetchWalletUSDCBalance, fetchAPY])

  const { pull, progress, refreshing, isPulling, handlers: pullHandlers } = usePullToRefresh({
    onRefresh: handleBalanceRefresh,
    disabled: isLoading || isBalanceLoading || shellLayout !== "landing" || isBalanceAuditExpanded,
  })

  const handlePay = onPayClick ?? (() => setSendModalOpen(true))

  const landingRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (shellLayout !== "landing") return
    const el = landingRef.current
    if (!el) return

    const blockScroll = (e: TouchEvent) => {
      if (isPulling || pull > 0) e.preventDefault()
    }
    el.addEventListener("touchmove", blockScroll, { passive: false })
    return () => el.removeEventListener("touchmove", blockScroll)
  }, [shellLayout, isPulling, pull])

  // Success handler
  const handleSendSuccess = useCallback((hash: string) => {
    setTransactionHash(hash)
    setShowSuccessModal(true)
    setSendModalOpen(false)
  }, [setSendModalOpen])

  const refreshActivationState = useCallback(async () => {
    if (!walletAddress || walletNetwork !== "testnet") {
      setActivationNeeded(false)
      return
    }
    try {
      const info = await checkAccountStatus(walletAddress)
      setActivationNeeded(!(info.exists && info.hasUSDCTrustline))
    } catch {
      setActivationNeeded(true)
    }
  }, [walletAddress, walletNetwork])

  useEffect(() => { void refreshActivationState() }, [refreshActivationState])

  const handleActivateWallet = useCallback(async () => {
    if (!walletAddress || walletNetwork !== "testnet" || isActivating) return
    setIsActivating(true)
    setActivationMessage("Activando…")
    try {
      const userId = getUserId()
      const result = await getOrCreateRealWallet(userId || undefined, {
        onStatusUpdate: (s) => setActivationMessage(s.message),
      })
      if (result.status === "error") throw new Error(result.error || result.message)
      const uid = typeof window !== "undefined" ? sessionStorage.getItem("dev_username") : null
      if (uid) fetchXLMBalance(walletAddress, uid, { gateBalance: true })
      fetchWalletUSDCBalance(walletAddress)
      fetchTransactionHistory(walletAddress)
      await refreshActivationState()
      setActivationMessage(null)
    } catch (e) {
      setActivationMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setIsActivating(false)
    }
  }, [walletAddress, walletNetwork, isActivating, fetchXLMBalance, fetchWalletUSDCBalance, fetchTransactionHistory, refreshActivationState])

  const handleFetchAPY = useCallback(() => {
    const userId = typeof window !== "undefined" ? sessionStorage.getItem("dev_username") : null
    if (userId) fetchAPY(userId)
  }, [fetchAPY])

  const handleWalletCreated = useCallback(async (publicKey: string, network: "testnet" | "mainnet") => {
    setWalletAddress(publicKey)
    setWalletNetwork(network)
    if (typeof window !== "undefined") sessionStorage.setItem("stellar_public_key", publicKey)
    const userId = typeof window !== "undefined" ? sessionStorage.getItem("dev_username") : null
    if (userId) {
      try {
        await fetch("/api/wallet/stellar/create", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": userId },
          body: JSON.stringify({ publicKey }),
        })
      } catch (e) {
        console.warn("[Wallet] Register wallet after create:", e)
      }
      try {
        await fetch("/api/wallet/stellar/balance", { headers: { "x-user-id": userId } })
      } catch (error) {
        console.error("[Wallet] Error fetching balance after wallet creation:", error)
      }
    }
  }, [setWalletAddress, setWalletNetwork])

  const balanceBlock = (
    <Suspense fallback={<WalletLazySectionSkeleton className="mb-8" />}>
      <BalanceDisplay
        animatedBalance={animatedBalance}
        isBalanceVisible={isBalanceVisible}
        apyValue={apyValue}
        apyLoading={apyLoading}
        defindexBalanceApy={defindexBalance?.apy ?? null}
        onToggleVisibility={toggleBalanceVisibility}
        onOpenBalanceAudit={shellLayout === "landing" ? undefined : () => setIsBalanceAuditOpen(true)}
        onFetchAPY={handleFetchAPY}
        treasuryProjection={treasuryData.projection}
        treasuryLoading={treasuryData.loading}
        referenceFiat={treasuryData.prefs.referenceFiat}
        inlineAudit={shellLayout === "landing"}
        defindexBalance={defindexBalance}
        treasuryPrefs={treasuryData.prefs}
        onUpdateTreasuryPrefs={treasuryData.updatePrefs}
        onAuditExpandedChange={shellLayout === "landing" ? setIsBalanceAuditExpanded : undefined}
        walletNetwork={walletNetwork}
      />
    </Suspense>
  )

  const modals = (
    <>
      <Suspense fallback={null}>
        <SendPaymentModal
          isOpen={isSendModalOpen}
          onClose={() => setSendModalOpen(false)}
          walletAddress={walletAddress}
          walletNetwork={walletNetwork}
          defindexBalance={defindexBalance}
          onSuccess={handleSendSuccess}
          onRefresh={handleRefresh}
        />
      </Suspense>

      <Suspense fallback={null}>
        <DepositModal
          isOpen={isDepositOpen}
          onClose={() => setIsDepositOpen(false)}
          walletAddress={walletAddress}
        />
      </Suspense>

      <Suspense fallback={null}>
        <SuccessModal
          isOpen={showSuccessModal}
          onClose={() => { setShowSuccessModal(false); setTransactionHash(null) }}
          transactionHash={transactionHash}
        />
      </Suspense>

      <Suspense fallback={null}>
        <ProfileSheet
          isOpen={isProfileSheetOpen}
          onClose={() => setIsProfileSheetOpen(false)}
          username={username}
          walletAddress={walletAddress}
          walletNetwork={walletNetwork}
          unreadCount={unreadCount}
          onActivateWallet={walletNetwork === "testnet" ? handleActivateWallet : undefined}
          showActivateWallet={activationNeeded}
          onOpenNotifications={() => { setIsProfileSheetOpen(false); setIsNotificationsOpen(true) }}
          onWalletCreated={handleWalletCreated}
          onSwipeHandlers={swipeHandlers}
        />
      </Suspense>

      <Suspense fallback={null}>
        <TrustPointsModal isOpen={isTrustModalOpen} onClose={() => setIsTrustModalOpen(false)} />
      </Suspense>

      {shellLayout !== "landing" ? (
        <Suspense fallback={null}>
          <BalanceAuditModal
            isOpen={isBalanceAuditOpen}
            onClose={() => setIsBalanceAuditOpen(false)}
            defindexBalance={defindexBalance}
            apyValue={apyValue}
            apyLoading={apyLoading}
            treasuryProjection={treasuryData.projection}
            treasuryLoading={treasuryData.loading}
            treasuryPrefs={treasuryData.prefs}
            onUpdateTreasuryPrefs={treasuryData.updatePrefs}
            walletNetwork={walletNetwork}
          />
        </Suspense>
      ) : null}

      <Suspense fallback={null}>
        <NotificationsDialog
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAsRead={markAsRead}
        />
      </Suspense>
    </>
  )

  if (error) {
    return (
      <WalletErrorBoundary>
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <p className="text-red-400">{t.somethingWentWrong}: {error}</p>
        </div>
      </WalletErrorBoundary>
    )
  }

  if (shellLayout === "landing") {
    return (
      <WalletErrorBoundary>
        <div className="relative h-full w-full overflow-hidden touch-pan-x select-none">
          <div
            ref={landingRef}
            className="flex h-full flex-col overflow-hidden"
            onTouchStart={pullHandlers.onTouchStart}
            onTouchMove={pullHandlers.onTouchMove}
            onTouchEnd={pullHandlers.onTouchEnd}
            onMouseDown={pullHandlers.onMouseDown}
            onMouseMove={pullHandlers.onMouseMove}
            onMouseUp={pullHandlers.onMouseUp}
          >
            <header className="flex shrink-0 flex-col items-center gap-1.5 pt-[max(1.25rem,env(safe-area-inset-top))]">
              <img
                src="/sozucapital_logo_tb.png"
                alt="Sozu Wallet"
                className="h-10 w-10 object-contain opacity-90"
              />
              {walletNetwork === "testnet" && (
                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase border border-yellow-500/40 text-yellow-400 bg-yellow-500/10">
                  {t.testnetBadge}
                </span>
              )}
            </header>

            <PullToRefreshIndicator pull={pull} progress={progress} refreshing={refreshing} />

            <div
              className="flex min-h-0 flex-1 flex-col px-4 transition-transform duration-150 ease-out"
              style={{ transform: pull > 0 ? `translateY(${pull * 0.35}px)` : undefined }}
            >
              <div className="flex min-h-0 flex-1 flex-col items-center justify-start pt-2">
                <div className="flex min-h-0 w-full max-w-md flex-1 flex-col">
                  <div
                    className={cn(
                      "flex min-h-0 w-full flex-col",
                      isBalanceAuditExpanded && "flex-1 touch-pan-y",
                    )}
                  >
                    {isBalanceLoading ? (
                      <BalanceCardSkeleton compact />
                    ) : (
                      balanceBlock
                    )}
                  </div>

                  <div
                    className={cn(
                      "overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                      isBalanceAuditExpanded || isBalanceLoading ? "max-h-0 opacity-0" : "max-h-32 opacity-100",
                    )}
                    aria-hidden={isBalanceAuditExpanded || isBalanceLoading}
                  >
                    {walletAddress && walletNetwork === "testnet" && activationNeeded && (
                      <div className="mt-4">
                        <Button
                          onClick={handleActivateWallet}
                          disabled={isActivating}
                          className="h-11 w-full text-sm font-semibold bg-white text-black hover:bg-white/90 rounded-lg"
                        >
                          {isActivating ? t.activating : t.activateWallet}
                        </Button>
                        {activationMessage && (
                          <p className="mt-2 text-xs text-white/60">{activationMessage}</p>
                        )}
                      </div>
                    )}

                    {!walletAddress && !isBalanceLoading && (
                      <div className="mt-3">
                        <Button
                          onClick={() => setIsProfileSheetOpen(true)}
                          className="h-12 w-full text-base font-semibold bg-white text-black hover:bg-white/90 rounded-lg"
                        >
                          <Wallet className="mr-2 h-5 w-5" />
                          {t.createNewWallet}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="shrink-0 pb-[max(5rem,env(safe-area-inset-bottom))] pt-2">
                <div className="mx-auto w-full max-w-[17rem] rounded-[2rem] border border-white/10 bg-black/20 p-3 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md">
                  <div className="mb-2 text-center text-[8px] font-light uppercase tracking-[0.28em] text-white/40">
                    {t.commandTitle}
                  </div>
                  <UniversalCommandBar
                    bare
                    onPayClick={handlePay}
                    onDepositClick={() => setIsDepositOpen(true)}
                  />
                </div>
              </div>
            </div>
          </div>
          {modals}
        </div>
      </WalletErrorBoundary>
    )
  }

  if (shellLayout === "history") {
    return (
      <WalletErrorBoundary>
        <div className="relative h-full w-full overflow-hidden">
          <div className="relative z-10 h-full overflow-y-auto overscroll-none no-scrollbar touch-pan-x px-4 pt-[max(3.5rem,env(safe-area-inset-top))] pb-[max(5rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto w-full max-w-7xl space-y-5">
              <div className="flex justify-end">
                <Link
                  href="/ledger"
                  className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-2 py-1.5 text-sm text-white/85 transition-colors hover:border-white/30 hover:bg-white/[0.08]"
                  aria-label={t.openCashflow}
                >
                  <span className="px-2">{t.cashflowLink}</span>
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/90 transition-colors group-hover:bg-white/20">
                    <FontAwesomeIcon icon={faCoins} style={{ color: "rgb(255, 255, 255)" }} />
                  </span>
                </Link>
              </div>

              <CashflowSummaryCard
                summary={cashflowSummary.summary}
                credit={cashflowSummary.credit}
                loading={historyChartsLoading}
                treasuryProjection={treasuryData.projection}
                treasuryPrefs={treasuryData.prefs}
                protocolApy={
                  typeof apyValue === "number" && !isNaN(apyValue)
                    ? apyValue
                    : defindexBalance?.apy ?? null
                }
              />

              <TransactionHistory
                transactions={transactionHistory}
                walletAddress={walletAddress}
                walletNetwork={walletNetwork}
                addressToTagMap={addressToTagMap}
                isLoading={historyTxLoading}
              />
            </div>
          </div>
          {modals}
        </div>
      </WalletErrorBoundary>
    )
  }

  return (
    <WalletErrorBoundary>
      <div className="relative h-full w-full">
        {(isLoading || isBalanceLoading) ? (
          <div className="relative z-10 h-full">
            <WalletSkeleton layout="desktop" />
          </div>
        ) : (
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="relative z-10 h-full overflow-y-auto touch-pan-y pb-28 md:pb-32 lg:pb-36"
            onTouchStart={swipeHandlers.onTouchStart}
            onTouchMove={swipeHandlers.onTouchMove}
            onTouchEnd={swipeHandlers.onTouchEnd}
          >
            <WalletErrorBoundary>
              <div className="relative mx-auto w-full max-w-7xl xl:max-w-[1320px] px-4 pt-16 pb-8 sm:px-6 md:py-12 lg:px-10 xl:px-12">
                <div className={`mb-6 flex flex-col items-center gap-3 sm:mb-8 lg:items-center ${walletNetwork === "testnet" ? "lg:flex-row lg:justify-between" : ""}`}>
                  {walletNetwork === "testnet" && (
                    <span className="inline-flex px-3 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase border border-yellow-500/40 text-yellow-400 bg-yellow-500/10">
                      {t.testnetBadge}
                    </span>
                  )}
                  <Link
                    href="/ledger"
                    className={`group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-2 py-1.5 text-sm text-white/85 transition-colors hover:border-white/30 hover:bg-white/[0.08] ${walletNetwork === "testnet" ? "lg:ml-auto" : ""}`}
                    aria-label={t.openCashflow}
                  >
                    <span className="px-2">{t.cashflowLink}</span>
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/90 transition-colors group-hover:bg-white/20">
                      <FontAwesomeIcon icon={faCoins} style={{ color: "rgb(255, 255, 255)" }} />
                    </span>
                  </Link>
                </div>

                <div className={walletAddress ? "flex flex-col gap-8 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8 xl:gap-10" : "mx-auto flex max-w-lg flex-col"}>
                  <div className="min-w-0 lg:col-span-5 xl:col-span-4">
                    {balanceBlock}

                    {walletAddress && walletNetwork === "testnet" && activationNeeded && (
                      <div className="mt-4 lg:mt-6">
                        <Button
                          onClick={handleActivateWallet}
                          disabled={isActivating}
                          className="h-12 min-h-[48px] w-full text-base font-semibold bg-white text-black hover:bg-white/90 rounded-lg"
                        >
                          {isActivating ? t.activating : t.activateWallet}
                        </Button>
                        {activationMessage && <p className="mt-2 text-xs text-white/60">{activationMessage}</p>}
                      </div>
                    )}

                    {!walletAddress && (
                      <div className="mt-2 lg:mt-4">
                        <Button
                          onClick={() => setIsProfileSheetOpen(true)}
                          className="h-14 min-h-[48px] w-full text-lg font-semibold bg-white text-black hover:bg-white/90 transition-all duration-200 rounded-lg shadow-lg hover:shadow-xl"
                        >
                          <Wallet className="mr-2 h-5 w-5" />
                          {t.createNewWallet}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 lg:col-span-7 xl:col-span-8">
                    <Suspense fallback={<WalletLazySectionSkeleton className="mb-8" />}>
                      <TransactionHistory
                        transactions={transactionHistory}
                        walletAddress={walletAddress}
                        walletNetwork={walletNetwork}
                        addressToTagMap={addressToTagMap}
                        isLoading={isLoadingTransactions}
                      />
                    </Suspense>
                  </div>
                </div>
              </div>
            </WalletErrorBoundary>

            {!hideBottomBar && (
              <BottomMenuBar
                onSendClick={() => setSendModalOpen(true)}
                onWalletClick={() => setIsProfileSheetOpen(true)}
                unreadCount={unreadCount}
              />
            )}
          </div>
        )}

        {modals}
      </div>
    </WalletErrorBoundary>
  )
}
