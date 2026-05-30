/**
 * Send payment modal component
 * Handles recipient input and payment submission
 */

"use client"

import { memo, useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Send, ScanQrCode, Check, X, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
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
import type { ReferenceFiat } from "@/lib/treasury/types"

import type { PaymentReceipt } from "@/lib/payment/payment-receipt"

interface SendPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  walletAddress: string
  walletNetwork: "testnet" | "mainnet"
  defindexBalance: { walletBalance: number; strategyBalance: number; totalBalance: number } | null
  referenceFiat: ReferenceFiat
  onSuccess: (receipt: PaymentReceipt) => void
  onRefresh: () => void
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
}: SendPaymentModalProps) {
  const {
    sendRecipient,
    sendAmount,
    amountInputCurrency,
    isSending,
    sendStep,
    isResolvingRecipient,
    isManualMode,
    sendMemo,
    recipientError,
    isVibrating,
    setSendRecipient,
    setSendAmount,
    setIsManualMode,
    setSendMemo,
    setRecipientError,
    toggleAmountCurrency,
    handleResolveRecipient,
    handleSendPayment,
    resetSendPayment,
  } = useSendPayment(
    walletAddress,
    walletNetwork,
    defindexBalance,
    referenceFiat,
    onSuccess,
    onRefresh,
  )

  const { t } = useWalletLanguage()
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [pendingAutoResolve, setPendingAutoResolve] = useState(false)

  // Real-time recipient validation
  type ValidationState = "idle" | "checking" | "valid" | "invalid"
  const [validationState, setValidationState] = useState<ValidationState>("idle")
  const [validationLabel, setValidationLabel] = useState<string>("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const validateRecipient = useCallback(async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed || trimmed.length < 2) {
      setValidationState("idle")
      return
    }

    // Stellar address — validate format locally, no API needed
    if (/^G[A-Z0-9]{55}$/.test(trimmed)) {
      setValidationState("valid")
      setValidationLabel("Dirección válida")
      return
    }

    // Partial Stellar address being typed — stay idle
    if (trimmed.startsWith("G") && trimmed.length < 56) {
      setValidationState("idle")
      return
    }

    // SozuTag — call the API
    const tag = trimmed.startsWith("$") ? trimmed : `$${trimmed}`
    setValidationState("checking")
    try {
      const userId = typeof window !== "undefined"
        ? (localStorage.getItem("dev_username") ?? sessionStorage.getItem("dev_username"))
        : null
      if (!userId) { setValidationState("idle"); return }
      const res = await fetch("/api/wallet/resolve-recipient", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId },
        body: JSON.stringify({ recipient: tag }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.walletAddress) {
          setValidationState("valid")
          setValidationLabel(tag)
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
  }, [])

  // Debounce validation on input change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!sendRecipient.trim() || isManualMode) {
      setValidationState("idle")
      return
    }
    debounceRef.current = setTimeout(() => {
      void validateRecipient(sendRecipient)
    }, 550)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [sendRecipient, isManualMode, validateRecipient])

  // Reset validation when modal closes
  useEffect(() => {
    if (!isOpen) setValidationState("idle")
  }, [isOpen])

  const parsedAmount = parseFloat(sendAmount)
  const hasValidAmount = sendAmount.length > 0 && !Number.isNaN(parsedAmount) && parsedAmount > 0
  const inputCurrencyLabel = amountInputCurrency === "fiat" ? referenceFiat : "USDC"
  const amountPlaceholder =
    amountInputCurrency === "fiat" && fiatDecimals(referenceFiat) === 0 ? "0" : "0.00"
  const amountStep =
    amountInputCurrency === "fiat" && fiatDecimals(referenceFiat) === 0 ? "1" : "0.01"
  const amountMin =
    amountInputCurrency === "fiat" && fiatDecimals(referenceFiat) === 0 ? "1" : "0.01"

  const approxLine = hasValidAmount
    ? amountInputCurrency === "fiat"
      ? t.sendApproxUsdc.replace(
          "{amount}",
          usdcFromInputAmount(parsedAmount, "fiat", referenceFiat).toFixed(2),
        )
      : t.sendApproxFiat
          .replace("{amount}", formatReferenceAmount(fiatFromUsdcAmount(parsedAmount, referenceFiat), referenceFiat))
          .replace("{fiat}", referenceFiat)
    : null

  // Auto-resolve after a QR scan — fires once sendRecipient state has settled
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

  const handleClose = (open: boolean) => {
    if (!open) {
      resetSendPayment()
      onClose()
    }
  }

  return (
    <>
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="border-white/[0.12] text-white max-w-md"
        overlayClassName="bg-black/30 backdrop-blur-sm"
        style={{
          background: "rgba(8,8,10,0.72)",
          backdropFilter: "blur(28px) saturate(160%)",
          WebkitBackdropFilter: "blur(28px) saturate(160%)",
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t.sendPayment}</DialogTitle>
          <DialogDescription>{t.sendPaymentDesc}</DialogDescription>
        </DialogHeader>
        {sendStep === "recipient" ? (
          <div className="space-y-4 py-4">
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
                      type="text"
                      value={sendRecipient}
                      onChange={(e) => {
                        setSendRecipient(e.target.value)
                        setRecipientError(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && sendRecipient.trim()) {
                          handleResolveRecipient()
                        }
                      }}
                      placeholder="$Sozutag"
                      className={`bg-white/5 text-white placeholder:text-white/40 text-lg h-14 pr-[4.5rem] transition-colors ${
                        recipientError
                          ? "border-red-500/60"
                          : validationState === "valid"
                          ? "border-emerald-500/60"
                          : validationState === "invalid"
                          ? "border-red-500/40"
                          : "border-white/20"
                      }`}
                      autoFocus
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
                <Input
                  type="text"
                  value={sendRecipient}
                  onChange={(e) => setSendRecipient(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && sendRecipient.trim()) {
                      handleResolveRecipient()
                    }
                  }}
                  placeholder="Stellar Wallet Address"
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/40 text-lg h-14"
                  autoFocus
                />

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
          <div className="space-y-4 py-4">
              {/* Recipient confirmation row */}
              <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2">
                <span className="text-white/40 text-xs uppercase tracking-widest">To</span>
                <span className="text-white/90 text-sm font-mono truncate max-w-[220px]">
                  {sendRecipient.startsWith("$") ? sendRecipient : sendRecipient.startsWith("G") ? `${sendRecipient.slice(0,6)}…${sendRecipient.slice(-4)}` : sendRecipient}
                </span>
              </div>
              <div className="text-center py-2">
                <div className="text-4xl font-bold text-white tabular-nums">
                  {sendAmount || amountPlaceholder}
                </div>
                <button
                  type="button"
                  onClick={toggleAmountCurrency}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label={t.sendTapToSwitchCurrency}
                >
                  <span>{inputCurrencyLabel}</span>
                  <span className="text-white/40 text-xs">↕</span>
                </button>
                {approxLine ? (
                  <p className="text-white/45 text-xs mt-2">{approxLine}</p>
                ) : (
                  <p className="text-white/35 text-xs mt-2">{t.sendTapToSwitchCurrency}</p>
                )}
              </div>

            <Input
              type="number"
              inputMode="decimal"
              step={amountStep}
              min={amountMin}
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && hasValidAmount && !isSending) {
                  e.preventDefault()
                  handleSendPayment()
                }
              }}
              placeholder={amountPlaceholder}
              className="bg-white/5 border-white/20 text-white placeholder:text-white/40 text-2xl text-center h-16 font-semibold"
              autoFocus
            />

            <Button
              onClick={handleSendPayment}
              disabled={!hasValidAmount || isSending}
              className="w-full bg-white text-black hover:bg-white/90 font-semibold disabled:opacity-50 disabled:cursor-not-allowed h-14 text-lg"
            >
              {isSending ? (
                <>
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                  {t.sending}
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
      </DialogContent>
    </Dialog>

    <QrScannerModal
      isOpen={isScannerOpen}
      onClose={() => setIsScannerOpen(false)}
      onScan={handleQrScan}
    />
  </>
  )
})
