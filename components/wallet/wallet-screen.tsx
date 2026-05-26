"use client"

import { Suspense, lazy, useEffect, useState, useRef, useCallback, useMemo } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Wallet } from "lucide-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCoins } from "@fortawesome/free-solid-svg-icons"
import { Button } from "@/components/ui/button"
import { WalletSkeleton } from "@/components/ui/wallet-skeleton"
import { WalletErrorBoundary } from "@/components/wallet/wallet-error-boundary"
import { getWalletTexts } from "@/lib/wallet-texts"
import { getUserId } from "@/lib/wallet-utils"
import { checkAccountStatus, getOrCreateRealWallet } from "@/lib/stellar/wallet-creator"

// Hooks
import { useWalletData } from "@/hooks/use-wallet-data"
import { useNotifications } from "@/hooks/use-notifications"
import { useSwipeGestures } from "@/hooks/use-swipe-gestures"

// Components
import { BalanceDisplay } from "@/components/wallet/balance-display"
import { TransactionHistory } from "@/components/wallet/transaction-history"
import { BottomMenuBar } from "@/components/wallet/bottom-menu-bar"

// Lazy load modals
const SendPaymentModal = lazy(() => import("@/components/wallet/send-payment-modal").then(mod => ({ default: mod.SendPaymentModal })))
const ProfileSheet = lazy(() => import("@/components/wallet/profile-sheet").then(mod => ({ default: mod.ProfileSheet })))
const TrustPointsModal = lazy(() => import("@/components/wallet/trust-points-modal").then(mod => ({ default: mod.TrustPointsModal })))
const BalanceAuditModal = lazy(() => import("@/components/wallet/balance-audit-modal").then(mod => ({ default: mod.BalanceAuditModal })))
const NotificationsDialog = lazy(() => import("@/components/wallet/notifications-dialog").then(mod => ({ default: mod.NotificationsDialog })))
const SuccessModal = lazy(() => import("@/components/wallet/success-modal").then(mod => ({ default: mod.SuccessModal })))

export type WalletScreenProps = {
  /** Controlled from outside (mobile shell). If omitted, state is managed internally. */
  isSendModalOpen?: boolean
  onSendModalOpenChange?: (open: boolean) => void
  /** Hide the fixed bottom bar (mobile shell renders its own nav). */
  hideBottomBar?: boolean
}

export function WalletScreen({
  isSendModalOpen: isSendModalOpenProp,
  onSendModalOpenChange,
  hideBottomBar = false,
}: WalletScreenProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Wallet data hook
  const walletData = useWalletData()
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
    if (searchParams?.get("send") === "1") {
      setSendModalOpen(true)
      router.replace("/wallet")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [isBalanceAuditOpen, setIsBalanceAuditOpen] = useState(false)
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
      if (uid) fetchXLMBalance(walletAddress, uid)
      fetchWalletUSDCBalance(walletAddress)
      fetchTransactionHistory(walletAddress)
    }
  }, [walletAddress, fetchXLMBalance, fetchWalletUSDCBalance, fetchTransactionHistory])

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
      if (uid) fetchXLMBalance(walletAddress, uid)
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

  if (error) {
    const t = getWalletTexts("es")
    return (
      <WalletErrorBoundary>
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <p className="text-red-400">{t.somethingWentWrong}: {error}</p>
        </div>
      </WalletErrorBoundary>
    )
  }

  return (
    <WalletErrorBoundary>
      <div className="relative h-full w-full">
        {(isLoading || isBalanceLoading) ? (
          <div className="relative z-10 h-full">
            <WalletSkeleton />
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
                      Testnet
                    </span>
                  )}
                  <Link
                    href="/ledger"
                    className={`group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-2 py-1.5 text-sm text-white/85 transition-colors hover:border-white/30 hover:bg-white/[0.08] ${walletNetwork === "testnet" ? "lg:ml-auto" : ""}`}
                    aria-label="Abrir cashflow"
                  >
                    <span className="px-2">Cashflow</span>
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/90 transition-colors group-hover:bg-white/20">
                      <FontAwesomeIcon icon={faCoins} style={{ color: "rgb(255, 255, 255)" }} />
                    </span>
                  </Link>
                </div>

                <div className={walletAddress ? "flex flex-col gap-8 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8 xl:gap-10" : "mx-auto flex max-w-lg flex-col"}>
                  <div className="min-w-0 lg:col-span-5 xl:col-span-4">
                    <Suspense fallback={<div className="h-32 bg-white/5 animate-pulse rounded-lg mb-8" />}>
                      <BalanceDisplay
                        animatedBalance={animatedBalance}
                        isBalanceVisible={isBalanceVisible}
                        apyValue={apyValue}
                        apyLoading={apyLoading}
                        defindexBalanceApy={defindexBalance?.apy ?? null}
                        onToggleVisibility={toggleBalanceVisibility}
                        onOpenBalanceAudit={() => setIsBalanceAuditOpen(true)}
                        onFetchAPY={handleFetchAPY}
                      />
                    </Suspense>

                    {walletAddress && walletNetwork === "testnet" && activationNeeded && (
                      <div className="mt-4 lg:mt-6">
                        <Button
                          onClick={handleActivateWallet}
                          disabled={isActivating}
                          className="h-12 min-h-[48px] w-full text-base font-semibold bg-white text-black hover:bg-white/90 rounded-lg"
                        >
                          {isActivating ? "Activando…" : "Activar billetera"}
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
                          {getWalletTexts("es").createNewWallet}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 lg:col-span-7 xl:col-span-8">
                    <Suspense fallback={<div className="h-64 bg-white/5 animate-pulse rounded-lg mb-8" />}>
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

        {/* Modals */}
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

        <Suspense fallback={null}>
          <BalanceAuditModal
            isOpen={isBalanceAuditOpen}
            onClose={() => setIsBalanceAuditOpen(false)}
            defindexBalance={defindexBalance}
            apyValue={apyValue}
            apyLoading={apyLoading}
          />
        </Suspense>

        <Suspense fallback={null}>
          <NotificationsDialog
            isOpen={isNotificationsOpen}
            onClose={() => setIsNotificationsOpen(false)}
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAsRead={markAsRead}
          />
        </Suspense>
      </div>
    </WalletErrorBoundary>
  )
}
