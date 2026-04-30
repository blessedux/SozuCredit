/**
 * Fiat-to-USDC Payment Link + Webhook Flow
 *
 * Simple, compliant mechanism: a payment link encodes amount, conversion rate, and
 * destination; when fiat is received via a licensed partner (webhook), we compute
 * USDC and send to the user's Stellar account.
 *
 * --- Compliance model (no direct Visa/Mastercard) ---
 * We do NOT become a card acquirer or scheme participant. Instead:
 * - A licensed fiat partner (payment provider or bank) accepts card/bank transfers.
 * - That partner sends us a webhook when fiat is received; we then convert and send USDC.
 * - We act as processor/escrow: we receive notification of fiat, apply the agreed rate,
 *   and settle in USDC to the recipient. Licensing (money transmission, etc.) is
 *   handled by the fiat partner and/or our own MTL where we hold and disburse USDC.
 *
 * Flow: Customer pays fiat (via partner) → Partner webhook (exact amount + reference)
 *       → We resolve session (amount, rate, destination) → Send USDC on Stellar.
 */

// -----------------------------------------------------------------------------
// Types: Payment link and session
// -----------------------------------------------------------------------------

export type FiatCurrency = "USD" | "ARS" | "EUR" | "BRL"

export interface PaymentLinkParams {
  /** Amount in fiat (smallest unit if applicable, e.g. cents for USD) */
  amountMinor: number
  /** Fiat currency code */
  currency: FiatCurrency
  /**
   * Conversion: 1 unit of `currency` = this many USDC.
   * E.g. 1 USD -> 1.0, or 1 ARS -> 0.0012.
   * Locked at link creation so recipient knows exactly what they get.
   */
  rateFiatToUsdc: number
  /** Stellar public key (G...) that will receive USDC */
  destinationStellarAddress: string
  /** Optional reference for idempotency and reconciliation (e.g. order id) */
  reference?: string
  /** Optional memo to attach to the Stellar payment (max 28 bytes) */
  memo?: string
}

export interface PaymentLinkSession {
  id: string
  params: PaymentLinkParams
  /** When the link was created; used for expiry if needed */
  createdAt: string
  /** Idempotency key for webhook handling: same externalId => one USDC payout */
  idempotencyKey: string
}

// -----------------------------------------------------------------------------
// Types: Incoming webhook (fiat received)
// -----------------------------------------------------------------------------

export interface FiatPaymentWebhookPayload {
  /** Partner's unique payment id (we use this for idempotency) */
  externalPaymentId: string
  /** Amount received in fiat, in minor units (e.g. cents) */
  amountMinor: number
  currency: FiatCurrency
  /** Reference that ties to our PaymentLinkSession (e.g. session id or reference) */
  reference?: string
  /** Optional: partner-provided rate at time of payment (if we didn't lock rate at link creation) */
  rateFiatToUsdc?: number
  /** Status: we only settle on "completed" / "captured" */
  status: "pending" | "completed" | "captured" | "failed" | "refunded"
}

// -----------------------------------------------------------------------------
// Conversion: exact amount and rate → USDC
// -----------------------------------------------------------------------------

const USDC_DECIMALS = 7

/**
 * Converts fiat (minor units) to USDC amount using the given rate.
 * Rate is "per 1 unit of fiat" in USDC (e.g. 1 USD = 1.0 USDC).
 * Handles minor units: e.g. amountMinor 1000 (USD cents) = 10 USD → 10 * rate.
 */
export function fiatMinorToUsdcAmount(
  amountMinor: number,
  currency: FiatCurrency,
  rateFiatToUsdc: number
): number {
  const minorPerUnit = getMinorUnitsPerStandardUnit(currency)
  const fiatAmount = amountMinor / minorPerUnit
  const usdc = fiatAmount * rateFiatToUsdc
  return roundToDecimals(usdc, USDC_DECIMALS)
}

function getMinorUnitsPerStandardUnit(currency: FiatCurrency): number {
  switch (currency) {
    case "USD":
    case "ARS":
    case "EUR":
      return 100 // cents, centavos, cents
    case "BRL":
      return 100
    default:
      return 100
  }
}

function roundToDecimals(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

/**
 * Stellar payment amount must be a string with up to 7 decimal places.
 */
export function usdcAmountToStellarString(usdcAmount: number): string {
  if (usdcAmount <= 0 || !Number.isFinite(usdcAmount)) {
    throw new Error("Invalid USDC amount for Stellar")
  }
  return usdcAmount.toFixed(7)
}

// -----------------------------------------------------------------------------
// Webhook → settlement instruction (no side effects here)
// -----------------------------------------------------------------------------

export interface SettlementInstruction {
  destinationStellarAddress: string
  usdcAmount: number
  usdcAmountStellar: string
  memo?: string
  idempotencyKey: string
  reference?: string
}

/**
 * Given a resolved session (from DB) and the webhook payload, produce the
 * settlement instruction. Call this after validating webhook signature and
 * loading the session by reference or session id.
 *
 * Returns null if we should not settle (e.g. wrong status, amount mismatch).
 */
export function webhookToSettlementInstruction(
  session: PaymentLinkSession,
  payload: FiatPaymentWebhookPayload
): SettlementInstruction | null {
  const okStatuses = ["completed", "captured"]
  if (!okStatuses.includes(payload.status)) {
    return null
  }

  const rate =
    payload.rateFiatToUsdc != null
      ? payload.rateFiatToUsdc
      : session.params.rateFiatToUsdc

  const usdcAmount = fiatMinorToUsdcAmount(
    payload.amountMinor,
    payload.currency,
    rate
  )

  if (usdcAmount <= 0) {
    return null
  }

  return {
    destinationStellarAddress: session.params.destinationStellarAddress,
    usdcAmount,
    usdcAmountStellar: usdcAmountToStellarString(usdcAmount),
    memo: session.params.memo,
    idempotencyKey: payload.externalPaymentId,
    reference: session.params.reference,
  }
}

// -----------------------------------------------------------------------------
// Payment link URL builder (for API to use)
// -----------------------------------------------------------------------------

/**
 * Builds the path/query for a payment link. Your API can host this path and
 * redirect to the partner's checkout with these params, or the partner can
 * use them when creating their payment session.
 */
export function buildPaymentLinkQuery(session: PaymentLinkSession): Record<string, string> {
  const p = session.params
  return {
    session_id: session.id,
    amount: String(p.amountMinor),
    currency: p.currency,
    rate: String(p.rateFiatToUsdc),
    destination: p.destinationStellarAddress,
    ...(p.reference && { reference: p.reference }),
    ...(p.memo && { memo: p.memo.substring(0, 28) }),
  }
}

// -----------------------------------------------------------------------------
// Settlement callback type (inject into API route)
// -----------------------------------------------------------------------------

/**
 * Implement this in your API: given a settlement instruction, send USDC on
 * Stellar from the platform payout wallet to the destination. Use the
 * idempotencyKey to avoid double-sends (check DB or cache before submitting).
 */
export type SettleUsdcOnStellar = (
  instruction: SettlementInstruction
) => Promise<{ transactionHash: string } | { error: string }>
