/**
 * Off-ramp hook: quotes a USDC→BRL/PIX withdrawal, creates the order, signs
 * the user's C→treasury leg with the passkey, and submits the signed
 * envelope so the server can relay the anchor (PIX) settlement leg.
 *
 * Phases: idle -> quoting -> quoted -> creating -> signing -> submitting -> settling
 *                                                                        \-> error
 */

"use client"

import { useCallback, useRef, useState } from "react"
import { getUserId } from "@/lib/wallet-utils"

export type OfframpPhase =
  | "idle"
  | "quoting"
  | "quoted"
  | "creating"
  | "signing"
  | "submitting"
  | "settling"
  | "error"

/** Machine-readable — the modal maps these to `WalletTexts` copy, never a raw string from here. */
export type OfframpErrorCode =
  | "no_wallet"
  | "quote_failed"
  | "order_failed"
  | "sign_failed"
  | "submit_failed"

/** Mirrors `RampQuote` (lib/ramp/provider.ts) for the off-ramp direction: sender = USDC, receiver = BRL. */
export type OfframpQuote = {
  quoteId: string
  expiresAt: number
  senderAmountCents: number
  receiverAmountCents: number
  flatFeeCents: number
  commercialQuotation: number
}

/** The `build` object `POST /api/ramp/orders` (direction: "off") returns for the user's C→treasury leg. */
export type OfframpBuild = {
  unsignedXdr: string
  sorobanDataXdr: string | null
  signMethod: string
  supportsOzKitApi: boolean
  signerPublicKey: string
  walletAddress: string
  ozCredentialId: string | null
  feePayerPublicKey: string
}

export type OfframpSettlement = {
  userTxHash: string
  settlementTxHash: string
}

function authHeaders(userId: string): HeadersInit {
  return { "Content-Type": "application/json", "x-user-id": userId }
}

/**
 * Signs the off-ramp order's unsigned C→treasury transfer with the user's
 * passkey. This is a faithful lift of the `oz_passkey` / `oz_passkey_local`
 * branch in `hooks/use-send-payment.ts:549-572` — that hook is never
 * modified; this copy is driven by the `build` shape
 * `POST /api/ramp/orders` (off direction) returns instead of
 * `/api/wallet/stellar/payment`'s equivalent field.
 */
async function signBuild(build: OfframpBuild): Promise<string> {
  const { getSmartAccountKit } = await import("@/lib/stellar/smartAccounts/client")
  const { signSorobanPreparedTxWithPasskey } = await import(
    "@/lib/stellar/smartAccounts/signSorobanUsdc"
  )
  const { extractSorobanDataXdr } = await import("@/lib/stellar/soroban-prepared-envelope")
  const { getCurrentCredentialId } = await import("@/lib/storage/key-utils")
  const { kit, config } = await getSmartAccountKit()
  const credentialId = build.ozCredentialId ?? (await getCurrentCredentialId())
  // Same user-facing failure as hooks/use-send-payment.ts:529-531 — never sign with a missing credential.
  if (!credentialId) {
    throw new Error("Credential ID not found. Please log in again.")
  }
  const sorobanDataXdr =
    build.sorobanDataXdr && build.sorobanDataXdr.length > 0
      ? build.sorobanDataXdr
      : extractSorobanDataXdr(build.unsignedXdr, config.networkPassphrase)
  return signSorobanPreparedTxWithPasskey({
    kit,
    unsignedXdr: build.unsignedXdr,
    sorobanDataXdr,
    networkPassphrase: config.networkPassphrase,
    credentialId,
    smartAccountContractId: build.walletAddress,
    webauthnVerifierAddress: config.webauthnVerifierAddress,
    supportsOzKitApi: build.supportsOzKitApi === true,
    signMethod: build.signMethod,
  })
}

export function useOfframp() {
  const [phase, setPhase] = useState<OfframpPhase>("idle")
  const [quote, setQuote] = useState<OfframpQuote | null>(null)
  const [settlement, setSettlement] = useState<OfframpSettlement | null>(null)
  const [error, setError] = useState<OfframpErrorCode | null>(null)

  // The minor-unit USDC amount the current/last quote was requested for —
  // createAndSign reuses it verbatim as the order's `usdcMinor` so the
  // on-chain transfer matches exactly what was quoted (no lossy cents
  // round-trip through `quote.senderAmountCents`).
  const requestedAmountRef = useRef<number | null>(null)
  // Guards against a superseded requestQuote call's response landing after a newer one.
  const inFlightAmountRef = useRef<number | null>(null)

  const reset = useCallback(() => {
    setPhase("idle")
    setQuote(null)
    setSettlement(null)
    setError(null)
    requestedAmountRef.current = null
    inFlightAmountRef.current = null
  }, [])

  // A quote is single-use once createAndSign has consumed it: retrying after
  // order/sign/submit failure must not resubmit the same (already-attempted)
  // quoteId, and a terminal phase (settled or errored) has no more use for
  // the expiry countdown either — clearing `quote` here is what lets the
  // modal's countdown effect stop naturally instead of ticking forever.
  const clearConsumedQuote = useCallback(() => {
    setQuote(null)
    requestedAmountRef.current = null
  }, [])

  const requestQuote = useCallback(async (amountUsdcMinor: number) => {
    if (!Number.isSafeInteger(amountUsdcMinor) || amountUsdcMinor <= 0) {
      setQuote(null)
      setPhase("idle")
      setError(null)
      return
    }

    const userId = getUserId()
    if (!userId) {
      setQuote(null)
      setError("no_wallet")
      setPhase("error")
      return
    }

    inFlightAmountRef.current = amountUsdcMinor
    setError(null)
    setPhase("quoting")
    try {
      const res = await fetch("/api/ramp/quote", {
        method: "POST",
        headers: authHeaders(userId),
        credentials: "include",
        body: JSON.stringify({ direction: "off", amountMinor: amountUsdcMinor }),
      })
      const data = (await res.json().catch(() => ({}))) as Partial<OfframpQuote>
      // A newer requestQuote call superseded this one in-flight — drop the stale response.
      if (inFlightAmountRef.current !== amountUsdcMinor) return
      if (!res.ok || typeof data.quoteId !== "string") {
        setQuote(null)
        setError("quote_failed")
        setPhase("error")
        return
      }
      requestedAmountRef.current = amountUsdcMinor
      setQuote(data as OfframpQuote)
      setPhase("quoted")
    } catch {
      if (inFlightAmountRef.current !== amountUsdcMinor) return
      setQuote(null)
      setError("quote_failed")
      setPhase("error")
    }
  }, [])

  const createAndSign = useCallback(async () => {
    const currentQuote = quote
    const amountUsdcMinor = requestedAmountRef.current
    if (!currentQuote || !amountUsdcMinor) return

    const userId = getUserId()
    if (!userId) {
      setError("no_wallet")
      setPhase("error")
      return
    }

    setError(null)
    setPhase("creating")
    try {
      const orderRes = await fetch("/api/ramp/orders", {
        method: "POST",
        headers: authHeaders(userId),
        credentials: "include",
        body: JSON.stringify({
          direction: "off",
          quoteId: currentQuote.quoteId,
          fiatAmountCents: currentQuote.receiverAmountCents,
          usdcMinor: amountUsdcMinor,
          fxRate: currentQuote.commercialQuotation,
          feeCents: currentQuote.flatFeeCents,
        }),
      })
      const orderData = (await orderRes.json().catch(() => ({}))) as {
        orderId?: string
        build?: OfframpBuild
      }
      if (!orderRes.ok || !orderData.orderId || !orderData.build) {
        // The quote (and the orderId that would've been minted from it) is spent — a
        // retry must re-quote rather than resubmit the same quoteId.
        clearConsumedQuote()
        setError("order_failed")
        setPhase("error")
        return
      }

      setPhase("signing")
      let signedEnvelopeXdr: string
      try {
        signedEnvelopeXdr = await signBuild(orderData.build)
      } catch {
        clearConsumedQuote()
        setError("sign_failed")
        setPhase("error")
        return
      }

      setPhase("submitting")
      const submitRes = await fetch(`/api/ramp/orders/${orderData.orderId}/submit`, {
        method: "POST",
        headers: authHeaders(userId),
        credentials: "include",
        body: JSON.stringify({ signedEnvelopeXdr }),
      })
      const submitData = (await submitRes.json().catch(() => ({}))) as {
        userTxHash?: string
        settlementTxHash?: string
      }
      if (!submitRes.ok || !submitData.userTxHash || !submitData.settlementTxHash) {
        clearConsumedQuote()
        setError("submit_failed")
        setPhase("error")
        return
      }

      // Terminal success — the quote has done its job; clearing it here (rather than
      // leaving it set) is what lets the modal's countdown effect stop on its own.
      clearConsumedQuote()
      setSettlement({
        userTxHash: submitData.userTxHash,
        settlementTxHash: submitData.settlementTxHash,
      })
      setPhase("settling")
    } catch {
      clearConsumedQuote()
      setError("order_failed")
      setPhase("error")
    }
  }, [quote, clearConsumedQuote])

  return { phase, quote, settlement, error, requestQuote, createAndSign, reset }
}
