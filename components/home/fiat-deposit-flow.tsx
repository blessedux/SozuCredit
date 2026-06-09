"use client"

import { useState, useCallback, useEffect } from "react"
import { Copy, Check, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { copyToClipboard, getUserId } from "@/lib/wallet-utils"
import { useWalletLanguage } from "@/lib/wallet-language"
import type {
  BankTransferInstructions,
  CreateCardDepositResponse,
  DepositIntentPublic,
  DepositMethod,
} from "@/lib/deposits/types"

type Step = "amount" | "instructions" | "status"

type StatusDisplayMap = {
  label: string
  color: string
}

function useStatusDisplay(status: string, t: ReturnType<typeof useWalletLanguage>["t"]): StatusDisplayMap {
  const map: Record<string, StatusDisplayMap> = {
    awaiting_payment: { label: t.depositFiatStatusAwaiting, color: "text-amber-400/90" },
    payment_received: { label: t.depositFiatStatusReceived, color: "text-sky-400/90" },
    pending_admin_review: { label: t.depositFiatStatusProcessing, color: "text-sky-400/90" },
    approved: { label: t.depositFiatStatusProcessing, color: "text-sky-400/90" },
    usdc_released: { label: t.depositFiatStatusProcessing, color: "text-sky-400/90" },
    completed: { label: t.depositFiatStatusCompleted, color: "text-emerald-400/90" },
    failed: { label: t.depositFiatStatusFailed, color: "text-rose-400/90" },
    refunded: { label: t.depositFiatStatusFailed, color: "text-rose-400/90" },
    flagged: { label: t.depositFiatStatusProcessing, color: "text-amber-400/90" },
  }
  return map[status] ?? { label: status, color: "text-white/50" }
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const { t } = useWalletLanguage()
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    const ok = await copyToClipboard(value)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 transition hover:bg-white/[0.08]"
    >
      <div className="min-w-0 text-left">
        <p className="text-[9px] uppercase tracking-wider text-white/35">{label}</p>
        <p className="truncate font-mono text-[11px] text-white/70">{value}</p>
      </div>
      {copied ? (
        <span className="flex shrink-0 items-center gap-1 text-[10px] text-green-400">
          <Check className="h-4 w-4" />
          {t.depositFiatCopied}
        </span>
      ) : (
        <Copy className="h-4 w-4 shrink-0 text-white/25 group-hover:text-white/60" />
      )}
    </button>
  )
}

export function FiatDepositFlow() {
  const { t } = useWalletLanguage()

  const [step, setStep] = useState<Step>("amount")
  const [method, setMethod] = useState<DepositMethod>("bank_transfer")
  const [amountClp, setAmountClp] = useState("")
  const [amountError, setAmountError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const [quoteUsdc, setQuoteUsdc] = useState<string | null>(null)
  const [quoteFx, setQuoteFx] = useState<number | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)

  const [intent, setIntent] = useState<DepositIntentPublic | null>(null)
  const [instructions, setInstructions] = useState<BankTransferInstructions | null>(null)

  const [proofValue, setProofValue] = useState("")
  const [proofBusy, setProofBusy] = useState(false)
  const [proofSent, setProofSent] = useState(false)

  const parsedAmount = parseInt(amountClp.replace(/[.,\s]/g, ""), 10)

  useEffect(() => {
    if (!Number.isInteger(parsedAmount) || parsedAmount < 1000) {
      setQuoteUsdc(null)
      setQuoteFx(null)
      return
    }

    const controller = new AbortController()
    setQuoteLoading(true)

    void (async () => {
      try {
        const res = await fetch(`/api/deposits/fx?amountClp=${parsedAmount}`, {
          signal: controller.signal,
        })
        const data = await res.json().catch(() => ({})) as {
          usdc_amount?: string
          fx_clp_per_usdc?: number
        }
        if (res.ok && data.usdc_amount) {
          setQuoteUsdc(data.usdc_amount)
          setQuoteFx(typeof data.fx_clp_per_usdc === "number" ? data.fx_clp_per_usdc : null)
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return
      } finally {
        if (!controller.signal.aborted) setQuoteLoading(false)
      }
    })()

    return () => controller.abort()
  }, [parsedAmount])

  const handleAmountSubmit = useCallback(async () => {
    setAmountError(null)
    setApiError(null)
    if (!Number.isInteger(parsedAmount) || parsedAmount < 1000) {
      setAmountError(t.depositFiatMinError)
      return
    }
    setBusy(true)
    try {
      const userId = getUserId()
      if (!userId) {
        setApiError(t.depositFiatNoWallet)
        return
      }
      const res = await fetch("/api/deposits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        credentials: "include",
        body: JSON.stringify({ method, amountClp: parsedAmount }),
      })
      const data = await res.json().catch(() => ({})) as Record<string, unknown>
      if (!res.ok) {
        setApiError(typeof data.error === "string" ? data.error : t.depositFiatError)
        return
      }

      if (method === "card") {
        const card = data as unknown as CreateCardDepositResponse
        setIntent(card.intent)
        const url = card.checkout_url
        if (url && typeof window !== "undefined") {
          window.location.href = url
        } else {
          setApiError(t.depositFiatError)
        }
        return
      }

      setIntent(data.intent as DepositIntentPublic)
      setInstructions(data.instructions as BankTransferInstructions)
      setStep("instructions")
    } catch {
      setApiError(t.depositFiatError)
    } finally {
      setBusy(false)
    }
  }, [parsedAmount, method, t])

  const handleSubmitProof = useCallback(async () => {
    if (!intent || !proofValue.trim()) return
    setProofBusy(true)
    try {
      const userId = getUserId()
      if (!userId) return
      await fetch(`/api/deposits/${intent.id}/reference`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        credentials: "include",
        body: JSON.stringify({ proof_reference: proofValue.trim() }),
      })
      setProofSent(true)
    } catch {
      // non-blocking
    } finally {
      setProofBusy(false)
    }
  }, [intent, proofValue])

  const formatClp = (n: string) => {
    const num = parseInt(n.replace(/[.,\s]/g, ""), 10)
    if (isNaN(num)) return n
    return num.toLocaleString("es-CL")
  }

  if (step === "amount") {
    return (
      <div className="flex flex-col gap-4 w-full">
        <p className="text-[10px] uppercase tracking-wider text-white/40">{t.depositFiatTitle}</p>

        <div className="flex gap-2">
          {(["bank_transfer", "card"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={cn(
                "flex-1 rounded-2xl border px-3 py-2 text-[10px] font-medium transition",
                method === m
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                  : "border-white/10 bg-white/[0.03] text-white/45 hover:bg-white/[0.06]",
              )}
            >
              {m === "bank_transfer" ? t.depositFiatMethodBank : t.depositFiatMethodCard}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-white/40" htmlFor="fiat-amount">
            {t.depositFiatAmountLabel}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-white/40">$</span>
            <input
              id="fiat-amount"
              type="number"
              inputMode="numeric"
              min={1000}
              step={1}
              value={amountClp}
              onChange={(e) => {
                setAmountClp(e.target.value)
                setAmountError(null)
              }}
              onKeyDown={(e) => e.key === "Enter" && handleAmountSubmit()}
              placeholder={t.depositFiatAmountPlaceholder}
              className={cn(
                "w-full rounded-2xl border bg-white/[0.04] pl-8 pr-4 py-3 text-sm text-white placeholder-white/25 outline-none transition",
                amountError
                  ? "border-rose-500/50 focus:border-rose-400/70"
                  : "border-white/10 focus:border-white/25",
              )}
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-white/30">CLP</span>
          </div>
          {amountError && <p className="text-[10px] text-rose-400/90">{amountError}</p>}
        </div>

        {(quoteLoading || quoteUsdc) && (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-2.5">
            <p className="text-[9px] uppercase tracking-wider text-white/30">{t.depositFiatQuoteLabel}</p>
            <p className="mt-0.5 font-mono text-sm text-white/75">
              {quoteLoading ? t.depositFiatQuoteLoading : `${quoteUsdc} USDC`}
            </p>
            {quoteFx != null && !quoteLoading && (
              <p className="mt-1 text-[9px] text-white/30">
                {t.depositFiatFxSource} · ${Math.round(quoteFx).toLocaleString("es-CL")} CLP / USDC
              </p>
            )}
          </div>
        )}

        {apiError && (
          <div className="rounded-2xl border border-rose-500/35 bg-rose-950/40 px-4 py-2.5 text-[10px] text-rose-200/90">
            {apiError}
          </div>
        )}

        <button
          type="button"
          onClick={handleAmountSubmit}
          disabled={busy || !amountClp}
          className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 px-4 py-2.5 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy
            ? method === "card"
              ? t.depositFiatCardRedirect
              : t.depositFiatSubmitting
            : method === "card"
              ? t.depositFiatCardSubmit
              : t.depositFiatSubmit}
          {!busy && <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      </div>
    )
  }

  if (step === "instructions" && instructions && intent) {
    return (
      <div className="flex flex-col gap-3 w-full">
        <p className="text-[10px] uppercase tracking-wider text-white/40">{t.depositFiatInstructionsTitle}</p>

        <div className="flex flex-col gap-2">
          <CopyButton value={instructions.bank_name} label={t.depositFiatBankLabel} />
          <CopyButton value={instructions.account_number} label={t.depositFiatAccountLabel} />
          <CopyButton value={instructions.rut} label={t.depositFiatRutLabel} />
          <CopyButton value={instructions.email} label={t.depositFiatEmailLabel} />

          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] px-4 py-2.5">
            <p className="text-[9px] uppercase tracking-wider text-white/35">{t.depositFiatReferenceLabel}</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="font-mono text-base font-semibold tracking-widest text-emerald-300">
                {instructions.reference}
              </p>
              <CopyButton value={instructions.reference} label="" />
            </div>
            <p className="mt-1.5 text-[9px] leading-relaxed text-white/40">{t.depositFiatReferenceHint}</p>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
              <p className="text-[9px] uppercase tracking-wider text-white/35">{t.depositFiatAmountConfirmLabel}</p>
              <p className="mt-0.5 font-mono text-sm text-white/80">
                ${formatClp(String(instructions.amount_clp))} CLP
              </p>
            </div>
            <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
              <p className="text-[9px] uppercase tracking-wider text-white/35">{t.depositFiatReceiveLabel}</p>
              <p className="mt-0.5 font-mono text-sm text-white/80">
                {instructions.usdc_amount} USDC
              </p>
            </div>
          </div>
        </div>

        {!proofSent ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] uppercase tracking-wider text-white/30" htmlFor="fiat-proof">
              {t.depositFiatProofLabel}
            </label>
            <div className="flex gap-2">
              <input
                id="fiat-proof"
                type="text"
                value={proofValue}
                onChange={(e) => setProofValue(e.target.value)}
                placeholder={t.depositFiatProofPlaceholder}
                className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-white/25"
              />
              <button
                type="button"
                onClick={handleSubmitProof}
                disabled={proofBusy || !proofValue.trim()}
                className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] text-white/60 transition hover:bg-white/[0.08] disabled:opacity-40"
              >
                {proofBusy ? "…" : t.depositFiatProofSubmit}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-emerald-400/80">{t.depositFiatProofSent}</p>
        )}

        <button
          type="button"
          onClick={() => setStep("status")}
          className="mt-1 text-[10px] text-white/35 hover:text-white/60 transition"
        >
          {t.depositFiatDone} →
        </button>
      </div>
    )
  }

  if (step === "status" && intent) {
    return <DepositStatusView intent={intent} />
  }

  return null
}

function DepositStatusView({ intent: initial }: { intent: DepositIntentPublic }) {
  const { t } = useWalletLanguage()
  const [intent, setIntent] = useState(initial)
  const [polling, setPolling] = useState(false)

  const statusDisplay = useStatusDisplay(intent.status, t)

  const refresh = useCallback(async () => {
    setPolling(true)
    try {
      const userId = getUserId()
      const res = await fetch(`/api/deposits/${intent.id}`, {
        headers: userId ? { "x-user-id": userId } : {},
        credentials: "include",
      })
      if (res.ok) {
        const data = await res.json() as { deposit: DepositIntentPublic }
        setIntent(data.deposit)
      }
    } finally {
      setPolling(false)
    }
  }, [intent.id])

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-between">
        <p className="text-[9px] uppercase tracking-wider text-white/35">{t.depositFiatStatusLabel}</p>
        <button
          type="button"
          onClick={refresh}
          disabled={polling}
          className="text-[9px] text-white/30 hover:text-white/60 transition"
        >
          {polling ? "…" : "↻"}
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] text-white/30">{intent.id.slice(-8).toUpperCase()}</p>
          <p className="text-sm text-white/80 mt-0.5">
            {Number(intent.amount_clp).toLocaleString("es-CL")} CLP → {intent.usdc_amount} USDC
          </p>
        </div>
        <span className={cn("text-[10px] font-medium", statusDisplay.color)}>
          {statusDisplay.label}
        </span>
      </div>

      {intent.bank_reference && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-2">
          <p className="text-[9px] uppercase tracking-wider text-white/25">{t.depositFiatReferenceLabel}</p>
          <p className="font-mono text-sm text-white/55 mt-0.5">{intent.bank_reference}</p>
        </div>
      )}
    </div>
  )
}
