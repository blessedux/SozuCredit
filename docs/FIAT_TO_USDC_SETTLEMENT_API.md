# Fiat-to-USDC Settlement API

This document explains how the fiat-to-USDC settlement works in the API, how we achieve sub‑second commitment to settlement, and how merchants get a cart ready to receive money in under five minutes.

---

## 1. Overview

- **Merchant** creates a payment session (cart) with amount, currency, conversion rate, and the Stellar address that will receive USDC.
- **Customer** pays in fiat via our licensed partner (card or bank); the partner sends us a webhook when payment is confirmed.
- **We** convert at the agreed rate and send USDC on Stellar to the merchant’s address. We act as processor/escrow; we do not integrate directly with Visa/Mastercard.

Core logic lives in **[`lib/payment-rail/fiat-to-usdc-flow.ts`](../lib/payment-rail/fiat-to-usdc-flow.ts)** (types, conversion, webhook → settlement instruction).

---

## 2. How the API Works (Step by Step)

### 2.1 Merchant: Create a payment session (cart)

The merchant calls the API with:

- **Amount** in fiat (minor units, e.g. cents)
- **Currency** (e.g. USD, ARS)
- **Conversion rate** (e.g. 1 USD = 1.0 USDC) — locked so the recipient knows exactly how much USDC they get
- **Destination**: Stellar public key (G...) that will receive USDC
- Optional: reference (order id), memo for the Stellar payment

The API:

1. Validates the payload and the Stellar address.
2. Creates a **payment-link session** (stored in the DB) with a unique `session_id` and idempotency data.
3. Returns a **payment link** (URL or session id) that the merchant gives to the customer.

Result: one “cart” = one payment session with a fixed amount, rate, and destination.

### 2.2 Customer: Pays in fiat

The customer opens the payment link and completes the fiat payment (card or bank) on the **partner’s** hosted page or API. We do not touch card details; the partner is licensed for that.

### 2.3 Partner: Sends webhook when fiat is received

When the partner confirms the payment, they send a **webhook** to our endpoint with:

- **External payment id** (we use this for idempotency: one webhook = at most one USDC payout)
- **Amount** received (minor units) and **currency**
- **Reference** (or session id) so we can find the payment session
- **Status** (we only settle when status is `completed` or `captured`)

### 2.4 Us: Webhook → USDC on Stellar in &lt;1 s

Our webhook handler:

1. **Verify** the webhook signature (partner secret).
2. **Load** the payment session from DB by reference or session id.
3. **Compute** the settlement using [`webhookToSettlementInstruction`](../lib/payment-rail/fiat-to-usdc-flow.ts): exact amount × rate → USDC, destination, memo, `idempotencyKey`.
4. **Idempotency check**: if we already processed this `externalPaymentId`, return 200 and do nothing.
5. **Send USDC** from the platform payout wallet to the session’s Stellar address (build + sign + submit to Horizon).
6. **Persist** the payment record (session id, amount, USDC, tx hash) and return 200.

We do not wait for Stellar finality before responding: we **submit** the Stellar transaction and then respond to the webhook. Submission typically happens in well under a second; Stellar confirms in ~5–10 s. So from “fiat confirmed” to “we have submitted the USDC transfer” we target **&lt;1 s**; the merchant sees funds once the ledger confirms.

---

## 3. How We Pull Off &lt;1 s Settlement

- **No extra round-trips**: On webhook receipt we do one DB read (session), one conversion (in-memory), one idempotency check, then one Stellar submit. No “queue then worker” delay for the critical path.
- **Pre-funded payout wallet**: USDC is already on our platform Stellar wallet. We do not wait for the partner to send us USDC; we debit our pool and reconcile fiat separately.
- **Fire-and-respond**: We don’t wait for Horizon’s “transaction in ledger” response before returning 200 to the partner. We submit and then respond; the tx hash is stored for the merchant to track.
- **Idempotency**: Using the partner’s `externalPaymentId` as idempotency key prevents double payouts and keeps the handler simple and fast.

So “&lt;1 s” means: **from webhook received to Stellar transaction submitted** in under a second. Confirmation on-chain follows shortly after.

---

## 4. Merchant: Cart Ready in Under 5 Minutes

We keep onboarding and cart setup minimal so a merchant can have a link ready to receive money in **under 5 minutes**.

### 4.1 One-time setup (once per merchant)

- **Register** (API key or dashboard signup).
- **Provide** the Stellar address that will receive USDC (and optionally set a default).

No card scheme agreements, no complex KYC in our flow; the fiat partner handles their side.

### 4.2 Per cart (each time they want to receive a payment)

1. **Create session** — One API call: `POST /payment-sessions` (or equivalent) with amount, currency, rate, destination (or use default).
2. **Get link** — Response includes the payment URL (or session id to build the URL).
3. **Share link** — Merchant sends the link to the customer (email, chat, in-person QR, etc.).

That’s it. No multi-step wizard; no separate “cart builder” UI required. Optional: webhook URL for the merchant so we notify them when USDC is sent (e.g. `payment.completed` with tx hash).

### 4.3 Summary: &lt;5 min to first payment link

| Step | Action | Time |
|------|--------|------|
| 1 | Sign up / get API key | ~1 min |
| 2 | Add Stellar address (or use default) | ~1 min |
| 3 | Call API to create session (amount, currency, rate, destination) | &lt;1 min |
| 4 | Use returned payment link in your flow | &lt;1 min |

Total: **under 5 minutes** to a live cart/link that can receive fiat and settle in USDC.

---

## 5. API Surface (Summary)

- **Create payment session**  
  `POST /api/payment-rail/sessions`  
  Body: amount (minor), currency, rate, destination Stellar address, optional reference/memo.  
  Response: `session_id`, `payment_url`, `expires_at` (if applicable).

- **Webhook (inbound)**  
  `POST /api/payment-rail/webhooks/:partner`  
  Partner-specific verification; body matches `FiatPaymentWebhookPayload`. We respond 200 after processing (or after idempotency skip).

- **Optional: Merchant outbound webhook**  
  When we send USDC we can POST to the merchant’s URL with `payment.completed` and the Stellar tx hash.

- **Optional: Get payment status**  
  `GET /api/payment-rail/sessions/:id`  
  Returns session and latest payment (if any) with tx hash and status.

---

## 6. References

- **[`lib/payment-rail/fiat-to-usdc-flow.ts`](../lib/payment-rail/fiat-to-usdc-flow.ts)** — Types (`PaymentLinkParams`, `PaymentLinkSession`, `FiatPaymentWebhookPayload`, `SettlementInstruction`), conversion (`fiatMinorToUsdcAmount`, `usdcAmountToStellarString`), and `webhookToSettlementInstruction`.
- **Stellar payout** — Implemented in the API layer using a platform wallet; idempotency by `externalPaymentId` before submitting.
