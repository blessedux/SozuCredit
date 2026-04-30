"use client"

import { Suspense, lazy, useEffect, useState, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Wallet } from "lucide-react"
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

// Components - Lazy load modals for better performance
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

export default function WalletPage() {
  const router = useRouter()

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
  const {
    notifications,
    unreadCount,
    markAsRead,
  } = useNotifications()

  // UI State
  const [isBalanceVisible, setIsBalanceVisible] = useState(true)
  const [animatedBalance, setAnimatedBalance] = useState<number>(0)
  const [isTrustModalOpen, setIsTrustModalOpen] = useState(false)
  const [isProfileSheetOpen, setIsProfileSheetOpen] = useState(false)
  const [isSendModalOpen, setIsSendModalOpen] = useState(false)
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
    if (defindexBalance) {
      return defindexBalance.totalBalance
    }
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

  // Swipe gestures
  const swipeHandlers = useSwipeGestures(
    isProfileSheetOpen,
    () => setIsProfileSheetOpen(true),
    () => setIsProfileSheetOpen(false)
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
      if (walletAddress) {
        console.log("[Wallet] Scrolling down detected, refreshing balance...")
        fetchWalletUSDCBalance(walletAddress)
      }
    }

    lastScrollTop.current = currentScrollTop
  }, [walletAddress, fetchWalletUSDCBalance])

  useEffect(() => {
    if (scrollContainerRef.current) {
      lastScrollTop.current = scrollContainerRef.current.scrollTop
    }
  }, [])

  // Refresh handler for send payment
  const handleRefresh = useCallback(() => {
    if (walletAddress) {
      const uid = typeof window !== "undefined" ? sessionStorage.getItem("dev_username") : null
      if (uid) fetchXLMBalance(walletAddress, uid)
      fetchWalletUSDCBalance(walletAddress)
      fetchTransactionHistory(walletAddress)
    }
  }, [walletAddress, fetchXLMBalance, fetchWalletUSDCBalance, fetchTransactionHistory])

  // Success handler for send payment
  const handleSendSuccess = useCallback((hash: string) => {
    setTransactionHash(hash)
    setShowSuccessModal(true)
    setIsSendModalOpen(false)
  }, [])

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

  useEffect(() => {
    void refreshActivationState()
  }, [refreshActivationState])

  const handleActivateWallet = useCallback(async () => {
    if (!walletAddress || walletNetwork !== "testnet" || isActivating) return
    setIsActivating(true)
    setActivationMessage("Activando…")
    try {
      const userId = getUserId()
      const result = await getOrCreateRealWallet(userId || undefined, {
        onStatusUpdate: (s) => setActivationMessage(s.message),
      })
      if (result.status === "error") {
        throw new Error(result.error || result.message)
      }
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
  }, [
    walletAddress,
    walletNetwork,
    isActivating,
    fetchXLMBalance,
    fetchWalletUSDCBalance,
    fetchTransactionHistory,
    refreshActivationState,
  ])

  // Fetch APY handler
  const handleFetchAPY = useCallback(() => {
    const userId = typeof window !== "undefined" ? sessionStorage.getItem("dev_username") : null
    if (userId) {
      fetchAPY(userId)
    }
  }, [fetchAPY])

  // Wallet created handler (client-derived key; register with server so DB has public key only – non-custodial)
  const handleWalletCreated = useCallback(async (publicKey: string, network: "testnet" | "mainnet") => {
    setWalletAddress(publicKey)
    setWalletNetwork(network)
    if (typeof window !== "undefined") {
      sessionStorage.setItem("stellar_public_key", publicKey)
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
    }

    try {
      if (userId) {
        const balanceResponse = await fetch("/api/wallet/stellar/balance", {
          headers: { "x-user-id": userId },
        })
        if (balanceResponse.ok) {
          // Balance will be updated by wallet data hook
        }
      }
    } catch (error) {
      console.error("[Wallet] Error fetching balance after wallet creation:", error)
    }
  }, [setWalletAddress, setWalletNetwork])

  if (error) {
    const t = getWalletTexts("es")
    return (
      <WalletErrorBoundary>
        <div className="relative h-screen w-full overflow-hidden">
          <div className="relative z-10 min-h-screen flex items-center justify-center">
            <div className="text-center">
              <p className="text-red-400">{t.somethingWentWrong}: {error}</p>
            </div>
          </div>
        </div>
      </WalletErrorBoundary>
    )
  }

  return (
    <WalletErrorBoundary>
      <div className="relative h-screen w-full overflow-hidden">
        {/* Show skeleton during initial load or balance loading - animated background stays visible */}
        {(isLoading || isBalanceLoading) ? (
          <div className="relative z-10 h-full">
            <WalletSkeleton />
          </div>
        ) : (
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="relative z-10 h-full overflow-y-auto touch-pan-y pb-24 md:pb-28 opacity-0 animate-fade-in"
            onTouchStart={swipeHandlers.onTouchStart}
            onTouchMove={swipeHandlers.onTouchMove}
            onTouchEnd={swipeHandlers.onTouchEnd}
          >
            <WalletErrorBoundary>
              <div className="container mx-auto px-6 pt-16 pb-8 md:py-12 relative">
                {/* Testnet badge */}
                {walletNetwork === "testnet" && (
                  <div className="flex justify-center mb-4">
                    <span className="px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase border border-yellow-500/40 text-yellow-400 bg-yellow-500/10">
                      Testnet
                    </span>
                  </div>
                )}

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

                {/* Single CTA below balance (testnet only) */}
                {walletAddress && walletNetwork === "testnet" && activationNeeded && (
                  <div className="mt-4 mb-8">
                    <Button
                      onClick={handleActivateWallet}
                      disabled={isActivating}
                      className="w-full h-12 text-base font-semibold bg-white text-black hover:bg-white/90 rounded-lg"
                    >
                      {isActivating ? "Activando…" : "Activar billetera"}
                    </Button>
                    {activationMessage && (
                      <p className="mt-2 text-xs text-white/60">{activationMessage}</p>
                    )}
                  </div>
                )}

                {/* Transaction History */}
                <Suspense fallback={<div className="h-64 bg-white/5 animate-pulse rounded-lg mb-8" />}>
                  <TransactionHistory
                    transactions={transactionHistory}
                    walletAddress={walletAddress}
                    walletNetwork={walletNetwork}
                    addressToTagMap={addressToTagMap}
                    isLoading={isLoadingTransactions}
                  />
                </Suspense>

                {/* Create New Wallet Button */}
                {!walletAddress && (
                  <div className="mb-8">
                    <Button
                      onClick={() => setIsProfileSheetOpen(true)}
                      className="w-full h-14 text-lg font-semibold bg-white text-black hover:bg-white/90 transition-all duration-200 rounded-lg shadow-lg hover:shadow-xl"
                    >
                      <Wallet className="w-5 h-5 mr-2" />
                      {getWalletTexts("es").createNewWallet}
                    </Button>
                  </div>
                )}
              </div>
            </WalletErrorBoundary>

            {/* Bottom Menu Bar */}
            <BottomMenuBar
              onSendClick={() => setIsSendModalOpen(true)}
              onWalletClick={() => setIsProfileSheetOpen(true)}
              unreadCount={unreadCount}
            />
          </div>
        )}

        {/* Modals - Lazy loaded with Suspense */}
        <Suspense fallback={null}>
          <SendPaymentModal
            isOpen={isSendModalOpen}
            onClose={() => setIsSendModalOpen(false)}
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
            onClose={() => {
              setShowSuccessModal(false)
              setTransactionHash(null)
            }}
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
            onOpenNotifications={() => {
              setIsProfileSheetOpen(false)
              setIsNotificationsOpen(true)
            }}
            onWalletCreated={handleWalletCreated}
            onSwipeHandlers={swipeHandlers}
          />
        </Suspense>

        <Suspense fallback={null}>
          <TrustPointsModal
            isOpen={isTrustModalOpen}
            onClose={() => setIsTrustModalOpen(false)}
          />
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
