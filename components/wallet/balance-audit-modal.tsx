/**
 * Balance audit / treasury performance modal (standalone desktop).
 */

"use client"

import { memo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { BalanceAuditPanel, type BalanceAuditPanelProps } from "@/components/wallet/balance-audit-panel"
import { useWalletLanguage } from "@/lib/wallet-language"

type BalanceAuditModalProps = BalanceAuditPanelProps & {
  isOpen: boolean
  onClose: () => void
}

export const BalanceAuditModal = memo(function BalanceAuditModal({
  isOpen,
  onClose,
  ...panelProps
}: BalanceAuditModalProps) {
  const { t } = useWalletLanguage()

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-black/80 backdrop-blur-md border-white/20 text-white max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">{t.treasuryPanelTitle}</DialogTitle>
          <DialogDescription className="text-white/60">{t.treasuryPanelSubtitle}</DialogDescription>
        </DialogHeader>
        <BalanceAuditPanel {...panelProps} showHeader={false} />
      </DialogContent>
    </Dialog>
  )
})
