"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { useWalletLanguage } from "@/lib/wallet-language"
import { getUserId, formatAddress } from "@/lib/wallet-utils"
import { rampEnabled } from "@/lib/app-config"
import { getCorridor } from "@/lib/ramp/registry-core"
import { useOfframp, type OfframpErrorCode } from "@/hooks/use-offramp"
import type { WalletTexts } from "@/lib/wallet-texts"

type OfframpModalProps = {
  open: boolean
  onClose: () => void
}

type GateStatus = "loading" | "ready" | "blocked"

const BR_CORRIDOR = getCorridor("BR")
const FIAT_SYMBOL = BR_CORRIDOR?.fiatSymbol ?? "R$"
const QUOTE_DEBOUNCE_MS = 400

/** Block horizontal swipes from reaching the app shell panel carousel — same pattern as deposit-modal.tsx. */
function blockShellSwipe(e: React.SyntheticEvent) {
  e.stopPropagation()
}

/** `Math.round(parseFloat(v) * 10_000_000)` per the off-ramp spec — null for anything not a positive amount. */
function parseUsdcAmountToMinor(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = parseFloat(trimmed)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 10_000_000)
}

function offrampErrorText(code: OfframpErrorCode | null, t: WalletTexts): string | null {
  if (!code) return null
  if (code === "no_wallet") return t.rampNoWallet
  return t.rampErrorGeneric
}

export function OfframpModal({ open, onClose }: OfframpModalProps) {
  const { t } = useWalletLanguage()
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [gateStatus, setGateStatus] = useState<GateStatus>("loading")
  const [amountUsdc, setAmountUsdc] = useState("")
  const [quoteRefreshTick, setQuoteRefreshTick] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  const offramp = useOfframp()
  const { phase, quote, settlement, error, requestQuote, createAndSign, reset } = offramp
  // Once a sign/submit is in flight (or has settled), the amount->quote debounce below must
  // never re-fire — the 2-minute countdown ticking down mid-sign would otherwise call
  // requestQuote() again and stomp phase back to "quoting", clobbering the in-progress state.
  const isBusy = phase === "creating" || phase === "signing" || phase === "submitting"
  const isLocked = isBusy || phase === "settling"

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) {
      setVisible(false)
      return
    }
    requestAnimationFrame(() => setVisible(true))
  }, [open])

  // Fresh state every time the modal opens — no stale quote/phase from a previous visit.
  useEffect(() => {
    if (!open) return
    reset()
    setAmountUsdc("")
    setQuoteRefreshTick(0)
    setGateStatus("loading")

    let cancelled = false
    void (async () => {
      const userId = getUserId()
      if (!userId) {
        if (!cancelled) setGateStatus("blocked")
        return
      }
      try {
        const res = await fetch("/api/ramp/onboarding", {
          headers: { "x-user-id": userId },
          credentials: "include",
        })
        const data = (await res.json().catch(() => ({}))) as { status?: string }
        if (cancelled) return
        setGateStatus(res.ok && data.status === "ready" ? "ready" : "blocked")
      } catch {
        if (!cancelled) setGateStatus("blocked")
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Debounced quote fetch, mirroring brazil-onramp-flow.tsx's amount -> quote effect.
  // Locked out once a sign/submit is in flight or has settled — see isLocked above.
  useEffect(() => {
    if (!open || gateStatus !== "ready" || isLocked) return
    const minor = parseUsdcAmountToMinor(amountUsdc)
    if (minor == null) {
      reset()
      return
    }
    const timer = setTimeout(() => {
      void requestQuote(minor)
    }, QUOTE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // quoteRefreshTick is a manual re-trigger (quote expiry) with no value of its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountUsdc, gateStatus, open, quoteRefreshTick, requestQuote, isLocked])

  // 2-minute quote countdown; refetch once it hits zero.
  useEffect(() => {
    if (!quote) {
      setSecondsLeft(null)
      return
    }
    const tick = () => {
      const remaining = Math.max(0, Math.round((quote.expiresAt - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining <= 0) {
        setQuoteRefreshTick((n) => n + 1)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [quote])

  if (!open || !mounted || !rampEnabled) return null

  const errorText = offrampErrorText(error, t)

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
        aria-label={t.rampOfframpClose}
        className="absolute right-5 top-[max(1.25rem,env(safe-area-inset-top))] z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-white/40 transition hover:bg-white/15 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>

      <div
        className="relative z-10 flex w-full max-w-sm flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: visible ? "translateY(0)" : "translateY(12px)",
          transition: "transform 0.4s cubic-bezier(0.4,0,0.2,1)",
          touchAction: "manipulation",
        }}
      >
        <p className="text-[9px] font-light uppercase tracking-[0.3em] text-white/35">
          {t.rampOfframpTitle}
        </p>

        {gateStatus === "loading" ? (
          <div className="h-32 w-full animate-pulse rounded-2xl bg-white/5" />
        ) : gateStatus === "blocked" ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70">
            {t.rampOnboardTitle}
          </div>
        ) : phase === "settling" && settlement ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] px-4 py-3 text-sm text-emerald-100/90">
              {t.rampOfframpSettling}
            </div>
            <div className="flex flex-col gap-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5">
                <p className="text-[9px] uppercase tracking-wider text-white/35">
                  {t.rampOfframpUserTxLabel}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-white/70">
                  {formatAddress(settlement.userTxHash, 6, 6)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5">
                <p className="text-[9px] uppercase tracking-wider text-white/35">
                  {t.rampOfframpSettlementTxLabel}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-white/70">
                  {formatAddress(settlement.settlementTxHash, 6, 6)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-white/40" htmlFor="offramp-amount">
                {t.rampOfframpAmountLabel}
              </label>
              <input
                id="offramp-amount"
                type="text"
                inputMode="decimal"
                value={amountUsdc}
                onChange={(e) => setAmountUsdc(e.target.value)}
                placeholder={t.rampOfframpAmountPlaceholder}
                disabled={isBusy}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-white/25 disabled:opacity-50"
              />
            </div>

            {(phase === "quoting" || quote) && (
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] uppercase tracking-wider text-white/30">{t.rampQuoteReceive}</p>
                  {phase !== "quoting" && quote && secondsLeft != null && (
                    <p className="text-[9px] text-white/30">
                      {t.rampQuoteExpires} {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
                    </p>
                  )}
                </div>
                <p className="mt-0.5 font-mono text-sm text-white/75">
                  {phase === "quoting" || !quote
                    ? "…"
                    : `${FIAT_SYMBOL} ${(quote.receiverAmountCents / 100).toFixed(2)}`}
                </p>
                {quote && phase !== "quoting" && (
                  <p className="mt-1 text-[9px] text-white/30">
                    {t.rampQuoteFee}: {(quote.flatFeeCents / 100).toFixed(2)} USDC
                  </p>
                )}
              </div>
            )}

            {errorText && (
              <div className="rounded-2xl border border-rose-500/35 bg-rose-950/40 px-4 py-2.5 text-[10px] text-rose-200/90">
                {errorText}
              </div>
            )}

            <button
              type="button"
              onClick={() => void createAndSign()}
              disabled={isBusy || !quote}
              className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 px-4 py-2.5 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t.rampOfframpSign}
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
