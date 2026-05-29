/**
 * Send payment modal component
 * Handles recipient input and payment submission
 */

"use client"

import { memo, useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Send, ScanQrCode } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useSendPayment } from "@/hooks/use-send-payment"
import { useWalletLanguage } from "@/lib/wallet-language"
import { QrScannerModal } from "@/components/wallet/qr-scanner-modal"

interface SendPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  walletAddress: string
  walletNetwork: "testnet" | "mainnet"
  defindexBalance: { walletBalance: number; strategyBalance: number; totalBalance: number } | null
  onSuccess: (transactionHash: string) => void
  onRefresh: () => void
}

export const SendPaymentModal = memo(function SendPaymentModal({
  isOpen,
  onClose,
  walletAddress,
  walletNetwork,
  defindexBalance,
  onSuccess,
  onRefresh,
}: SendPaymentModalProps) {
  const {
    sendRecipient,
    sendAmount,
    isSending,
    sendStep,
    isResolvingRecipient,
    isManualMode,
    sendMemo,
    recipientError,
    isVibrating,
    setSendRecipient,
    setSendAmount,
    setSendStep,
    setIsManualMode,
    setSendMemo,
    setRecipientError,
    handleResolveRecipient,
    handleSendPayment,
    resetSendPayment,
  } = useSendPayment(walletAddress, walletNetwork, defindexBalance, onSuccess, onRefresh)

  const { t } = useWalletLanguage()
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [pendingAutoResolve, setPendingAutoResolve] = useState(false)

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
      <DialogContent className="bg-black/80 backdrop-blur-md border-white/20 text-white max-w-md">
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
                      className={`bg-white/5 border-white/20 text-white placeholder:text-white/40 text-lg h-14 pr-14 ${recipientError ? 'border-red-500/50' : ''}`}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setIsScannerOpen(true)}
                      className="absolute right-3 w-8 h-8 flex items-center justify-center rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                      aria-label="Scan QR code"
                    >
                      <ScanQrCode className="w-5 h-5" />
                    </button>
                  </div>
                  {recipientError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-red-400 text-sm text-center"
                    >
                      {recipientError}
                    </motion.div>
                  )}
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
                <div className="text-4xl font-bold text-white">
                  {sendAmount || "0.00"}
                </div>
                <div className="text-white/60 text-sm mt-1">{t.currencyDisplay}</div>
              </div>

            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && sendAmount && parseFloat(sendAmount) > 0 && !isSending) {
                  e.preventDefault()
                  handleSendPayment()
                }
              }}
              placeholder="0.00"
              className="bg-white/5 border-white/20 text-white placeholder:text-white/40 text-2xl text-center h-16 font-semibold"
              autoFocus
            />

            <Button
              onClick={handleSendPayment}
              disabled={!sendAmount || isSending || parseFloat(sendAmount) <= 0}
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
