"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { QRCodeSVG } from "qrcode.react"
import { Copy, Check, X } from "lucide-react"
import { copyToClipboard, formatAddress } from "@/lib/wallet-utils"
import { cn } from "@/lib/utils"
import { useWalletLanguage } from "@/lib/wallet-language"
import { formatWalletText } from "@/lib/wallet-texts"
import { getBlendUsdcTestnetFundingGuide } from "@/lib/wallet/blend-usdc-funding"

type DepositModalProps = {
  isOpen: boolean
  onClose: () => void
  /** Prefer prop from wallet context; falls back to sessionStorage. */
  walletAddress?: string
  walletNetwork?: "testnet" | "mainnet"
}

type QrMode = "tag" | "address"

function buildTagQrPayload(sozuTag: string): string {
  return `$${sozuTag}`
}

function buildAddressQrPayload(address: string): string {
  return address
}

/** Block horizontal swipes from reaching the app shell panel carousel. */
function blockShellSwipe(e: React.SyntheticEvent) {
  e.stopPropagation()
}

export function DepositModal({
  isOpen,
  onClose,
  walletAddress: walletAddressProp,
  walletNetwork = "testnet",
}: DepositModalProps) {
  const { t } = useWalletLanguage()
  const [address, setAddress] = useState<string>("")
  const [sozuTag, setSozuTag] = useState<string>("")
  const [qrMode, setQrMode] = useState<QrMode>("tag")
  const [tagCopied, setTagCopied] = useState(false)
  const [addressCopied, setAddressCopied] = useState(false)
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setVisible(false)
      return
    }

    if (walletAddressProp) {
      setAddress(walletAddressProp)
    } else if (typeof window !== "undefined") {
      setAddress(sessionStorage.getItem("stellar_public_key") ?? "")
    }

    let tag = ""
    if (typeof window !== "undefined") {
      tag =
        sessionStorage.getItem("dev_username_display") ??
        localStorage.getItem("sozu_username") ??
        ""
      setSozuTag(tag)
    }

    setQrMode(tag ? "tag" : "address")
    requestAnimationFrame(() => setVisible(true))
  }, [isOpen, walletAddressProp])

  const effectiveAddress = walletAddressProp || address
  const hasTag = Boolean(sozuTag)
  const canShowTagQr = hasTag
  const activeMode: QrMode = canShowTagQr ? qrMode : "address"

  const qrPayload = useMemo(() => {
    if (activeMode === "tag" && sozuTag) return buildTagQrPayload(sozuTag)
    if (effectiveAddress) return buildAddressQrPayload(effectiveAddress)
    if (sozuTag) return buildTagQrPayload(sozuTag)
    return ""
  }, [activeMode, effectiveAddress, sozuTag])

  const addressLabel = useMemo(
    () => (effectiveAddress ? formatAddress(effectiveAddress, 6, 6) : ""),
    [effectiveAddress],
  )

  const qrCaption =
    activeMode === "tag" && sozuTag
      ? formatWalletText(t.depositTagCaption, { tag: sozuTag })
      : effectiveAddress
        ? formatWalletText(t.depositAddressCaption, { addr: addressLabel })
        : t.depositConnectWallet

  const handleCopyTag = async () => {
    if (!sozuTag) return
    const ok = await copyToClipboard(`$${sozuTag}`)
    if (!ok) return
    setTagCopied(true)
    setTimeout(() => setTagCopied(false), 2000)
  }

  const handleCopyAddress = async () => {
    if (!effectiveAddress) return
    const ok = await copyToClipboard(effectiveAddress)
    if (!ok) return
    setAddressCopied(true)
    setTimeout(() => setAddressCopied(false), 2000)
  }

  const blendFunding =
    walletNetwork === "testnet" ? getBlendUsdcTestnetFundingGuide("testnet") : null
  const showBlendGuide =
    Boolean(blendFunding) &&
    Boolean(effectiveAddress?.startsWith("C")) &&
    activeMode === "address"

  if (!isOpen || !mounted) return null

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 overflow-y-auto px-6 py-8 sm:px-8 overscroll-y-contain overscroll-none"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.35s ease",
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        touchAction: "none",
      }}
      onClick={onClose}
      onTouchStart={blockShellSwipe}
      onTouchMove={blockShellSwipe}
      onTouchEnd={blockShellSwipe}
      onMouseDown={blockShellSwipe}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t.depositClose}
        className="absolute right-5 top-[max(1.25rem,env(safe-area-inset-top))] flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-white/40 transition hover:bg-white/15 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>

      <p className="text-[9px] font-light uppercase tracking-[0.3em] text-white/35">{t.depositTitle}</p>

      {canShowTagQr ? (
        <div
          className="relative grid w-full max-w-[15.5rem] grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1"
          onClick={(e) => e.stopPropagation()}
          role="tablist"
          aria-label={t.depositQrTypeLabel}
          style={{
            transform: visible ? "translateY(0)" : "translateY(8px)",
            transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
            touchAction: "manipulation",
          }}
        >
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-full bg-white/12 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] transition-[left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
              activeMode === "tag" ? "left-1" : "left-[calc(50%+0.125rem)]",
            )}
          />
          <button
            type="button"
            role="tab"
            aria-selected={activeMode === "tag"}
            onClick={() => setQrMode("tag")}
            className={cn(
              "relative z-10 rounded-full px-3 py-2 text-[10px] font-medium uppercase tracking-wider transition-colors",
              activeMode === "tag" ? "text-white" : "text-white/45 hover:text-white/70",
            )}
          >
            {t.depositQrTag}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeMode === "address"}
            onClick={() => setQrMode("address")}
            className={cn(
              "relative z-10 rounded-full px-3 py-2 text-[10px] font-medium uppercase tracking-wider transition-colors",
              activeMode === "address" ? "text-white" : "text-white/45 hover:text-white/70",
            )}
          >
            {t.depositQrStellar}
          </button>
        </div>
      ) : null}

      <div
        className="flex flex-col items-center gap-2"
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: visible ? "translateY(0)" : "translateY(12px)",
          transition: "transform 0.4s cubic-bezier(0.4,0,0.2,1)",
          touchAction: "manipulation",
        }}
      >
        {qrPayload ? (
          <div key={qrPayload} className="inline-block rounded-2xl bg-white p-3.5 transition-opacity duration-300">
            <QRCodeSVG
              value={qrPayload}
              size={200}
              bgColor="#ffffff"
              fgColor="#111111"
              level="H"
            />
          </div>
        ) : (
          <div className="h-56 w-56 animate-pulse rounded-2xl bg-white/10" />
        )}
        <p className="max-w-[16rem] text-center text-[10px] leading-snug text-white/40">{qrCaption}</p>
      </div>

      <div
        className="flex w-full max-w-sm flex-col gap-2"
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: visible ? "translateY(0)" : "translateY(8px)",
          transition: "transform 0.45s cubic-bezier(0.4,0,0.2,1) 0.05s",
          touchAction: "manipulation",
        }}
      >
        {activeMode === "tag" && sozuTag ? (
          <button
            type="button"
            onClick={handleCopyTag}
            className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] px-4 py-2.5 transition hover:bg-emerald-500/[0.12]"
          >
            <div className="min-w-0 text-left">
              <p className="text-[9px] uppercase tracking-wider text-white/35">{t.depositSozuTag}</p>
              <p className="truncate font-mono text-[11px] text-white/70">${sozuTag}</p>
            </div>
            {tagCopied ? (
              <span className="flex shrink-0 items-center gap-1 text-[10px] text-green-400">
                <Check className="h-4 w-4" />
                {t.depositCopied}
              </span>
            ) : (
              <Copy className="h-4 w-4 shrink-0 text-white/25 group-hover:text-white/60" />
            )}
          </button>
        ) : null}

        {activeMode === "address" ? (
          <button
            type="button"
            onClick={handleCopyAddress}
            disabled={!effectiveAddress}
            className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] px-4 py-2.5 transition hover:bg-emerald-500/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <div className="min-w-0 text-left">
              <p className="text-[9px] uppercase tracking-wider text-white/35">{t.depositStellarAddress}</p>
              <p className="truncate font-mono text-[11px] text-white/70">
                {effectiveAddress ? addressLabel : t.depositNoWallet}
              </p>
            </div>
            {addressCopied ? (
              <span className="flex shrink-0 items-center gap-1 text-[10px] text-green-400">
                <Check className="h-4 w-4" />
                {t.depositCopied}
              </span>
            ) : (
              <Copy className="h-4 w-4 shrink-0 text-white/25 group-hover:text-white/60" />
            )}
          </button>
        ) : null}

        {showBlendGuide && blendFunding ? (
          <div className="rounded-2xl border border-amber-500/35 bg-amber-950/40 px-4 py-3 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">
              {t.depositBlendTitle}
            </p>
            <p className="mt-1.5 text-[10px] leading-relaxed text-white/55">{t.depositBlendHint}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-[10px] leading-snug text-white/50">
              {blendFunding.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={blendFunding.faucetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-[10px] font-medium text-amber-100 hover:bg-amber-500/25"
              >
                {t.depositBlendFaucet}
              </a>
              <a
                href={blendFunding.poolDeepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-medium text-white/70 hover:bg-white/10"
              >
                {t.depositBlendPool}
              </a>
            </div>
          </div>
        ) : null}
      </div>

      <p className="shrink-0 text-[9px] text-white/25">{t.depositUsdcOnly}</p>
    </div>
  )

  return createPortal(modal, document.body)
}
