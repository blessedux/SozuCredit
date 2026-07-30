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
import { getOrCreateRealWallet } from "@/lib/stellar/wallet-creator"
import {
  isSmartContractWalletAddress,
  markWalletActivationComplete,
  markWelcomeOnboardingComplete,
  needsWalletActivationOnboarding,
  needsWelcomeOnboarding,
} from "@/lib/wallet/needs-activation-onboarding"

// Hooks
import { useWalletDataContext } from "@/components/wallet/wallet-data-provider"
import { useNotifications } from "@/hooks/use-notifications"
import { useSwipeGestures } from "@/hooks/use-swipe-gestures"
import { useTreasuryProjection } from "@/hooks/use-treasury-projection"
import { useCashflowSummary } from "@/hooks/use-cashflow-summary"
import { useWalletActivity } from "@/hooks/use-wallet-activity"
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh"
import { signalAppReady } from "@/lib/app-ready" // kept for analytics/telemetry consumers
import { useSetOnboardingOverlayOpen } from "@/lib/onboarding-overlay-context"

// Components
import { WalletActivationOnboarding } from "@/components/wallet/wallet-activation-onboarding"
import { BalanceDisplay } from "@/components/wallet/balance-display"
import { TransactionHistory } from "@/components/wallet/transaction-history"
import { BottomMenuBar } from "@/components/wallet/bottom-menu-bar"
import { PullToRefreshIndicator } from "@/components/wallet/pull-to-refresh-indicator"
import { CashflowSummaryCard } from "@/components/wallet/cashflow-summary-card"
import { WalletActivityList } from "@/components/wallet/wallet-activity-list"
import { UniversalCommandBar } from "@/components/home/universal-command-bar"
import type { WalletActivityItem } from "@/hooks/use-wallet-activity"
import type { PaymentReceipt } from "@/lib/payment/payment-receipt"
import { transactionToPaymentReceipt } from "@/lib/payment/transaction-to-receipt"
import type { Transaction } from "@/hooks/use-wallet-data"
import type { ReceiptModalVariant } from "@/components/wallet/success-modal"

// Lazy load modals
import { WalletSwitcherModal } from "@/components/wallet/wallet-switcher-modal"
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
  isDepositModalOpen?: boolean
  onDepositModalOpenChange?: (open: boolean) => void
  /** Hide the fixed bottom bar (mobile shell renders its own nav). */
  hideBottomBar?: boolean
  /** Mobile shell panel layout — landing merges balance + commands; history is tx list only. */
  shellLayout?: WalletShellLayout
  onPayClick?: () => void
}

export function WalletScreen({
  isSendModalOpen: isSendModalOpenProp,
  onSendModalOpenChange,
  isDepositModalOpen: isDepositModalOpenProp,
  onDepositModalOpenChange,
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
    fetchDefindexBalance,
    fetchAPY,
    setWalletAddress,
    setWalletNetwork,
  } = walletData

  // Notifications hook
  const { notifications, unreadCount, markAsRead } = useNotifications()

  // UI State
  const [isWalletSwitcherOpen, setIsWalletSwitcherOpen] = useState(false)
  const swipeUpStartY = useRef<number | null>(null)
  const swipeUpStartX = useRef<number | null>(null)
  const [openPayScannerOnMount, setOpenPayScannerOnMount] = useState(false)
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
  const [isDepositOpenInternal, setIsDepositOpenInternal] = useState(false)
  const isDepositOpen =
    isDepositModalOpenProp !== undefined ? isDepositModalOpenProp : isDepositOpenInternal
  const setIsDepositOpen = useCallback(
    (open: boolean) => {
      if (onDepositModalOpenChange) onDepositModalOpenChange(open)
      else setIsDepositOpenInternal(open)
    },
    [onDepositModalOpenChange],
  )
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [paymentReceipt, setPaymentReceipt] = useState<PaymentReceipt | null>(null)
  const [receiptModalVariant, setReceiptModalVariant] = useState<ReceiptModalVariant>("success")
  const [welcomeNeeded, setWelcomeNeeded] = useState(false)
  const [activationNeeded, setActivationNeeded] = useState(false)
  const [isActivating, setIsActivating] = useState(false)
  const [activationMessage, setActivationMessage] = useState<string | null>(null)
  const [showActivationOnboarding, setShowActivationOnboarding] = useState(false)
  const [activationSettled, setActivationSettled] = useState(false)
  const [walletRevealed, setWalletRevealed] = useState(true)
  const autoActivationStartedRef = useRef(false)
  const setOnboardingOverlayOpen = useSetOnboardingOverlayOpen()

  useEffect(() => {
    setOnboardingOverlayOpen(showActivationOnboarding)
    return () => setOnboardingOverlayOpen(false)
  }, [showActivationOnboarding, setOnboardingOverlayOpen])

  // Balance animation refs
  const animatedBalanceRef = useRef(0)
  const baseBalanceRef = useRef(0)

  // Get base balance
  const baseBalance = useMemo(() => {
    if (defindexBalance) {
      const parts =
        (defindexBalance.walletBalance ?? 0) +
        (defindexBalance.sorobanSacBalance ?? 0) +
        (defindexBalance.strategyBalance ?? 0)
      if (parts > 0) return parts
      return defindexBalance.displayBalance ?? defindexBalance.totalBalance ?? 0
    }
    return Number(vault?.balance || 0)
  }, [defindexBalance, vault?.balance])

  // Keep card figure in sync with loaded USDC (avoid resetting to $0 while refetching).
  useEffect(() => {
    if (isBalanceLoading && baseBalance === 0 && defindexBalance === null) return
    if (Math.abs(baseBalance - animatedBalanceRef.current) < 0.000_001) return
    animatedBalanceRef.current = baseBalance
    baseBalanceRef.current = baseBalance
    setAnimatedBalance(baseBalance)
  }, [baseBalance, defindexBalance, isBalanceLoading])

  // Treasury projection
  const treasuryData = useTreasuryProjection(animatedBalance)
  const cashflowSummary = useCashflowSummary(shellLayout === "history")

  const refreshChainHistory = useCallback(() => {
    if (walletAddress) void fetchTransactionHistory(walletAddress)
  }, [walletAddress, fetchTransactionHistory])

  const walletActivity = useWalletActivity({
    enabled: shellLayout === "history",
    walletAddress,
    currencyDisplay: t.currencyDisplay,
    chainTransactions: transactionHistory,
    addressToTagMap,
    onRefreshChain: refreshChainHistory,
  })

  // Signal data-ready for analytics once balance is loaded (preloader is already gone by this point).
  useEffect(() => {
    if (shellLayout !== "landing" || isBalanceLoading) return
    if (!walletRevealed || showActivationOnboarding) return
    signalAppReady()
  }, [shellLayout, isBalanceLoading, walletRevealed, showActivationOnboarding])

  const historyChartsLoading =
    cashflowSummary.loading ||
    (animatedBalance > 0 && treasuryData.loading && !treasuryData.projection)
  const historyActivityLoading =
    Boolean(walletAddress) &&
    (walletActivity.loading || isLoadingTransactions || (isLoading && transactionHistory.length === 0))

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
    isProfileSheetOpen || isDepositOpen,
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

  /** Reload balances + tx list; Soroban SAC can lag 2–15s after a successful send. */
  const refreshWalletData = useCallback(
    async (opts?: { pollSoroban?: boolean }) => {
      if (!walletAddress) return
      const uid = getUserId()
      const run = async () => {
        if (uid) void fetchXLMBalance(walletAddress, uid, { gateBalance: true })
        await fetchWalletUSDCBalance(walletAddress)
        if (uid) void fetchDefindexBalance(uid, walletAddress)
        void fetchTransactionHistory(walletAddress)
      }
      await run()
      if (opts?.pollSoroban && walletAddress.startsWith("C")) {
        for (const ms of [4000, 10000]) {
          await new Promise((resolve) => setTimeout(resolve, ms))
          await run()
        }
      }
    },
    [
      walletAddress,
      fetchXLMBalance,
      fetchWalletUSDCBalance,
      fetchDefindexBalance,
      fetchTransactionHistory,
    ],
  )

  const handleRefresh = useCallback(() => {
    void refreshWalletData()
  }, [refreshWalletData])

  const handleBalanceRefresh = useCallback(async () => {
    if (!walletAddress) return
    const uid = getUserId()
    if (uid) fetchXLMBalance(walletAddress, uid, { gateBalance: true })
    await fetchWalletUSDCBalance(walletAddress)
    if (uid) fetchAPY(uid)
  }, [walletAddress, fetchXLMBalance, fetchWalletUSDCBalance, fetchAPY])

  // Refresh after earn deposit/withdraw: reload USDC + defindex balance + APY
  const handleEarnRefresh = useCallback(async () => {
    if (!walletAddress) return
    const uid = getUserId()
    await fetchWalletUSDCBalance(walletAddress)
    if (uid) {
      void fetchDefindexBalance(uid, walletAddress)
      fetchAPY(uid)
    }
  }, [walletAddress, fetchWalletUSDCBalance, fetchDefindexBalance, fetchAPY])

  /** Stable callback — inline arrows in SendPaymentModal caused a balance-fetch loop. */
  const handleSendModalRefresh = useCallback(async () => {
    await refreshWalletData({ pollSoroban: false })
  }, [refreshWalletData])

  const { pull, progress, refreshing, isPulling, handlers: pullHandlers } = usePullToRefresh({
    onRefresh: handleBalanceRefresh,
    disabled:
      isLoading ||
      isBalanceLoading ||
      shellLayout !== "landing" ||
      isDepositOpen,
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

  // Success handler — poll Soroban balance (RPC/indexing lags behind confirmation UI)
  const handleSendSuccess = useCallback(
    (receipt: PaymentReceipt) => {
      setPaymentReceipt(receipt)
      setReceiptModalVariant("success")
      setShowSuccessModal(true)
      setSendModalOpen(false)
      void refreshWalletData({ pollSoroban: true })
    },
    [setSendModalOpen, refreshWalletData],
  )

  const handleTransactionSelect = useCallback(
    (tx: Transaction) => {
      const receipt = transactionToPaymentReceipt(
        tx,
        walletAddress,
        walletNetwork,
        addressToTagMap,
      )
      if (!receipt) return
      setPaymentReceipt(receipt)
      setReceiptModalVariant("history")
      setShowSuccessModal(true)
    },
    [walletAddress, walletNetwork, addressToTagMap],
  )

  const handleActivitySelect = useCallback(
    (item: WalletActivityItem) => {
      if (!item.chainTx) return
      handleTransactionSelect(item.chainTx)
    },
    [handleTransactionSelect],
  )

  const handleDepositClose = useCallback(() => {
    setIsDepositOpen(false)
    void refreshWalletData({ pollSoroban: true })
  }, [setIsDepositOpen, refreshWalletData])

  const refreshOnboardingState = useCallback(async () => {
    if (walletNetwork !== "testnet") {
      setWelcomeNeeded(false)
      setActivationNeeded(false)
      return
    }
    const userId = getUserId()
    const welcome = needsWelcomeOnboarding({ walletNetwork, userId })
    setWelcomeNeeded(welcome)

    if (welcome || !walletAddress) {
      setActivationNeeded(false)
      return
    }

    const legacyG = await needsWalletActivationOnboarding({
      walletAddress,
      walletNetwork,
      userId,
    })
    setActivationNeeded(legacyG)
  }, [walletAddress, walletNetwork])

  useEffect(() => {
    void refreshOnboardingState()
  }, [refreshOnboardingState])

  const handleActivationOnboardingExit = useCallback(async () => {
    markWelcomeOnboardingComplete(getUserId())
    markWalletActivationComplete()
    setShowActivationOnboarding(false)
    setWalletRevealed(true)
    setActivationSettled(false)
    setWelcomeNeeded(false)
    await refreshOnboardingState()
  }, [refreshOnboardingState])

  const runActivationWithOnboarding = useCallback(async () => {
    if (!walletAddress || walletNetwork !== "testnet" || isActivating) return

    setIsActivating(true)
    setActivationSettled(false)
    setShowActivationOnboarding(true)
    setWalletRevealed(false)
    setActivationMessage(null)

    try {
      const userId = getUserId()
      const result = await getOrCreateRealWallet(userId || undefined, {
        onStatusUpdate: (s) => setActivationMessage(s.message),
      })
      if (result.status === "error") throw new Error(result.error || result.message)

      markWalletActivationComplete()
      const uid = typeof window !== "undefined" ? sessionStorage.getItem("dev_username") : null
      if (uid) fetchXLMBalance(walletAddress, uid, { gateBalance: true })
      fetchWalletUSDCBalance(walletAddress)
      fetchTransactionHistory(walletAddress)
    } catch (e) {
      setActivationMessage(e instanceof Error ? e.message : String(e))
      autoActivationStartedRef.current = false
    } finally {
      setActivationSettled(true)
      setIsActivating(false)
    }
  }, [
    walletAddress,
    walletNetwork,
    isActivating,
    fetchXLMBalance,
    fetchWalletUSDCBalance,
    fetchTransactionHistory,
  ])

  const runWelcomeOnboarding = useCallback(async () => {
    if (walletNetwork !== "testnet") return

    setShowActivationOnboarding(true)
    setWalletRevealed(false)
    setActivationMessage(null)

    const isLegacyG =
      walletAddress?.startsWith("G") &&
      walletAddress.length === 56 &&
      !isSmartContractWalletAddress(walletAddress)

    if (isLegacyG && activationNeeded) {
      setIsActivating(true)
      setActivationSettled(false)
      try {
        const userId = getUserId()
        const result = await getOrCreateRealWallet(userId || undefined, {
          onStatusUpdate: (s) => setActivationMessage(s.message),
        })
        if (result.status === "error") throw new Error(result.error || result.message)
        markWalletActivationComplete()
        const uid = typeof window !== "undefined" ? sessionStorage.getItem("dev_username") : null
        if (uid && walletAddress) fetchXLMBalance(walletAddress, uid, { gateBalance: true })
        fetchWalletUSDCBalance(walletAddress)
        fetchTransactionHistory(walletAddress)
      } catch (e) {
        setActivationMessage(e instanceof Error ? e.message : String(e))
        autoActivationStartedRef.current = false
      } finally {
        setActivationSettled(true)
        setIsActivating(false)
      }
      return
    }

    setActivationSettled(true)
    setIsActivating(false)
  }, [
    walletNetwork,
    walletAddress,
    activationNeeded,
    fetchXLMBalance,
    fetchWalletUSDCBalance,
    fetchTransactionHistory,
  ])

  useEffect(() => {
    if (isLoading) return
    if (walletNetwork !== "testnet") return
    if (autoActivationStartedRef.current || isActivating || showActivationOnboarding) return

    const userId = getUserId()
    if (!userId) return

    if (welcomeNeeded || needsWelcomeOnboarding({ walletNetwork, userId })) {
      autoActivationStartedRef.current = true
      void runWelcomeOnboarding()
      return
    }

    if (!walletAddress || !activationNeeded) return
    if (isSmartContractWalletAddress(walletAddress)) return

    autoActivationStartedRef.current = true
    void runActivationWithOnboarding()
  }, [
    isLoading,
    walletAddress,
    walletNetwork,
    welcomeNeeded,
    activationNeeded,
    isActivating,
    showActivationOnboarding,
    runWelcomeOnboarding,
    runActivationWithOnboarding,
  ])

  const handleFetchAPY = useCallback(() => {
    const userId = typeof window !== "undefined" ? sessionStorage.getItem("dev_username") : null
    if (userId) fetchAPY(userId)
  }, [fetchAPY])

  const handleWalletCreated = useCallback(async (publicKey: string, network: "testnet" | "mainnet") => {
    setWalletAddress(publicKey)
    setWalletNetwork(network)
    if (typeof window !== "undefined") {
      sessionStorage.setItem("stellar_public_key", publicKey)
      if (network === "testnet") sessionStorage.setItem("sozu_auto_activate", "1")
    }
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
    await refreshOnboardingState()
  }, [setWalletAddress, setWalletNetwork, refreshOnboardingState])

  const walletContentClass = cn(
    "transition-opacity duration-700 ease-out",
    walletRevealed && !showActivationOnboarding
      ? "opacity-100"
      : "opacity-0 pointer-events-none",
  )

  const activationOnboarding = (
    <WalletActivationOnboarding
      open={showActivationOnboarding}
      activationSettled={activationSettled}
      onExitComplete={() => void handleActivationOnboardingExit()}
    />
  )

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
        inlineAudit={false}
        usdcOnlySurface={shellLayout === "landing"}
        defindexBalance={defindexBalance}
        treasuryPrefs={treasuryData.prefs}
        onUpdateTreasuryPrefs={treasuryData.updatePrefs}
        walletNetwork={walletNetwork}
        onRefresh={handleEarnRefresh}
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
          referenceFiat={treasuryData.prefs.referenceFiat}
          onSuccess={handleSendSuccess}
          onRefresh={handleSendModalRefresh}
          openScannerOnMount={openPayScannerOnMount}
          onScannerOpenConsumed={() => setOpenPayScannerOnMount(false)}
        />
      </Suspense>

      <Suspense fallback={null}>
        <DepositModal
          isOpen={isDepositOpen}
          onClose={handleDepositClose}
          walletAddress={walletAddress}
          walletNetwork={walletNetwork}
        />
      </Suspense>

      <Suspense fallback={null}>
        <SuccessModal
          isOpen={showSuccessModal}
          onClose={() => {
            setShowSuccessModal(false)
            setPaymentReceipt(null)
            setReceiptModalVariant("success")
          }}
          receipt={paymentReceipt}
          variant={receiptModalVariant}
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
          showActivateWallet={false}
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
            onRefresh={handleEarnRefresh}
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

      <WalletSwitcherModal
        isOpen={isWalletSwitcherOpen}
        onClose={() => setIsWalletSwitcherOpen(false)}
        walletAddress={walletAddress}
        walletNetwork={walletNetwork}
        sozuTag={username}
      />
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
        {activationOnboarding}
        <div
          className={cn(
            "relative h-full w-full overflow-hidden touch-pan-x select-none",
            walletContentClass,
          )}
        >
          <div
            ref={landingRef}
            className="flex h-full flex-col overflow-hidden"
            onTouchStart={(e) => {
              pullHandlers.onTouchStart(e)
              swipeUpStartY.current = e.touches[0].clientY
              swipeUpStartX.current = e.touches[0].clientX
            }}
            onTouchMove={pullHandlers.onTouchMove}
            onTouchEnd={(e) => {
              pullHandlers.onTouchEnd(e)
              if (swipeUpStartY.current === null || swipeUpStartX.current === null) return
              const startY = swipeUpStartY.current
              const startX = swipeUpStartX.current
              swipeUpStartY.current = null
              swipeUpStartX.current = null
              const dy = startY - e.changedTouches[0].clientY
              const dx = Math.abs(e.changedTouches[0].clientX - startX)
              if (dx > 48) return
              if (dy > 32 && startY < 140) {
                setIsWalletSwitcherOpen(true)
              } else if (dy > 48 && startY >= 140) {
                setOpenPayScannerOnMount(true)
                setSendModalOpen(true)
              }
            }}
            onMouseDown={pullHandlers.onMouseDown}
            onMouseMove={pullHandlers.onMouseMove}
            onMouseUp={pullHandlers.onMouseUp}
          >
            <header
              className="flex shrink-0 flex-col items-center gap-1.5 pt-[max(1.25rem,env(safe-area-inset-top))]"
            >
              <button
                onClick={() => setIsWalletSwitcherOpen(true)}
                className="rounded-full focus:outline-none active:scale-90 transition-transform duration-100"
                aria-label="Cambiar billetera"
              >
                <img
                  src="/sozucapital_logo_tb.png"
                  alt="Sozu Wallet"
                  className="h-10 w-10 object-contain opacity-90 hover:opacity-100 transition-opacity"
                />
              </button>
              {walletNetwork === "testnet" && (
                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase border border-yellow-500/40 text-yellow-400 bg-yellow-500/10">
                  {t.testnetBadge}
                </span>
              )}
            </header>

            <div className="pt-6">
              <PullToRefreshIndicator pull={pull} progress={progress} refreshing={refreshing} />
            </div>

            <div
              className="flex min-h-0 flex-1 flex-col px-4 transition-transform duration-150 ease-out"
              style={{ transform: pull > 0 ? `translateY(${pull * 0.35}px)` : undefined }}
            >
              <div className="flex min-h-0 flex-1 flex-col items-center justify-start pt-2">
                <div className="flex min-h-0 w-full max-w-md flex-1 flex-col">
                  <div className="flex min-h-0 w-full flex-col">
                    {isBalanceLoading ? (
                      <BalanceCardSkeleton compact />
                    ) : (
                      balanceBlock
                    )}
                  </div>

                  <div
                    className={cn(
                      "overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                      isBalanceLoading ? "max-h-0 opacity-0" : "max-h-32 opacity-100",
                    )}
                    aria-hidden={isBalanceLoading}
                  >
                    {activationMessage ? (
                      <p className="mt-4 text-center text-xs text-red-300/90">{activationMessage}</p>
                    ) : null}

                  </div>
                </div>
              </div>

              <div className="shrink-0 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-2">
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
        {activationOnboarding}
        <div className={cn("relative flex h-full min-h-0 w-full flex-col overflow-hidden", walletContentClass)}>
          <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y no-scrollbar px-4 pt-[max(3.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto w-full max-w-lg space-y-5 lg:max-w-7xl">
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

              <WalletActivityList
                items={walletActivity.items}
                walletNetwork={walletNetwork}
                isLoading={historyActivityLoading}
                onSelectChainTx={handleActivitySelect}
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
      {activationOnboarding}
      <div className={cn("relative h-full w-full", walletContentClass)}>
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

                    {activationMessage ? (
                      <p className="mt-4 text-center text-xs text-red-300/90 lg:text-left">{activationMessage}</p>
                    ) : null}

                  </div>

                  <div className="min-w-0 lg:col-span-7 xl:col-span-8">
                    <Suspense fallback={<WalletLazySectionSkeleton className="mb-8" />}>
                      <TransactionHistory
                        transactions={transactionHistory}
                        walletAddress={walletAddress}
                        walletNetwork={walletNetwork}
                        addressToTagMap={addressToTagMap}
                        isLoading={isLoadingTransactions}
                        onSelectTransaction={handleTransactionSelect}
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
