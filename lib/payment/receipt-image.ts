import type { PaymentReceipt } from "@/lib/payment/payment-receipt"
import {
  formatReceiptAmount,
  formatReceiptDate,
} from "@/lib/payment/payment-receipt"
import type { WalletTexts } from "@/lib/wallet-texts"

const RECEIPT_FILENAME = "sozu-receipt.png"
const WIDTH = 360
const PADDING = 24
const LINE = 22

type ReceiptImageLabels = Pick<
  WalletTexts,
  | "receiptShareTitle"
  | "receiptAmountLabel"
  | "receiptFromLabel"
  | "receiptToLabel"
  | "receiptDateLabel"
  | "receiptNetworkLabel"
  | "receiptNetworkTestnet"
  | "receiptNetworkMainnet"
  | "receiptMemoLabel"
  | "receiptShareFooter"
>

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : [text]
}

function drawRow(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  y: number,
  maxValueWidth: number,
): number {
  ctx.font = "12px system-ui, -apple-system, sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.45)"
  ctx.fillText(label, PADDING, y)

  ctx.font = "600 13px system-ui, -apple-system, sans-serif"
  ctx.fillStyle = "#ffffff"
  const valueLines = wrapText(ctx, value, maxValueWidth)
  valueLines.forEach((line, index) => {
    ctx.fillText(line, WIDTH - PADDING, y + index * 16)
  })
  return y + Math.max(LINE, valueLines.length * 16)
}

export async function renderReceiptToPng(
  receipt: PaymentReceipt,
  labels: ReceiptImageLabels,
  locale: string,
): Promise<Blob> {
  const networkLabel =
    receipt.network === "testnet"
      ? labels.receiptNetworkTestnet
      : labels.receiptNetworkMainnet
  const memo = receipt.memo?.trim()
  const rows = 5 + (memo ? 1 : 0)
  const height = PADDING * 2 + 56 + rows * LINE + 40

  const canvas = document.createElement("canvas")
  canvas.width = WIDTH * 2
  canvas.height = height * 2
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas not supported")

  ctx.scale(2, 2)

  ctx.fillStyle = "#0a0a0a"
  ctx.fillRect(0, 0, WIDTH, height)

  ctx.strokeStyle = "rgba(255,255,255,0.12)"
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, WIDTH - 1, height - 1)

  ctx.font = "600 11px system-ui, -apple-system, sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.4)"
  ctx.fillText(labels.receiptShareTitle.toUpperCase(), PADDING, PADDING + 12)

  ctx.font = "700 28px system-ui, -apple-system, sans-serif"
  ctx.fillStyle = "#ffffff"
  ctx.fillText(
    formatReceiptAmount(receipt.amount, receipt.currency),
    PADDING,
    PADDING + 48,
  )

  let y = PADDING + 78
  const maxValueWidth = WIDTH - PADDING * 2 - 80

  y = drawRow(
    ctx,
    labels.receiptFromLabel,
    receipt.fromLabel,
    y,
    maxValueWidth,
  ) + 8
  y = drawRow(ctx, labels.receiptToLabel, receipt.toLabel, y, maxValueWidth) + 8
  y =
    drawRow(
      ctx,
      labels.receiptDateLabel,
      formatReceiptDate(receipt.completedAt, locale),
      y,
      maxValueWidth,
    ) + 8
  y = drawRow(ctx, labels.receiptNetworkLabel, networkLabel, y, maxValueWidth) + 8

  if (memo) {
    y = drawRow(ctx, labels.receiptMemoLabel, memo, y, maxValueWidth) + 8
  }

  ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace"
  ctx.fillStyle = "rgba(52,211,153,0.85)"
  const hash =
    receipt.transactionHash.length > 18
      ? `${receipt.transactionHash.slice(0, 10)}…${receipt.transactionHash.slice(-8)}`
      : receipt.transactionHash
  ctx.fillText(hash, PADDING, y + 4)

  ctx.font = "500 10px system-ui, -apple-system, sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.35)"
  ctx.fillText(labels.receiptShareFooter, PADDING, height - PADDING)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error("Failed to render receipt image"))
      },
      "image/png",
      1,
    )
  })
}

export function downloadReceiptImage(blob: Blob, filename = RECEIPT_FILENAME): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function canShareReceiptImage(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return false
  }
  if (typeof navigator.canShare !== "function") return true
  try {
    const file = new File([new Blob()], RECEIPT_FILENAME, { type: "image/png" })
    return navigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

export async function shareReceiptImage(
  blob: Blob,
  shareText: string,
): Promise<"shared" | "downloaded"> {
  const file = new File([blob], RECEIPT_FILENAME, { type: "image/png" })

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      const payload: ShareData = { files: [file], text: shareText }
      if (navigator.canShare?.(payload)) {
        await navigator.share(payload)
        return "shared"
      }
      await navigator.share({ files: [file] })
      return "shared"
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error
      }
    }
  }

  downloadReceiptImage(blob)
  return "downloaded"
}

export async function createReceiptImageBlob(
  receipt: PaymentReceipt,
  labels: ReceiptImageLabels,
  locale: string,
): Promise<Blob> {
  return renderReceiptToPng(receipt, labels, locale)
}
