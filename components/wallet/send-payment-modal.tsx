/**
 * Send payment modal component
 * Handles recipient input and payment submission
 */

"use client"

import { memo, useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Send, ScanQrCode, Check, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useSendPayment } from "@/hooks/use-send-payment"
import { useWalletLanguage } from "@/lib/wallet-language"
import { QrScannerModal } from "@/components/wallet/qr-scanner-modal"
import { formatReferenceAmount } from "@/lib/ledger/format-fiat"
import {
  fiatDecimals,
  fiatFromUsdcAmount,
  usdcFromInputAmount,
} from "@/lib/payment/send-amount-currency"
import {
  formatSozuTagLabel,
  isValidSozuTag,
  normalizeSozuTag,
} from "@/lib/payment/sozu-tag-lookup"
import {
  LEGACY_CLASSIC_PAYMENT_NOTICE,
  paymentRailForAddress,
} from "@/lib/payment/payment-rail"
import { isValidStellarReceiveAddress } from "@/lib/payment/stellar-address"
import { formatBalance, getUserId } from "@/lib/wallet-utils"
import type { ReferenceFiat } from "@/lib/treasury/types"

import type { PaymentReceipt } from "@/lib/payment/payment-receipt"

interface SendPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  walletAddress: string
  walletNetwork: "testnet" | "mainnet"
  defindexBalance: {
    walletBalance: number
    sorobanSacBalance?: number
    spendableOnC?: number
    strategyBalance: number
    totalBalance: number
    displayBalance?: number
  } | null
  referenceFiat: ReferenceFiat
  onSuccess: (receipt: PaymentReceipt) => void
  onRefresh: () => void | Promise<void>
  /** When true, opens the QR scanner as soon as the modal mounts. */
  openScannerOnMount?: boolean
  onScannerOpenConsumed?: () => void
}

export const SendPaymentModal = memo(function SendPaymentModal({
  isOpen,
  onClose,
  walletAddress,
  walletNetwork,
  defindexBalance,
  referenceFiat,
  onSuccess,
  onRefresh,
  openScannerOnMount = false,
  onScannerOpenConsumed,
}: SendPaymentModalProps) {
  const { t } = useWalletLanguage()

  const {
    sendRecipient,
    sendAmount,
    amountInputCurrency,
    isSending,
    sendPhase,
    sendStep,
    isResolvingRecipient,
    isManualMode,
    sendMemo,
    recipientError,
    amountError,
    isVibrating,
    legacyPaymentNotice,
    setSendRecipient,
    setSendAmount,
    setIsManualMode,
    setSendMemo,
    setRecipientError,
    setAmountError,
    toggleAmountCurrency,
    handleResolveRecipient,
    handleSendPayment,
    resetSendPayment,
    goBackToRecipient,
    cacheRecipientResolution,
  } = useSendPayment(
    walletAddress,
    walletNetwork,
    defindexBalance,
    referenceFiat,
    onSuccess,
    onRefresh,
    t.sendInsufficientBalance,
  )

  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [pendingAutoResolve, setPendingAutoResolve] = useState(false)
  const [portalReady, setPortalReady] = useState(false)

  useEffect(() => {
    setPortalReady(true)
  }, [])

  const refreshOnOpenRef = useRef(false)
  useEffect(() => {
    if (!isOpen) {
      refreshOnOpenRef.current = false
      return
    }
    if (refreshOnOpenRef.current) return
    refreshOnOpenRef.current = true
    void Promise.resolve(onRefresh())
  }, [isOpen, onRefresh])

  useEffect(() => {
    if (!isOpen || !openScannerOnMount) return
    setIsScannerOpen(true)
    onScannerOpenConsumed?.()
  }, [isOpen, openScannerOnMount, onScannerOpenConsumed])

  // Warm up kit + credential storage as soon as modal opens so the passkey
  // prompt can appear quickly when the user taps Send.
  useEffect(() => {
    if (!isOpen || !walletAddress.startsWith("C")) return
    void (async () => {
      try {
        const { getSmartAccountKit } = await import("@/lib/stellar/smartAccounts/client")
        const { ensureKitConnectedForSend } = await import("@/lib/stellar/smartAccounts/ensureKitConnected")
        const { getCurrentCredentialId } = await import("@/lib/storage/key-utils")
        const credentialId = await getCurrentCredentialId(walletAddress)
        if (!credentialId) return
        const { kit } = await getSmartAccountKit()
        await ensureKitConnectedForSend(kit, credentialId, walletAddress.trim().toUpperCase())
      } catch {
        /* non-fatal warm-up */
      }
    })()
  }, [isOpen, walletAddress])

  // Real-time recipient validation
  type ValidationState = "idle" | "checking" | "valid" | "invalid"
  const [validationState, setValidationState] = useState<ValidationState>("idle")
  const [validationLabel, setValidationLabel] = useState<string>("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const recipientInputRef = useRef<HTMLInputElement>(null)
  const manualRecipientInputRef = useRef<HTMLInputElement>(null)
  const amountInputRef = useRef<HTMLInputElement>(null)
  const [keyboardInset, setKeyboardInset] = useState(0)

  const resetModalScroll = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, left: 0 })
  }, [])

  const focusActiveInput = useCallback(() => {
    const target =
      sendStep === "amount"
        ? amountInputRef.current
        : isManualMode
          ? manualRecipientInputRef.current
          : recipientInputRef.current
    target?.focus({ preventScroll: true })
    resetModalScroll()
  }, [sendStep, isManualMode, resetModalScroll])

  // Keep the sheet above the software keyboard without scrolling the modal body.
  useEffect(() => {
    if (!isOpen) {
      setKeyboardInset(0)
      return
    }

    const updateKeyboardInset = () => {
      const vv = window.visualViewport
      if (!vv) {
        setKeyboardInset(0)
        return
      }
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKeyboardInset(inset)
      resetModalScroll()
    }

    updateKeyboardInset()
    window.visualViewport?.addEventListener("resize", updateKeyboardInset)
    window.visualViewport?.addEventListener("scroll", updateKeyboardInset)
    return () => {
      window.visualViewport?.removeEventListener("resize", updateKeyboardInset)
      window.visualViewport?.removeEventListener("scroll", updateKeyboardInset)
    }
  }, [isOpen, resetModalScroll])

  // Focus after sheet animation — preventScroll stops iOS from jumping the modal.
  useEffect(() => {
    if (!isOpen) return
    const timer = window.setTimeout(() => focusActiveInput(), 320)
    return () => window.clearTimeout(timer)
  }, [isOpen, sendStep, isManualMode, focusActiveInput])

  const validateRecipient = useCallback(async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setValidationState("idle")
      return
    }

    const addr = trimmed.toUpperCase()
    if (isValidStellarReceiveAddress(addr)) {
      const rail = paymentRailForAddress(addr)
      setValidationState("valid")
      setValidationLabel(
        rail === "smart" ? "Smart account (C…)" : "Legacy (G…)",
      )
      return
    }

    // Partial Stellar address being typed — stay idle
    if ((trimmed.startsWith("G") || trimmed.startsWith("C")) && trimmed.length < 56) {
      setValidationState("idle")
      return
    }

    const normalizedTag = normalizeSozuTag(trimmed)
    if (!isValidSozuTag(normalizedTag)) {
      setValidationState("idle")
      return
    }

    setValidationState("checking")
    try {
      const userId = getUserId()
      if (!userId) {
        setValidationState("idle")
        return
      }

      const res = await fetch("/api/wallet/resolve-recipient", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify({ recipient: normalizedTag }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.walletAddress) {
          setValidationState("valid")
          const tagLabel = formatSozuTagLabel(data.tag ?? normalizedTag)
          setValidationLabel(
            data.paymentRail === "legacy" ? `${tagLabel} · legacy` : tagLabel,
          )
          cacheRecipientResolution(
            normalizedTag,
            data.walletAddress as string,
            data.paymentRail === "legacy" ? "legacy" : "smart",
            typeof data.legacyNotice === "string" ? data.legacyNotice : null,
          )
        } else {
          setValidationState("invalid")
          setValidationLabel("Tag no encontrado")
        }
      } else {
        setValidationState("invalid")
        setValidationLabel("Tag no encontrado")
      }
    } catch {
      setValidationState("idle")
    }
  }, [cacheRecipientResolution])

  // Debounce validation on input change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!sendRecipient.trim() || isManualMode) {
      setValidationState("idle")
      return
    }
    debounceRef.current = setTimeout(() => {
      void validateRecipient(sendRecipient)
    }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [sendRecipient, isManualMode, validateRecipient])

  // Reset validation when modal closes
  useEffect(() => {
    if (!isOpen) setValidationState("idle")
  }, [isOpen])

  const parsedAmount = parseFloat(sendAmount)
  const hasValidAmount = sendAmount.length > 0 && !Number.isNaN(parsedAmount) && parsedAmount > 0
  const amountPlaceholder =
    amountInputCurrency === "fiat" && fiatDecimals(referenceFiat) === 0 ? "0" : "0.00"
  const amountUsesIntegerPad =
    amountInputCurrency === "fiat" && fiatDecimals(referenceFiat) === 0
  const amountInputMode = amountUsesIntegerPad ? "numeric" : "decimal"

  const handleAmountChange = useCallback(
    (raw: string) => {
      setAmountError(null)
      if (amountUsesIntegerPad) {
        setSendAmount(raw.replace(/\D/g, ""))
        return
      }
      const normalized = raw.replace(",", ".")
      const sanitized = normalized.replace(/[^\d.]/g, "")
      const dotIndex = sanitized.indexOf(".")
      setSendAmount(
        dotIndex === -1
          ? sanitized
          : `${sanitized.slice(0, dotIndex + 1)}${sanitized.slice(dotIndex + 1).replace(/\./g, "")}`,
      )
    },
    [amountUsesIntegerPad, setSendAmount, setAmountError],
  )

  const balanceSizeClass =
    "min-w-0 max-w-full overflow-hidden text-[clamp(1.5rem,7vw,3rem)] font-bold leading-none tracking-tight tabular-nums text-white sm:text-5xl lg:text-[clamp(1.75rem,2.8vw,2.5rem)] xl:text-[clamp(1.875rem,2.5vw,2.75rem)]"

  const referenceDisplayValue = (usdcAmount: number) => {
    const local = fiatFromUsdcAmount(usdcAmount, referenceFiat)
    return referenceFiat === "CLP" || referenceFiat === "ARS" ? Math.round(local) : local
  }

  /** Spendable USDC on C (Blend + Circle SAC); excludes DeFindex strategy. */
  const availableBalance =
    defindexBalance?.spendableOnC ??
    (defindexBalance?.walletBalance ?? 0) + (defindexBalance?.sorobanSacBalance ?? 0)
  const availableFiatFormatted = formatReferenceAmount(
    referenceDisplayValue(availableBalance),
    referenceFiat,
  )
  const availableUsdcFormatted = `${formatBalance(availableBalance)} USDC`

  const displayUsdc = hasValidAmount
    ? amountInputCurrency === "usdc"
      ? parsedAmount
      : usdcFromInputAmount(parsedAmount, "fiat", referenceFiat)
    : 0

  const displayFiat = hasValidAmount
    ? amountInputCurrency === "fiat"
      ? referenceFiat === "CLP" || referenceFiat === "ARS"
        ? Math.round(parsedAmount)
        : parsedAmount
      : referenceDisplayValue(parsedAmount)
    : 0

  const amountFiatFormatted = hasValidAmount
    ? formatReferenceAmount(displayFiat, referenceFiat)
    : formatReferenceAmount(0, referenceFiat)

  const amountUsdcFormatted = hasValidAmount
    ? `${formatBalance(displayUsdc)} USDC`
    : `${formatBalance(0)} USDC`

  // Re-focus when currency toggles so iOS swaps numeric ↔ decimal pad.
  useEffect(() => {
    if (!isOpen || sendStep !== "amount") return
    amountInputRef.current?.focus({ preventScroll: true })
  }, [amountInputCurrency, isOpen, sendStep])
  useEffect(() => {
    if (pendingAutoResolve && sendRecipient) {
      setPendingAutoResolve(false)
      handleResolveRecipient()
    }
  }, [pendingAutoResolve, sendRecipient, handleResolveRecipient])

  const handleQrScan = (value: string) => {
    const raw = value.trim()
    let recipient = raw
    let isStellar = false

    // Handle checkout session ID directly (e.g. cs_...)
    if (raw.startsWith("cs_")) {
      window.location.href = `/checkout/${raw}`
      return
    }

    // Handle checkout URLs, relative paths, or slugs containing checkout/cs_...
    // Format examples:
    // - https://credit.sozu.capital/checkout/cs_...
    // - checkout/cs_...
    // - /checkout/cs_...
    const checkoutMatch = raw.match(/(?:^|\/)checkout\/([^/?]+)/)
    if (checkoutMatch && checkoutMatch[1]) {
      window.location.href = `/checkout/${checkoutMatch[1]}`
      return
    }

    // Handle pay/qr/[slug] short-links by navigating the window to resolve the redirection
    // Format examples:
    // - https://pay.sozu.capital/pay/qr/slug
    // - /pay/qr/slug
    const qrMatch = raw.match(/(?:^|\/)pay\/qr\/([^/?]+)/)
    if (qrMatch && qrMatch[1]) {
      window.location.href = raw
      return
    }

    // Handle sozu:checkout?session=cs_... deep-link
    if (raw.startsWith("sozu:checkout?")) {
      try {
        const params = new URLSearchParams(raw.slice("sozu:checkout?".length))
        const sessionId = params.get("session")
        if (sessionId) {
          window.location.href = `/checkout/${sessionId}`
          return
        }
      } catch {
        // Fall through to raw value
      }
    }

    // Parse sozu:pay?tag=alice3&addr=GBPRNU... deep-link (emitted by our deposit QR)
    if (raw.startsWith("sozu:pay?")) {
      try {
        const params = new URLSearchParams(raw.slice("sozu:pay?".length))
        const tag = params.get("tag")
        const addr = params.get("addr")
        if (tag) {
          recipient = `$${tag}`
        } else if (addr) {
          recipient = addr
          isStellar = /^G[A-Z0-9]{55}$/.test(addr)
        }
      } catch {
        // Fall through to raw value
      }
    } else if (/^G[A-Z0-9]{55}$/.test(raw)) {
      // Raw Stellar address
      isStellar = true
    }
    // $tag or plain tag — strip leading $ for display (input will show it)
    // leave as-is; resolve-recipient strips $ itself

    setSendRecipient(recipient)
    setRecipientError(null)
    if (isStellar) setIsManualMode(true)
    setPendingAutoResolve(true) // useEffect will call handleResolveRecipient after state settles
  }

  const handleClose = () => {
    resetSendPayment()
    onClose()
  }

  // Keyboard UX: Escape goes back (amount → recipient) or closes (recipient → close).
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.preventDefault()
      e.stopPropagation()
      if (sendStep === "amount") {
        goBackToRecipient()
        requestAnimationFrame(() => {
          requestAnimationFrame(() => recipientInputRef.current?.focus({ preventScroll: true }))
        })
      } else {
        handleClose()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isOpen, sendStep, goBackToRecipient])

  if (!portalReady) return null

  return createPortal(
    <>
    <AnimatePresence>
    {isOpen && (
      <>
        {/* Light backdrop — balance card above stays clearly visible */}
        <motion.div
          key="send-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]"
          onClick={handleClose}
        />

        {/* Bottom sheet — portaled to body so fixed positioning uses the viewport, not the swipe carousel */}
        <motion.div
          key="send-sheet"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          drag="y"
          dragConstraints={{ top: 0 }}
          dragElastic={{ top: 0.04, bottom: 0.28 }}
          dragMomentum={false}
          onDragEnd={(_, info) => {
            if (info.offset.y > 80 || info.velocity.y > 450) handleClose()
          }}
          transition={{ type: "spring", damping: 32, stiffness: 300 }}
          className="fixed z-50 box-border flex w-auto max-w-md flex-col overflow-hidden rounded-[28px] text-white left-[max(1rem,env(safe-area-inset-left))] right-[max(1rem,env(safe-area-inset-right))] mx-auto"
          style={{
            bottom: keyboardInset > 0 ? `${keyboardInset + 8}px` : "max(1rem, env(safe-area-inset-bottom))",
            top: keyboardInset > 0 ? "auto" : "clamp(100px, 18dvh, 160px)",
            maxHeight: keyboardInset > 0 ? `calc(var(--sozu-visual-viewport-height, var(--sozu-app-height, 100lvh)) - ${keyboardInset + 16}px)` : undefined,
            maxWidth: "min(28rem, calc(100vw - max(2rem, env(safe-area-inset-left) + env(safe-area-inset-right))))",
            background: "rgba(8,8,10,0.88)",
            backdropFilter: "blur(32px) saturate(160%)",
            WebkitBackdropFilter: "blur(32px) saturate(160%)",
          }}
        >
          {/* Drag handle */}
          <div className="mx-auto mt-3 mb-0 h-[3px] w-8 shrink-0 rounded-full bg-white/[0.10]" />

          {/* Balance reference — matches balance card: fiat primary, USDC subline */}
          <div className="flex flex-col items-start px-5 pt-4 pb-2 shrink-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/30 mb-1">
              Disponible
            </p>
            <div className="min-w-0 text-left">
              <div className="flex max-w-full items-baseline gap-1.5 justify-start">
                <div className={balanceSizeClass}>{availableFiatFormatted}</div>
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-white/40">
                  {referenceFiat}
                </span>
              </div>
              <p className="mt-1.5 text-xs tabular-nums text-white/35 sm:text-sm">
                {availableUsdcFormatted}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-5 mb-1 h-px bg-white/[0.07] shrink-0" />

          {/* Scrollable form content */}
          <div
            ref={scrollContainerRef}
            className={`min-w-0 flex-1 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] ${
              keyboardInset > 0 ? "overflow-hidden" : "overflow-x-hidden overflow-y-auto"
            }`}
          >
        {sendStep === "recipient" ? (
          <div className="space-y-4 pt-3 pb-2">
            {!isManualMode ? (
              <>
                <motion.div
                  animate={isVibrating ? {
                    x: [0, -10, 10, -10, 10, 0],
                  } : {}}
                  transition={{ duration: 0.5 }}
                  className="space-y-2"
                >
                  <div className="relative flex items-center">
                    <Input
                      ref={recipientInputRef}
                      type="text"
                      value={sendRecipient}
                      onChange={(e) => {
                        setSendRecipient(e.target.value)
                        setRecipientError(null)
                      }}
                      onFocus={resetModalScroll}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && sendRecipient.trim()) {
                          handleResolveRecipient()
                        }
                      }}
                      placeholder="$sozu"
                      className={`bg-white/5 text-white placeholder:text-white/40 text-lg h-14 pr-[4.5rem] transition-colors ${
                        recipientError
                          ? "border-red-500/60"
                          : validationState === "valid"
                          ? "border-emerald-500/60"
                          : validationState === "invalid"
                          ? "border-red-500/40"
                          : "border-white/20"
                      }`}
                      enterKeyHint="next"
                    />

                    {/* Validation indicator */}
                    <div className="absolute right-12 flex items-center">
                      <AnimatePresence mode="wait">
                        {validationState === "checking" && (
                          <motion.span key="checking"
                            initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}
                          >
                            <Loader2 className="w-4 h-4 text-white/35 animate-spin" />
                          </motion.span>
                        )}
                        {validationState === "valid" && (
                          <motion.span key="valid"
                            initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}
                          >
                            <Check className="w-4 h-4 text-emerald-400" />
                          </motion.span>
                        )}
                        {validationState === "invalid" && (
                          <motion.span key="invalid"
                            initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}
                          >
                            <X className="w-4 h-4 text-red-400" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsScannerOpen(true)}
                      className="absolute right-3 w-8 h-8 flex items-center justify-center rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                      aria-label="Scan QR code"
                    >
                      <ScanQrCode className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Validation / error label below input */}
                  <AnimatePresence>
                    {(recipientError || validationState === "invalid" || validationState === "valid") && (
                      <motion.p
                        key={recipientError || validationState}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        className={`text-[12px] px-1 ${
                          recipientError || validationState === "invalid"
                            ? "text-red-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {recipientError || (validationState === "invalid" ? "Tag no encontrado" : validationLabel)}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>

                <Button
                  onClick={handleResolveRecipient}
                  disabled={
                    !sendRecipient.trim() ||
                    isResolvingRecipient ||
                    validationState === "checking" ||
                    validationState === "invalid"
                  }
                  className="w-full bg-white text-black hover:bg-white/90 font-semibold disabled:opacity-50 disabled:cursor-not-allowed h-14 text-lg"
                >
                  {isResolvingRecipient ? (
                    <>
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                      {t.resolving}
                    </>
                  ) : (
                    t.continue
                  )}
                </Button>

                <button
                  onClick={() => {
                    setIsManualMode(true)
                    setRecipientError(null)
                  }}
                  className="w-full text-white/60 text-sm hover:text-white/80 transition-colors"
                  type="button"
                >
                  {t.manualTransaction}
                </button>
              </>
            ) : (
              <>
                <motion.div
                  animate={isVibrating ? { x: [0, -10, 10, -10, 10, 0] } : {}}
                  transition={{ duration: 0.5 }}
                  className="space-y-2"
                >
                  <Input
                    ref={manualRecipientInputRef}
                    type="text"
                    value={sendRecipient}
                    onChange={(e) => {
                      setSendRecipient(e.target.value)
                      setRecipientError(null)
                    }}
                    onFocus={resetModalScroll}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && sendRecipient.trim()) {
                        handleResolveRecipient()
                      }
                    }}
                    placeholder="Stellar Wallet Address"
                    className={`bg-white/5 text-white placeholder:text-white/40 text-lg h-14 transition-colors ${
                      recipientError ? "border-red-500/60" : "border-white/20"
                    }`}
                    enterKeyHint="next"
                  />
                  <AnimatePresence>
                    {recipientError && (
                      <motion.p
                        key={recipientError}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        className="text-[12px] px-1 text-red-400"
                      >
                        {recipientError}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>

                <Input
                  type="text"
                  value={sendMemo}
                  onChange={(e) => setSendMemo(e.target.value)}
                  placeholder="Memo (optional)"
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/40 text-lg h-14"
                />

                <button
                  onClick={() => {
                    setIsManualMode(false)
                    setSendRecipient("")
                    setSendMemo("")
                  }}
                    className="w-full text-white text-sm hover:text-white/80 transition-colors"
                    type="button"
                  >
                    {t.useSozuTag}
                  </button>

                <Button
                  onClick={handleResolveRecipient}
                  disabled={!sendRecipient.trim() || isResolvingRecipient}
                  className="w-full bg-white text-black hover:bg-white/90 font-semibold disabled:opacity-50 disabled:cursor-not-allowed h-14 text-lg"
                >
                  {isResolvingRecipient ? (
                    <>
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                      {t.resolving}
                    </>
                  ) : (
                    t.continue
                  )}
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4 pt-3 pb-2">
              {/* Recipient confirmation row (click to edit recipient). */}
              <button
                type="button"
                onClick={() => {
                  if (isSending) return
                  goBackToRecipient()
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => recipientInputRef.current?.focus({ preventScroll: true }))
                  })
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 transition-colors hover:bg-white/[0.06]"
                aria-label="Edit recipient"
              >
                <span className="text-white/40 text-xs uppercase tracking-widest">To</span>
                <span className="text-white/90 text-sm font-mono truncate max-w-[220px]">
                  {sendRecipient.startsWith("$")
                    ? sendRecipient
                    : sendRecipient.length >= 12
                      ? `${sendRecipient.slice(0, 6)}…${sendRecipient.slice(-4)}`
                      : sendRecipient}
                </span>
              </button>
              {legacyPaymentNotice ? (
                <p className="text-amber-200/90 text-xs text-center px-2 leading-snug">
                  {legacyPaymentNotice}
                </p>
              ) : null}
              <button
                type="button"
                onClick={toggleAmountCurrency}
                className="w-full py-2 text-center transition-colors hover:bg-white/[0.03] rounded-xl"
                aria-label={t.sendTapToSwitchCurrency}
              >
                <div className="flex max-w-full items-baseline gap-1.5 justify-center">
                  <div className={balanceSizeClass}>{amountFiatFormatted}</div>
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-white/40">
                    {referenceFiat}
                  </span>
                </div>
                <p className="mt-1.5 text-xs tabular-nums text-white/35 sm:text-sm">
                  {amountUsdcFormatted}
                </p>
                <p className="text-white/35 text-xs mt-2">{t.sendTapToSwitchCurrency}</p>
              </button>

            <motion.div
              animate={isVibrating ? { x: [0, -10, 10, -10, 10, 0] } : {}}
              transition={{ duration: 0.5 }}
              className="space-y-2"
            >
              <Input
                ref={amountInputRef}
                type="text"
                inputMode={amountInputMode}
                pattern={amountUsesIntegerPad ? "[0-9]*" : "[0-9.,]*"}
                autoComplete="off"
                value={sendAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                onFocus={resetModalScroll}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && hasValidAmount && !isSending) {
                    e.preventDefault()
                    handleSendPayment()
                  }
                }}
                placeholder={amountPlaceholder}
                className={`bg-white/5 text-white placeholder:text-white/40 text-2xl text-center h-16 font-semibold tabular-nums transition-colors ${
                  amountError ? "border-red-500/60" : "border-white/20"
                }`}
                enterKeyHint="done"
              />

              <AnimatePresence>
                {amountError && (
                  <motion.p
                    key={amountError}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="text-[12px] px-1 text-center text-red-400"
                  >
                    {amountError}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            <Button
              onClick={handleSendPayment}
              disabled={!hasValidAmount || isSending}
              className="w-full bg-white text-black hover:bg-white/90 font-semibold disabled:opacity-50 disabled:cursor-not-allowed h-14 text-lg"
            >
              {isSending ? (
                <>
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                  {sendPhase === "signing"
                    ? t.confirmWithPasskey
                    : sendPhase === "submitting"
                      ? t.submitting
                      : t.sending}
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  {t.send}
                </>
              )}
            </Button>
          </div>
        )}
          </div>{/* end scrollable form */}
        </motion.div>{/* end sheet */}
      </>
    )}
    </AnimatePresence>

    <QrScannerModal
      isOpen={isScannerOpen}
      onClose={() => setIsScannerOpen(false)}
      onScan={handleQrScan}
    />
  </>,
  document.body,
  )
})
