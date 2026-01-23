/**
 * Send payment modal component
 * Handles recipient input and payment submission
 */

"use client"

import { memo } from "react"
import { motion } from "framer-motion"
import { Send } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useSendPayment } from "@/hooks/use-send-payment"
import { getWalletTexts } from "@/lib/wallet-texts"

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

  const t = getWalletTexts("es")

  const handleClose = (open: boolean) => {
    if (!open) {
      resetSendPayment()
      onClose()
    }
  }

  return (
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
                    className={`bg-white/5 border-white/20 text-white placeholder:text-white/40 text-lg h-14 ${recipientError ? 'border-red-500/50' : ''}`}
                    autoFocus
                  />
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
  )
})
