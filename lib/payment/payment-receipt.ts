import { formatAddress, getStellarExpertTxUrl } from "@/lib/wallet-utils"
import type { WalletTexts } from "@/lib/wallet-texts"

export type PaymentReceipt = {
  amount: number
  currency: string
  fromLabel: string
  toLabel: string
  toAddress?: string
  transactionHash: string
  network: "testnet" | "mainnet"
  memo?: string | null
  completedAt: string
}

export function getSenderDisplayLabel(): string {
  if (typeof window === "undefined") return "—"
  const tag =
    sessionStorage.getItem("dev_username_display") ??
    localStorage.getItem("sozu_username") ??
    ""
  if (tag) {
    const clean = tag.replace(/^\$+/, "")
    return `$${clean}`
  }
  const addr = sessionStorage.getItem("stellar_public_key")
  return addr ? formatAddress(addr, 6, 6) : "—"
}

export function formatRecipientDisplayLabel(
  recipientInput: string,
  resolvedAddress: string | null,
): string {
  const trimmed = recipientInput.trim()
  if (/^G[A-Z0-9]{55}$/.test(trimmed)) {
    return formatAddress(trimmed, 6, 6)
  }
  if (trimmed) {
    const clean = trimmed.replace(/^\$+/, "")
    return `$${clean}`
  }
  if (resolvedAddress) {
    return formatAddress(resolvedAddress, 6, 6)
  }
  return "—"
}

export function formatReceiptDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale === "es" ? "es-CL" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    })
  } catch {
    return iso
  }
}

export function formatReceiptAmount(amount: number, currency: string): string {
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  })
  return `${formatted} ${currency}`
}

export function buildReceiptShareText(
  receipt: PaymentReceipt,
  t: WalletTexts,
  locale: string,
): string {
  const networkLabel =
    receipt.network === "testnet" ? t.receiptNetworkTestnet : t.receiptNetworkMainnet
  const explorerUrl = getStellarExpertTxUrl(receipt.transactionHash, receipt.network)
  const lines = [
    t.receiptShareTitle,
    "",
    `${t.receiptAmountLabel}: ${formatReceiptAmount(receipt.amount, receipt.currency)}`,
    `${t.receiptFromLabel}: ${receipt.fromLabel}`,
    `${t.receiptToLabel}: ${receipt.toLabel}`,
    `${t.receiptDateLabel}: ${formatReceiptDate(receipt.completedAt, locale)}`,
    `${t.receiptNetworkLabel}: ${networkLabel}`,
    `${t.receiptTxLabel}: ${receipt.transactionHash}`,
  ]

  if (receipt.memo?.trim()) {
    lines.push(`${t.receiptMemoLabel}: ${receipt.memo.trim()}`)
  }

  lines.push("", t.receiptShareFooter, explorerUrl)
  return lines.join("\n")
}

export function buildWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

export function buildTelegramShareUrl(text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent("")}&text=${encodeURIComponent(text)}`
}

export function buildSmsShareUrl(text: string): string {
  return `sms:?body=${encodeURIComponent(text)}`
}

export async function shareReceiptNative(receipt: PaymentReceipt, text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.share) return false
  try {
    await navigator.share({
      title: receipt.fromLabel,
      text,
    })
    return true
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return false
    return false
  }
}

export function canUseNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function"
}
