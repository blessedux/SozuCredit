"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { QRCodeSVG } from "qrcode.react"
import { Copy, Check, X } from "lucide-react"
import { copyToClipboard, formatAddress } from "@/lib/wallet-utils"
import { cn } from "@/lib/utils"
import { useWalletLanguage } from "@/lib/wallet-language"
import { formatWalletText } from "@/lib/wallet-texts"
import { resolveDepositReceiveAddress } from "@/lib/wallet/deposit-receive-address"
import { getUserId } from "@/lib/wallet-utils"
import { depositsEnabled } from "@/lib/app-config"
import { fundViaSozuFaucet } from "@/lib/stellar/sozu-faucet-fund"
import {
  markWalletActivationComplete,
  markWelcomeOnboardingComplete,
} from "@/lib/wallet/needs-activation-onboarding"
import { FiatDepositFlow } from "@/components/home/fiat-deposit-flow"

type DepositModalProps = {
  isOpen: boolean
  onClose: () => void
  /** Prefer prop from wallet context; falls back to sessionStorage. */
  walletAddress?: string
  walletNetwork?: "testnet" | "mainnet"
}

type CopyMode = "tag" | "address"

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
  const router = useRouter()
  const [address, setAddress] = useState<string>("")
  const [depositAddressSource, setDepositAddressSource] = useState<
    "prop" | "storage" | "sync" | "legacy"
  >("storage")
  const [sozuTag, setSozuTag] = useState<string>("")
  const [copyMode, setCopyMode] = useState<CopyMode>("tag")
  const [tagCopied, setTagCopied] = useState(false)
  const [addressCopied, setAddressCopied] = useState(false)
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [faucetBusy, setFaucetBusy] = useState(false)
  const [faucetStatus, setFaucetStatus] = useState<"idle" | "ok" | "err">("idle")
  const [faucetError, setFaucetError] = useState<string | null>(null)
  // "crypto" = existing QR flow; "fiat" = CLP bank transfer (closed beta only)
  const [depositTab, setDepositTab] = useState<"crypto" | "fiat">(() => {
    if (typeof window === "undefined") return depositsEnabled ? "fiat" : "crypto"
    try {
      const stored = localStorage.getItem("sozu_deposit_tab_v1")
      if (stored === "crypto" || stored === "fiat") {
        if (stored === "fiat" && !depositsEnabled) return "crypto"
        return stored
      }
    } catch {
      /* ignore */
    }
    return depositsEnabled ? "fiat" : "crypto"
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      localStorage.setItem("sozu_deposit_tab_v1", depositTab)
    } catch {
      /* ignore */
    }
  }, [depositTab])

  useEffect(() => {
    if (!isOpen) {
      setVisible(false)
      setFaucetBusy(false)
      setFaucetStatus("idle")
      setFaucetError(null)
      return
    }

    let tag = ""
    if (typeof window !== "undefined") {
      tag =
        sessionStorage.getItem("dev_username_display") ??
        localStorage.getItem("sozu_username") ??
        ""
      setSozuTag(tag)
    }

    setCopyMode(tag ? "tag" : "address")

    setSetupError(
      typeof window !== "undefined"
        ? sessionStorage.getItem("wallet_setup_error")
        : null,
    )

    void (async () => {
      setResolving(true)
      try {
        const userId = getUserId()
        const { address: depositAddr, source } = await resolveDepositReceiveAddress(
          walletAddressProp,
          userId,
        )
        setDepositAddressSource(source)
        setAddress(depositAddr)
        if (!depositAddr) {
          const statusRes = await fetch("/api/wallet/smart-wallet/status")
          if (statusRes.ok) {
            const status = (await statusRes.json()) as { missingEnv?: string | null }
            if (status.missingEnv) setSetupError(status.missingEnv)
          }
        } else if (typeof window !== "undefined") {
          sessionStorage.removeItem("wallet_setup_error")
          setSetupError(null)
        }
      } finally {
        setResolving(false)
      }
    })()

    requestAnimationFrame(() => setVisible(true))
  }, [isOpen, walletAddressProp])

  const propIsC = walletAddressProp?.trim().toUpperCase().startsWith("C")
  const effectiveAddress =
    address.startsWith("C") ? address : propIsC ? walletAddressProp!.trim().toUpperCase() : address
  const hasTag = Boolean(sozuTag)
  const canShowTagQr = hasTag
  const activeCopyMode: CopyMode = canShowTagQr ? copyMode : "address"

  const qrPayload = useMemo(() => {
    if (effectiveAddress) return buildAddressQrPayload(effectiveAddress)
    return ""
  }, [effectiveAddress])

  const addressLabel = useMemo(
    () => (effectiveAddress ? formatAddress(effectiveAddress, 6, 6) : ""),
    [effectiveAddress],
  )

  const qrCaption = effectiveAddress
    ? effectiveAddress.startsWith("C")
      ? `${formatWalletText(t.depositAddressCaption, { addr: addressLabel })} · ${t.depositSmartAccountHint}`
      : formatWalletText(t.depositAddressCaption, { addr: addressLabel })
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

  const handleSozuFaucetFund = async () => {
    if (faucetBusy || walletNetwork !== "testnet") return
    setFaucetBusy(true)
    setFaucetStatus("idle")
    setFaucetError(null)
    try {
      const result = await fundViaSozuFaucet(effectiveAddress || address)
      if (result.ok) {
        setFaucetStatus("ok")
        markWelcomeOnboardingComplete()
        markWalletActivationComplete()
        onClose()
        router.replace("/home")
        return
      }
      setFaucetStatus("err")
      setFaucetError(result.error)
    } catch (e) {
      setFaucetStatus("err")
      setFaucetError(e instanceof Error ? e.message : t.depositFaucetError)
    } finally {
      setFaucetBusy(false)
    }
  }

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
        className="absolute right-5 top-[max(1.25rem,env(safe-area-inset-top))] z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-white/40 transition hover:bg-white/15 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Testnet Sozu Faucet — one-click Circle USDC, then home */}
      {walletNetwork === "testnet" ? (
        <div
          className="relative z-20 flex w-full max-w-sm flex-col gap-1.5"
          onClick={(e) => e.stopPropagation()}
          style={{
            transform: visible ? "translateY(0)" : "translateY(8px)",
            transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <button
            type="button"
            disabled={faucetBusy || resolving || !effectiveAddress}
            onClick={() => void handleSozuFaucetFund()}
            className="flex w-full items-center justify-center rounded-2xl border border-white/20 bg-white/[0.08] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-sm transition hover:bg-white/[0.14] hover:text-white active:scale-[0.99] disabled:opacity-50"
          >
            {faucetBusy ? t.depositFaucetBusy : t.depositFaucetCta}
          </button>
          {faucetStatus === "ok" ? (
            <p className="text-center text-[10px] text-white/70">{t.depositFaucetSuccess}</p>
          ) : faucetStatus === "err" ? (
            <p className="text-center text-[10px] text-red-300/90">
              {faucetError || t.depositFaucetError}
            </p>
          ) : (
            <p className="text-center text-[10px] text-white/40">{t.depositFaucetHint}</p>
          )}
        </div>
      ) : null}

      <div className="text-[9px] font-light uppercase tracking-[0.3em] text-white/35">{t.depositTitle}</div>

      {/* Rail selector — only shown when fiat deposits are enabled on this deployment */}
      {depositsEnabled ? (
        <div
          className="relative grid w-full max-w-[15.5rem] grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1"
          onClick={(e) => e.stopPropagation()}
          role="tablist"
          aria-label="Deposit method"
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
              depositTab === "crypto" ? "left-1" : "left-[calc(50%+0.125rem)]",
            )}
          />
          <button
            type="button"
            role="tab"
            aria-selected={depositTab === "crypto"}
            onClick={() => setDepositTab("crypto")}
            className={cn(
              "relative z-10 rounded-full px-3 py-2 text-[10px] font-medium uppercase tracking-wider transition-colors",
              depositTab === "crypto" ? "text-white" : "text-white/45 hover:text-white/70",
            )}
          >
            {t.depositCryptoTabLabel}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={depositTab === "fiat"}
            onClick={() => setDepositTab("fiat")}
            className={cn(
              "relative z-10 rounded-full px-3 py-2 text-[10px] font-medium uppercase tracking-wider transition-colors",
              depositTab === "fiat" ? "text-white" : "text-white/45 hover:text-white/70",
            )}
          >
            {t.depositFiatTabLabel}
          </button>
        </div>
      ) : null}

      {/* Fiat tab content */}
      {depositsEnabled && depositTab === "fiat" ? (
        <div
          className="flex w-full max-w-sm flex-col gap-2"
          onClick={(e) => e.stopPropagation()}
          style={{
            transform: visible ? "translateY(0)" : "translateY(12px)",
            transition: "transform 0.4s cubic-bezier(0.4,0,0.2,1)",
            touchAction: "manipulation",
          }}
        >
          <FiatDepositFlow />
        </div>
      ) : null}

      {/* Crypto tab content (existing QR flow) — hidden when fiat tab is active */}
      {(!depositsEnabled || depositTab === "crypto") ? (
      <>
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
              activeCopyMode === "tag" ? "left-1" : "left-[calc(50%+0.125rem)]",
            )}
          />
          <button
            type="button"
            role="tab"
            aria-selected={activeCopyMode === "tag"}
            onClick={() => setCopyMode("tag")}
            className={cn(
              "relative z-10 rounded-full px-3 py-2 text-[10px] font-medium uppercase tracking-wider transition-colors",
              activeCopyMode === "tag" ? "text-white" : "text-white/45 hover:text-white/70",
            )}
          >
            {t.depositQrTag}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeCopyMode === "address"}
            onClick={() => setCopyMode("address")}
            className={cn(
              "relative z-10 rounded-full px-3 py-2 text-[10px] font-medium uppercase tracking-wider transition-colors",
              activeCopyMode === "address" ? "text-white" : "text-white/45 hover:text-white/70",
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
        <div className="max-w-[16rem] text-center text-[10px] leading-snug text-white/40">{qrCaption}</div>
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
        {activeCopyMode === "tag" && sozuTag ? (
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

        {activeCopyMode === "address" ? (
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

        {!effectiveAddress && (setupError || resolving) ? (
          <div className="rounded-2xl border border-rose-500/35 bg-rose-950/40 px-4 py-3 text-left">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-rose-200/90">
              {t.depositNoWallet}
            </div>
            {setupError ? (
              <div className="mt-1.5 text-[10px] leading-relaxed text-white/55">{setupError}</div>
            ) : null}
            {resolving ? (
              <div className="mt-1 text-[10px] text-white/40">{t.depositResolvingWallet}</div>
            ) : null}
          </div>
        ) : null}

        {depositAddressSource === "legacy" && effectiveAddress.startsWith("G") ? (
          <div className="rounded-2xl border border-amber-500/35 bg-amber-950/40 px-4 py-2.5 text-[10px] leading-relaxed text-amber-100/90">
            {t.depositLegacyGWarning}
          </div>
        ) : null}

      </div>

      <div className="shrink-0 text-[9px] text-white/25">{t.depositUsdcOnly}</div>
      </>
      ) : null}
    </div>
  )

  return createPortal(modal, document.body)
}
