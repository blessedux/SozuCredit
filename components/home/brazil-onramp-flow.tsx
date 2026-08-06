"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { getUserId } from "@/lib/wallet-utils"
import { useWalletLanguage } from "@/lib/wallet-language"
import { getCorridor } from "@/lib/ramp/registry-core"
import { CopyButton } from "@/components/home/fiat-deposit-flow"

type Step = "onboarding" | "bank" | "amount" | "instructions" | "status"

type OnboardingApiStatus = "not_started" | "verifying" | "incomplete" | "ready"

type PixKeyType = "email" | "phone" | "cpf" | "random"

/** Etherfuse hosted-KYC launch payload — the browser form-POSTs these to `actionUrl`. */
type KycLaunch = {
  actionUrl: string
  assertion: string
  target: string
  returnUrl: string
}

/** Mirrors `RampQuote` (lib/ramp/provider.ts) — amounts are integer cents, never re-derived client-side. */
type RampQuote = {
  quoteId: string
  expiresAt: number
  senderAmountCents: number
  receiverAmountCents: number
  flatFeeCents: number
  commercialQuotation: number
}

type PixDeposit = {
  depositAmount: string
  depositBankName: string
  depositAccountHolder: string
}

type RampOrderStatus =
  | "created" | "awaiting_payment" | "funded" | "settling" | "completed" | "failed" | "refunded"

/** Mirrors the public shape `toPublic()` returns in app/api/ramp/orders/[id]/route.ts. */
type RampOrderPublic = {
  id: string
  direction: "on" | "off"
  status: RampOrderStatus
  fiatAmountMinor: number
  usdcMinor: number
  userTxHash: string | null
  settlementTxHash: string | null
  createdAt: string
}

/** Named window target so the async form-POST lands in the tab opened synchronously on click. */
const KYC_WINDOW_NAME = "sozu_ramp_kyc"
const ONBOARDING_POLL_MS = 5000
const ORDER_POLL_MS = 5000
const QUOTE_DEBOUNCE_MS = 400
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CPF_RE = /^\d{11}$/
/** Up to 2 decimals, matching BRL centavos precision — enforced after normalizing separators. */
const DECIMAL_AMOUNT_RE = /^\d+(\.\d{1,2})?$/
const IN_FLIGHT_STATUSES: RampOrderStatus[] = ["awaiting_payment", "funded", "settling"]

const BR_CORRIDOR = getCorridor("BR")
const FIAT_SYMBOL = BR_CORRIDOR?.fiatSymbol ?? "R$"

/**
 * Every `/api/ramp/*` call requires the `x-user-id` header (this product's
 * wallet session lives in local/session storage, not exclusively in a
 * Supabase cookie — same convention `fiat-deposit-flow.tsx` follows for
 * `/api/deposits`). Headers are only ever built for a confirmed, non-null id.
 */
function authHeaders(userId: string, json = false): HeadersInit {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    "x-user-id": userId,
  }
}

/**
 * Resolves the wallet session id or reports the missing-wallet error and
 * returns null — callers must bail out immediately on a null return rather
 * than fire the request without the auth header.
 */
function requireUserId(onMissing: (message: string) => void, missingMessage: string): string | null {
  const userId = getUserId()
  if (!userId) {
    onMissing(missingMessage)
    return null
  }
  return userId
}

/**
 * Parses a BRL amount typed with either locale's separators into integer
 * centavos. BRL formatting is dot-thousands/comma-decimal (e.g. "1.500,00");
 * a lone comma is always the decimal separator; a lone dot is treated as the
 * decimal separator too (matching plain numeric input like "150.00").
 * Returns null for anything that isn't a positive amount with <= 2 decimals.
 */
function parseBrlAmountToCents(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const hasComma = trimmed.includes(",")
  const hasDot = trimmed.includes(".")
  const normalized = hasComma && hasDot
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : hasComma
      ? trimmed.replace(",", ".")
      : trimmed

  if (!DECIMAL_AMOUNT_RE.test(normalized)) return null
  const n = parseFloat(normalized)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100)
}

/**
 * Builds the hidden form Etherfuse's hosted-KYC launch requires and submits
 * it into `win` (a window opened synchronously in the triggering click
 * handler — opening it here, after the async JWT fetch, would be dropped by
 * popup blockers since it's no longer inside the user-gesture call stack).
 */
function submitKycLaunchForm(win: Window | null, launch: KycLaunch): void {
  const form = document.createElement("form")
  form.method = "POST"
  form.action = launch.actionUrl
  form.target = KYC_WINDOW_NAME
  form.style.display = "none"

  const fields: Record<string, string> = {
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: launch.assertion,
    target: launch.target,
    return_url: launch.returnUrl,
  }
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input")
    input.type = "hidden"
    input.name = name
    input.value = value
    form.appendChild(input)
  }

  document.body.appendChild(form)
  form.submit()
  document.body.removeChild(form)
  win?.focus()
}

/** The three PIX deposit fields — reused on both the instructions step and, collapsed, on the status step. */
function DepositRows({ deposit }: { deposit: PixDeposit }) {
  const { t } = useWalletLanguage()
  return (
    <div className="flex flex-col gap-2">
      <CopyButton value={`${FIAT_SYMBOL} ${deposit.depositAmount}`} label={t.rampDepositAmount} />
      <CopyButton value={deposit.depositBankName} label={t.rampDepositBank} />
      <CopyButton value={deposit.depositAccountHolder} label={t.rampDepositHolder} />
    </div>
  )
}

function useRampStatusLabel(status: RampOrderStatus, t: ReturnType<typeof useWalletLanguage>["t"]): string {
  const map: Record<RampOrderStatus, string> = {
    created: t.rampStatusPending,
    awaiting_payment: t.rampStatusPending,
    funded: t.rampStatusFunded,
    settling: t.rampStatusSettling,
    completed: t.rampStatusCompleted,
    failed: t.rampStatusFailed,
    refunded: t.rampStatusRefunded,
  }
  return map[status]
}

export function BrazilOnrampFlow() {
  const { t } = useWalletLanguage()

  const [step, setStep] = useState<Step | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  // Onboarding
  const [onboardStatus, setOnboardStatus] = useState<OnboardingApiStatus>("not_started")
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [onboardBusy, setOnboardBusy] = useState(false)

  // Bank details
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [cpf, setCpf] = useState("")
  const [pixKey, setPixKey] = useState("")
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>("email")
  const [bankBusy, setBankBusy] = useState(false)

  // Amount + quote
  const [amountBrl, setAmountBrl] = useState("")
  const [quote, setQuote] = useState<RampQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteRefreshTick, setQuoteRefreshTick] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [orderBusy, setOrderBusy] = useState(false)

  // Order / instructions / status
  const [orderId, setOrderId] = useState<string | null>(null)
  const [deposit, setDeposit] = useState<PixDeposit | null>(null)
  const [order, setOrder] = useState<RampOrderPublic | null>(null)
  const [simulateBusy, setSimulateBusy] = useState(false)

  const orderRef = useRef<RampOrderPublic | null>(null)
  useEffect(() => {
    orderRef.current = order
  }, [order])

  // Resolves the wallet session id for every /api/ramp/* call, or reports
  // rampNoWallet and returns null — every call site below must bail on null
  // rather than fire the request without the x-user-id header.
  const requireUid = useCallback((): string | null => requireUserId(setApiError, t.rampNoWallet), [t.rampNoWallet])

  // Initial step derived from GET /api/ramp/onboarding.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const userId = requireUid()
      if (!userId) {
        if (!cancelled) setStep("onboarding")
        return
      }
      try {
        const res = await fetch("/api/ramp/onboarding", {
          headers: authHeaders(userId),
          credentials: "include",
        })
        const data = (await res.json().catch(() => ({}))) as {
          status?: OnboardingApiStatus
          displayName?: string
          kycEmail?: string
        }
        if (cancelled) return
        if (!res.ok) {
          setApiError(t.rampErrorGeneric)
          setStep("onboarding")
          return
        }
        const status = data.status ?? "not_started"
        setOnboardStatus(status)
        if (data.displayName) setDisplayName(data.displayName)
        if (data.kycEmail) setEmail(data.kycEmail)
        if (status === "ready") setStep("amount")
        else if (status === "incomplete") setStep("bank")
        else setStep("onboarding")
      } catch {
        if (!cancelled) {
          setApiError(t.rampErrorGeneric)
          setStep("onboarding")
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // Runs once on mount — subsequent transitions come from the onboarding poll / user actions below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Poll onboarding status every 5s while KYC is in flight.
  useEffect(() => {
    if (step !== "onboarding" || onboardStatus !== "verifying") return
    const id = setInterval(() => {
      void (async () => {
        // Background poll: skip silently on a missing session rather than
        // spamming the same error every 5s — the user already sees it from
        // whichever action first surfaced it.
        const userId = getUserId()
        if (!userId) return
        try {
          const res = await fetch("/api/ramp/onboarding", {
            headers: authHeaders(userId),
            credentials: "include",
          })
          if (!res.ok) return
          const data = (await res.json()) as { status?: OnboardingApiStatus }
          if (data.status === "incomplete") setStep("bank")
          else if (data.status === "ready") setStep("amount")
        } catch {
          // Keep polling — a transient network error shouldn't stop verification.
        }
      })()
    }, ONBOARDING_POLL_MS)
    return () => clearInterval(id)
  }, [step, onboardStatus])

  const handleStartOnboarding = useCallback(() => {
    setApiError(null)
    const trimmedName = displayName.trim()
    const trimmedEmail = email.trim()
    if (!trimmedName || !EMAIL_RE.test(trimmedEmail)) {
      setApiError(t.rampErrorGeneric)
      return
    }
    const userId = requireUid()
    if (!userId) return
    // Open the target tab synchronously, still inside this click handler —
    // this is what survives popup blockers. It stays blank until the async
    // JWT fetch below resolves and form-POSTs into it by name.
    const popup = window.open("", KYC_WINDOW_NAME)
    setOnboardBusy(true)
    void (async () => {
      try {
        const res = await fetch("/api/ramp/onboarding/start", {
          method: "POST",
          headers: authHeaders(userId, true),
          credentials: "include",
          body: JSON.stringify({ displayName: trimmedName, email: trimmedEmail }),
        })
        const data = (await res.json().catch(() => ({}))) as { launch?: KycLaunch }
        if (!res.ok || !data.launch) {
          popup?.close()
          setApiError(t.rampErrorGeneric)
          return
        }
        submitKycLaunchForm(popup, data.launch)
        setOnboardStatus("verifying")
      } catch {
        popup?.close()
        setApiError(t.rampErrorGeneric)
      } finally {
        setOnboardBusy(false)
      }
    })()
  }, [displayName, email, requireUid, t.rampErrorGeneric])

  const handleReopenKyc = useCallback(() => {
    setApiError(null)
    const userId = requireUid()
    if (!userId) return
    // Same popup-blocker-safe pattern as handleStartOnboarding.
    const popup = window.open("", KYC_WINDOW_NAME)
    setOnboardBusy(true)
    void (async () => {
      try {
        const res = await fetch("/api/ramp/onboarding/kyc-launch", {
          method: "POST",
          headers: authHeaders(userId),
          credentials: "include",
        })
        const data = (await res.json().catch(() => ({}))) as { launch?: KycLaunch }
        if (!res.ok || !data.launch) {
          popup?.close()
          setApiError(t.rampErrorGeneric)
          return
        }
        submitKycLaunchForm(popup, data.launch)
      } catch {
        popup?.close()
        setApiError(t.rampErrorGeneric)
      } finally {
        setOnboardBusy(false)
      }
    })()
  }, [requireUid, t.rampErrorGeneric])

  const handleSaveBank = useCallback(async () => {
    setApiError(null)
    const cpfDigits = cpf.replace(/[.-]/g, "")
    if (
      !firstName.trim() || !lastName.trim() ||
      !CPF_RE.test(cpfDigits) || !pixKey.trim()
    ) {
      setApiError(t.rampErrorGeneric)
      return
    }
    const userId = requireUid()
    if (!userId) return
    setBankBusy(true)
    try {
      const res = await fetch("/api/ramp/onboarding/complete", {
        method: "POST",
        headers: authHeaders(userId, true),
        credentials: "include",
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          cpf: cpfDigits,
          pixKey: pixKey.trim(),
          pixKeyType,
        }),
      })
      if (!res.ok) {
        setApiError(t.rampErrorGeneric)
        return
      }
      setStep("amount")
    } catch {
      setApiError(t.rampErrorGeneric)
    } finally {
      setBankBusy(false)
    }
  }, [firstName, lastName, cpf, pixKey, pixKeyType, requireUid, t.rampErrorGeneric])

  const parsedCents = parseBrlAmountToCents(amountBrl)

  // Debounced quote fetch — refetches when the amount changes or the previous quote expires.
  useEffect(() => {
    if (step !== "amount" || parsedCents == null) {
      setQuote(null)
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      const userId = requireUid()
      if (!userId) return
      setQuoteLoading(true)
      void (async () => {
        try {
          const res = await fetch("/api/ramp/quote", {
            method: "POST",
            headers: authHeaders(userId, true),
            credentials: "include",
            body: JSON.stringify({ direction: "on", amountMinor: parsedCents }),
            signal: controller.signal,
          })
          const data = (await res.json().catch(() => ({}))) as Partial<RampQuote>
          if (!res.ok || !data.quoteId) {
            setQuote(null)
            setApiError(t.rampErrorGeneric)
            return
          }
          setApiError(null)
          setQuote(data as RampQuote)
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return
          setApiError(t.rampErrorGeneric)
        } finally {
          if (!controller.signal.aborted) setQuoteLoading(false)
        }
      })()
    }, QUOTE_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // quoteRefreshTick is a manual re-trigger (quote expiry) with no value of its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedCents, step, quoteRefreshTick, requireUid])

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
        setQuote(null)
        setQuoteRefreshTick((n) => n + 1)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [quote])

  const handleCreateOrder = useCallback(async () => {
    if (!quote) return
    setApiError(null)
    const userId = requireUid()
    if (!userId) return
    setOrderBusy(true)
    try {
      const res = await fetch("/api/ramp/orders", {
        method: "POST",
        headers: authHeaders(userId, true),
        credentials: "include",
        body: JSON.stringify({
          direction: "on",
          quoteId: quote.quoteId,
          fiatAmountCents: quote.senderAmountCents,
          // receiverAmountCents is scale-2 USDC (display); minor is scale-7.
          usdcMinor: quote.receiverAmountCents * 100000,
          fxRate: quote.commercialQuotation,
          feeCents: quote.flatFeeCents,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        orderId?: string
        status?: RampOrderStatus
        deposit?: PixDeposit
      }
      if (!res.ok || !data.orderId || !data.deposit) {
        setApiError(t.rampErrorGeneric)
        return
      }
      setOrderId(data.orderId)
      setDeposit(data.deposit)
      setOrder({
        id: data.orderId,
        direction: "on",
        status: data.status ?? "awaiting_payment",
        fiatAmountMinor: quote.senderAmountCents,
        usdcMinor: quote.receiverAmountCents * 100000,
        userTxHash: null,
        settlementTxHash: null,
        createdAt: new Date().toISOString(),
      })
      setStep("instructions")
    } catch {
      setApiError(t.rampErrorGeneric)
    } finally {
      setOrderBusy(false)
    }
  }, [quote, requireUid, t.rampErrorGeneric])

  const refreshOrder = useCallback(async () => {
    if (!orderId) return
    // Background poll: same silent-skip-on-missing-session policy as the
    // onboarding poll above — never fire without the header, never spam.
    const userId = getUserId()
    if (!userId) return
    try {
      const res = await fetch(`/api/ramp/orders/${orderId}`, {
        headers: authHeaders(userId),
        credentials: "include",
      })
      if (!res.ok) return
      const data = (await res.json()) as RampOrderPublic
      setOrder(data)
    } catch {
      // Keep polling — a transient network error shouldn't stop the flow.
    }
  }, [orderId])

  useEffect(() => {
    if (step !== "status" || !orderId) return
    void refreshOrder()
    const id = setInterval(() => {
      const current = orderRef.current
      if (current && !IN_FLIGHT_STATUSES.includes(current.status)) {
        clearInterval(id)
        return
      }
      void refreshOrder()
    }, ORDER_POLL_MS)
    return () => clearInterval(id)
  }, [step, orderId, refreshOrder])

  const handleSimulate = useCallback(async () => {
    if (!orderId) return
    const userId = requireUid()
    if (!userId) return
    setSimulateBusy(true)
    try {
      await fetch(`/api/ramp/orders/${orderId}/simulate`, {
        method: "POST",
        headers: authHeaders(userId),
        credentials: "include",
      })
      await refreshOrder()
    } catch {
      // non-blocking
    } finally {
      setSimulateBusy(false)
    }
  }, [orderId, refreshOrder, requireUid])

  const statusLabel = useRampStatusLabel(order?.status ?? "awaiting_payment", t)
  const isMainnet = process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"

  if (step === null) {
    return <div className="h-40 w-full animate-pulse rounded-2xl bg-white/5" />
  }

  if (step === "onboarding") {
    if (onboardStatus === "verifying") {
      return (
        <div className="flex w-full flex-col gap-3">
          <p className="text-[10px] uppercase tracking-wider text-white/40">{t.rampOnboardTitle}</p>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70">
            {t.rampOnboardVerifying}
          </div>
          <button
            type="button"
            onClick={handleReopenKyc}
            disabled={onboardBusy}
            className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 px-4 py-2.5 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t.rampOnboardOpenKyc}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <p className="text-[10px] leading-relaxed text-white/40">{t.rampOnboardKycHint}</p>
          {apiError && (
            <div className="rounded-2xl border border-rose-500/35 bg-rose-950/40 px-4 py-2.5 text-[10px] text-rose-200/90">
              {apiError}
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="flex w-full flex-col gap-4">
        <p className="text-[10px] uppercase tracking-wider text-white/40">{t.rampOnboardTitle}</p>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-white/40" htmlFor="ramp-name">
            {t.rampOnboardNameLabel}
          </label>
          <input
            id="ramp-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-white/25"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-white/40" htmlFor="ramp-email">
            {t.rampOnboardEmailLabel}
          </label>
          <input
            id="ramp-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-white/25"
          />
        </div>

        {apiError && (
          <div className="rounded-2xl border border-rose-500/35 bg-rose-950/40 px-4 py-2.5 text-[10px] text-rose-200/90">
            {apiError}
          </div>
        )}

        <button
          type="button"
          onClick={handleStartOnboarding}
          disabled={onboardBusy || !displayName || !email}
          className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 px-4 py-2.5 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t.rampOnboardStart}
          {!onboardBusy && <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      </div>
    )
  }

  if (step === "bank") {
    return (
      <div className="flex w-full flex-col gap-4">
        <p className="text-[10px] uppercase tracking-wider text-white/40">{t.rampBankTitle}</p>

        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-white/40" htmlFor="ramp-first-name">
              {t.rampFirstName}
            </label>
            <input
              id="ramp-first-name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-white/25"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-white/40" htmlFor="ramp-last-name">
              {t.rampLastName}
            </label>
            <input
              id="ramp-last-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-white/25"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-white/40" htmlFor="ramp-cpf">
            {t.rampCpf}
          </label>
          <input
            id="ramp-cpf"
            type="text"
            inputMode="numeric"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder={t.rampCpfPlaceholder}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-white/25"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-white/40" htmlFor="ramp-pix-key">
              {t.rampPixKey}
            </label>
            <input
              id="ramp-pix-key"
              type="text"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-white/25"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-white/40" htmlFor="ramp-pix-key-type">
              {t.rampPixKeyType}
            </label>
            <select
              id="ramp-pix-key-type"
              value={pixKeyType}
              onChange={(e) => setPixKeyType(e.target.value as PixKeyType)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-white/25"
            >
              <option className="bg-black" value="email">{t.rampPixKeyTypeEmail}</option>
              <option className="bg-black" value="phone">{t.rampPixKeyTypePhone}</option>
              <option className="bg-black" value="cpf">{t.rampPixKeyTypeCpf}</option>
              <option className="bg-black" value="random">{t.rampPixKeyTypeRandom}</option>
            </select>
          </div>
        </div>

        {apiError && (
          <div className="rounded-2xl border border-rose-500/35 bg-rose-950/40 px-4 py-2.5 text-[10px] text-rose-200/90">
            {apiError}
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleSaveBank()}
          disabled={bankBusy || !firstName || !lastName || !cpf || !pixKey}
          className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 px-4 py-2.5 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t.rampSaveBank}
          {!bankBusy && <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      </div>
    )
  }

  if (step === "amount") {
    return (
      <div className="flex w-full flex-col gap-4">
        <p className="text-[10px] uppercase tracking-wider text-white/40">{t.rampAmountLabel}</p>

        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-white/40">
            {FIAT_SYMBOL}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={amountBrl}
            onChange={(e) => setAmountBrl(e.target.value)}
            placeholder={t.rampAmountPlaceholder}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-10 pr-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-white/25"
          />
        </div>

        {(quoteLoading || quote) && (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[9px] uppercase tracking-wider text-white/30">{t.rampQuoteReceive}</p>
              {!quoteLoading && secondsLeft != null && (
                <p className="text-[9px] text-white/30">
                  {t.rampQuoteExpires} {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
                </p>
              )}
            </div>
            <p className="mt-0.5 font-mono text-sm text-white/75">
              {quoteLoading || !quote ? "…" : `${(quote.receiverAmountCents / 100).toFixed(2)} USDC`}
            </p>
            {quote && !quoteLoading && (
              <p className="mt-1 text-[9px] text-white/30">
                {t.rampQuoteFee}: {FIAT_SYMBOL} {(quote.flatFeeCents / 100).toFixed(2)}
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
          onClick={() => void handleCreateOrder()}
          disabled={orderBusy || !quote}
          className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 px-4 py-2.5 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t.rampCreateOrder}
          {!orderBusy && <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      </div>
    )
  }

  if (step === "instructions" && deposit) {
    return (
      <div className="flex w-full flex-col gap-3">
        <p className="text-[10px] uppercase tracking-wider text-white/40">{t.rampDepositTitle}</p>
        <DepositRows deposit={deposit} />
        <button
          type="button"
          onClick={() => setStep("status")}
          className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 px-4 py-2.5 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-500/30"
        >
          {t.rampInstructionsConfirm}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  if (step === "status") {
    return (
      <div className="flex w-full flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-[9px] uppercase tracking-wider text-white/35">{statusLabel}</p>
          {order?.id && (
            <p className="font-mono text-[10px] text-white/30">{order.id.slice(-8).toUpperCase()}</p>
          )}
        </div>

        {order && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-sm text-white/80">
              {FIAT_SYMBOL} {(order.fiatAmountMinor / 100).toFixed(2)} → {(order.usdcMinor / 10_000_000).toFixed(2)} USDC
            </p>
          </div>
        )}

        {/* PIX details stay reachable while the transfer is pending — instructions is no longer the only place they render. */}
        {deposit && order?.status === "awaiting_payment" && (
          <details className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3" open>
            <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-white/40">
              {t.rampDepositTitle}
            </summary>
            <div className="mt-2">
              <DepositRows deposit={deposit} />
            </div>
          </details>
        )}

        {!isMainnet && order && IN_FLIGHT_STATUSES.includes(order.status) && (
          <button
            type="button"
            onClick={() => void handleSimulate()}
            disabled={simulateBusy}
            className={cn(
              "rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[10px] text-white/45 transition hover:bg-white/[0.06]",
              simulateBusy && "cursor-not-allowed opacity-40",
            )}
          >
            {t.rampSimulate}
          </button>
        )}
      </div>
    )
  }

  return null
}
