"use client"

import { memo, useCallback, useRef, useState } from "react"
import { Check, Copy, ImageIcon, MessageCircle, Send, Share2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { PaymentReceipt } from "@/lib/payment/payment-receipt"
import {
  buildReceiptShareText,
  buildSmsShareUrl,
  buildTelegramShareUrl,
  buildWhatsAppShareUrl,
  canUseNativeShare,
  shareReceiptNative,
} from "@/lib/payment/payment-receipt"
import {
  canShareReceiptImage,
  createReceiptImageBlob,
  shareReceiptImage,
} from "@/lib/payment/receipt-image"
import { useWalletLanguage } from "@/lib/wallet-language"
import { copyToClipboard } from "@/lib/wallet-utils"
import { cn } from "@/lib/utils"

type TransactionReceiptShareProps = {
  receipt: PaymentReceipt
  className?: string
}

export const TransactionReceiptShare = memo(function TransactionReceiptShare({
  receipt,
  className,
}: TransactionReceiptShareProps) {
  const { t, language } = useWalletLanguage()
  const [copied, setCopied] = useState(false)
  const [sharingImage, setSharingImage] = useState(false)
  const shareText = buildReceiptShareText(receipt, t, language)
  const showNativeShare = canUseNativeShare()
  const showImageShare = canShareReceiptImage()
  const imageBusyRef = useRef(false)

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(shareText)
    if (!ok) {
      toast.error(t.receiptCopyFailed)
      return
    }
    setCopied(true)
    toast.success(t.receiptCopied)
    setTimeout(() => setCopied(false), 2000)
  }, [shareText, t.receiptCopyFailed, t.receiptCopied])

  const openShareUrl = useCallback((url: string) => {
    window.open(url, "_blank", "noopener,noreferrer")
  }, [])

  const getReceiptImage = useCallback(async () => {
    return createReceiptImageBlob(receipt, t, language)
  }, [receipt, t, language])

  const shareAsImage = useCallback(
    async (afterShare?: (text: string) => void) => {
      if (imageBusyRef.current) return
      imageBusyRef.current = true
      setSharingImage(true)
      try {
        const blob = await getReceiptImage()
        try {
          const result = await shareReceiptImage(blob, shareText)
          if (result === "downloaded") {
            toast.success(t.receiptImageSaved)
            afterShare?.(shareText)
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return
          throw error
        }
      } catch {
        toast.error(t.receiptShareImageFailed)
      } finally {
        imageBusyRef.current = false
        setSharingImage(false)
      }
    },
    [getReceiptImage, shareText, t.receiptImageSaved, t.receiptShareImageFailed],
  )

  const handleWhatsApp = useCallback(async () => {
    if (showImageShare) {
      await shareAsImage((text) => openShareUrl(buildWhatsAppShareUrl(text)))
      return
    }
    await shareAsImage()
    openShareUrl(buildWhatsAppShareUrl(shareText))
  }, [showImageShare, shareAsImage, openShareUrl, shareText])

  const handleTelegram = useCallback(async () => {
    if (showImageShare) {
      await shareAsImage((text) => openShareUrl(buildTelegramShareUrl(text)))
      return
    }
    await shareAsImage()
    openShareUrl(buildTelegramShareUrl(shareText))
  }, [showImageShare, shareAsImage, openShareUrl, shareText])

  const handleSms = useCallback(async () => {
    if (showImageShare) {
      await shareAsImage((text) => openShareUrl(buildSmsShareUrl(text)))
      return
    }
    await shareAsImage()
    openShareUrl(buildSmsShareUrl(shareText))
  }, [showImageShare, shareAsImage, openShareUrl, shareText])

  const handleNativeShare = useCallback(async () => {
    const blob = await getReceiptImage()
    try {
      const result = await shareReceiptImage(blob, shareText)
      if (result === "downloaded") {
        toast.success(t.receiptImageSaved)
      }
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
    }

    const shared = await shareReceiptNative(receipt, shareText)
    if (!shared) {
      await handleCopy()
    }
  }, [getReceiptImage, shareText, receipt, handleCopy, t.receiptImageSaved])

  const handleShareImage = useCallback(async () => {
    await shareAsImage()
  }, [shareAsImage])

  const shareButtonClass =
    "h-auto flex-col gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-2 py-3 text-[10px] font-medium uppercase tracking-wider text-white/80 hover:bg-white/[0.08] disabled:opacity-50"

  const gridCols = showNativeShare ? "grid-cols-4" : "grid-cols-3"

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-xs font-medium uppercase tracking-widest text-white/45">
        {t.receiptShareHeading}
      </p>
      <div className={cn("grid gap-2", gridCols)}>
        <Button
          type="button"
          variant="ghost"
          className={shareButtonClass}
          disabled={sharingImage}
          onClick={handleWhatsApp}
        >
          <MessageCircle className="h-4 w-4 text-emerald-400" />
          WhatsApp
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={shareButtonClass}
          disabled={sharingImage}
          onClick={handleTelegram}
        >
          <Send className="h-4 w-4 text-sky-400" />
          Telegram
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={shareButtonClass}
          disabled={sharingImage}
          onClick={handleSms}
        >
          <MessageCircle className="h-4 w-4 text-violet-300" />
          {t.receiptSmsLabel}
        </Button>
        {showNativeShare ? (
          <Button
            type="button"
            variant="ghost"
            className={shareButtonClass}
            disabled={sharingImage}
            onClick={handleNativeShare}
          >
            <Share2 className="h-4 w-4 text-white/70" />
            {t.receiptMoreLabel}
          </Button>
        ) : null}
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full border-white/15 bg-white/[0.03] text-white hover:bg-white/[0.08]"
        disabled={sharingImage}
        onClick={handleShareImage}
      >
        <ImageIcon className="mr-2 h-4 w-4" />
        {sharingImage ? t.receiptSharingImage : t.receiptShareImage}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full border-white/15 bg-white/[0.03] text-white hover:bg-white/[0.08]"
        onClick={handleCopy}
      >
        {copied ? (
          <>
            <Check className="mr-2 h-4 w-4 text-emerald-400" />
            {t.receiptCopied}
          </>
        ) : (
          <>
            <Copy className="mr-2 h-4 w-4" />
            {t.receiptCopyInvoice}
          </>
        )}
      </Button>
    </div>
  )
})
