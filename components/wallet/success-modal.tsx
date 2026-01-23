/**
 * Success modal component
 * Displays transaction success confirmation
 */

"use client"

import { memo } from "react"
import { Check } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { getWalletTexts } from "@/lib/wallet-texts"

interface SuccessModalProps {
  isOpen: boolean
  onClose: () => void
  transactionHash: string | null
}

export const SuccessModal = memo(function SuccessModal({
  isOpen,
  onClose,
  transactionHash,
}: SuccessModalProps) {
  const t = getWalletTexts("es")
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-black/80 backdrop-blur-md border-white/20 text-white max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>{t.transactionSuccessful}</DialogTitle>
          <DialogDescription>{t.transactionSuccessfulDesc}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 text-center">
          <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-white">{t.transactionSuccessful}</div>
          {transactionHash && (
            <div className="text-sm text-white/60 font-mono">
              {transactionHash.substring(0, 8)}...{transactionHash.substring(transactionHash.length - 8)}
            </div>
          )}
          <Button
            onClick={onClose}
            className="w-full bg-white text-black hover:bg-white/90 font-semibold h-14 text-lg"
          >
            {t.done}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
})
