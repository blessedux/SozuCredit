Sozu Credit

A passkeys-powered Stellar wallet PWA for entrepreneurs to receive payments, create payment links, manage accounting & taxes, and request decentralized credit via community vouching. Built with a Vercel AI SDK assistant for hands-free business ops, receipt OCR, and low-friction UX.

Tagline: Vouched, not Verified. Credit for everyone.

⸻

1. Product Summary (Executive)
   • Simple PWA wallet (installable on mobile/desktop)
   • Passkeys login (WebAuthn) — no passwords, no KYC
   • Payments:
   • Receive via deep links / QR / payment pages
   • Send instantly (Peanut Protocol rail option)
   • Yield on idle balance (Blend vaults adapter)
   • Off-ramp connector to Mercado Pago (MP) account (where available)
   • Credit via Vouching: on-chain Trust Graph scores unlock micro-credit lines from Sozu CreditPools
   • ERP Lite: invoices, categories, tax summaries, CSV/PDF exports
   • AI Agent (Vercel AI SDK):
   • import receipt photos → OCR → auto-categorize → tax-ready
   • insights & nudges (“raise prices 5%,” “buy in bulk,” “eligible for credit +$150”)
   • conversational actions (“create a payment link for $35 coffee beans”)
   • Aesthetic: Zen, calm, neutral, one-thumb usability

⸻

2. Architecture (High-Level)

[ PWA (Next.js) ]
├─ Passkeys (WebAuthn)
├─ Vercel AI SDK Agent (chat & actions)
├─ Receipt OCR (on-device first; server fallback)
├─ Payment Links (QR/deep link)
└─ Local-first cache (SW + IndexedDB)

[ API (Node.js / Edge) ]
├─ Payment Service (Stellar, Peanut adapter)
├─ Yield Service (Blend adapter)
├─ Off-Ramp Service (Mercado Pago connector)
├─ Accounting Service (ledger, categories, tax)
└─ AI Actions (secure server-side tools)

[ Smart Contracts (Soroban) ]
├─ TrustGraph (vouches, reputation)
├─ CreditPool (terms, disbursements, repayments)
├─ PaymentLinkRegistry (optional)
└─ YieldAdapter (Blend), RailAdapter (Peanut)

[ Data ]
├─ Postgres (wallet meta, receipts, accounting)
├─ Object Storage (receipt images)
└─ Analytics (privacy-preserving product metrics)

⸻

3. App Flow (ASCII)

┌───────────────────────────────────┐
│ Home / Balance │
│ • Receive • Pay • Links • Credit │
└───────────────┬───────────────────┘
│
Create Payment Link
│
QR / Deep Link Page
│
┌─────────▼──────────┐
│ Payment Rail │
│ Stellar | Peanut │
└─────────┬──────────┘
│
Idle Balance → Yield (Blend)
│
┌────────▼─────────┐
│ ERP / Ledger │ ← AI classifies receipts
│ categories & tax│ (photo → OCR → entry)
└────────┬─────────┘
│
┌───────▼────────┐
│ Trust Graph │ (vouches ↑)
│ Reputation Score│
└───────┬─────────┘
│
Request Credit
│
┌───────▼────────┐
│ Credit Pool │ (limit/terms)
│ Disburse/Repay │
└─────────────────┘

Off-Ramp → Mercado Pago (where supported)

⸻

4. Tech Stack

Frontend / PWA
• Next.js (App Router), React, TypeScript
• Service Worker + IndexedDB (local-first, offline)
• Tailwind (minimal, accessible, zen theme)
• WebAuthn Passkeys (e.g., @simplewebauthn/browser)
• State: Zustand or Redux Toolkit (thin)

AI
• Vercel AI SDK (agentic UI, server tools)
• Action routers for: payments, ledger ops, OCR imports, tax summaries, credit requests

OCR & Parsing
• On-device: tesseract.js (fast path)
• Server fallback: configurable OCR provider
• Post-OCR parsers (total, tax, dates, merchant)

Backend
• Node.js / Edge runtime handlers
• REST/GraphQL (or tRPC) endpoints for actions
• Postgres (Supabase/Neon) + Prisma
• Object storage (e.g., Supabase Storage / S3)

Blockchain
• Stellar Soroban smart contracts:
• TrustGraph (vouch, unvouch, score)
• CreditPool (terms, disburse, repay, penalty)
• YieldAdapter (Blend)
• RailAdapter (Peanut)
• Ledger settlement + payment link registry (optional)

Off-Ramp
• Mercado Pago connector (OAuth, payouts)\*
\*Modular; disable where unavailable.

Observability & QA
• Sentry (FE/BE), Pino logs, OpenTelemetry (optional)
• Feature flags (ConfigCat/Unleash)

⸻

5. Contracts (Soroban) — Minimal Interfaces

// TrustGraph
fn vouch(voucher: Address, borrower: Address, weight: u32) -> Result<()>;
fn unvouch(voucher: Address, borrower: Address) -> Result<()>;
fn score(borrower: Address) -> u32;

// CreditPool
fn request_credit(borrower: Address, amount: i128) -> CreditOffer;
fn accept_terms(borrower: Address, offer_id: BytesN<32>) -> Result<()>;
fn disburse(offer_id: BytesN<32>) -> Result<()>;
fn repay(borrower: Address, offer_id: BytesN<32>, amount: i128) -> Result<()>;
fn terms(offer_id: BytesN<32>) -> Terms;

// Adapters
fn deposit_to_yield(account: Address, amount: i128) -> Result<()>;
fn withdraw_from_yield(account: Address, amount: i128) -> Result<()>;
fn rail_pay(from: Address, to: Address, amount: i128, memo: Bytes) -> Result<()>;

⸻

6. Data Model (Core)

Users
• id, passkey_pub, stellar_address, mp_account_id?, locale, tax_profile

PaymentLinks
• id, owner_id, amount, currency, status, memo, qr_svg, deep_link_url

LedgerEntries
• id, user_id, type (income/expense/transfer), amount, currency, category, tax_code, source (link/ocr/manual), tx_ref, created_at

Receipts
• id, user_id, image_url, ocr_json, parsed_total, parsed_tax, merchant, date

Vouches
• id, voucher_id, borrower_id, weight, created_at

Credit
• offer_id, borrower_id, limit, apr, term_days, status
• repayments[] (date, amount)

⸻

7. AI Agent (Vercel AI SDK) — Action Surface
   • createPaymentLink(amount, memo?)
   • categorizeReceipt(imageUrl)
   • summarizeTaxes(period)
   • recommendCreditLimit(userId) (reads TrustGraph score + cashflow)
   • coachGrowthTip(userId) (pricing, inventory, collections)
   • prepareOfframp(amount) (MP connector)

Guardrails:
• Read-only by default; mutations require explicit user confirmation (“Yes, create link”).

⸻

8. Security & Compliance Notes
   • Passkeys only (no SMS/OTP).
   • Zero-knowledge UX: store only what’s required for features; encrypt PII at rest.
   • No KYC for vouching credit (community-based). Respect local laws on lending; ship configurable APR caps and geo-feature flags.
   • Exportability: one-tap CSV/PDF for taxes & audits.
   • Off-ramp depends on local provider rules (MP ToS). Strict OAuth scopes, no credential storage.

⸻

9. Impact
   • Access: entrepreneurs can accept payments today, not after a bank process.
   • Lower costs: direct rails reduce 30–40% fee drag.
   • Credit equality: reputation & repayments—not paperwork—unlock growth.
   • Financial literacy: AI nudges improve margins and survival rates.
   • Transparency without exposure: private payments + public trust graph.

⸻

10. Roadmap

Phase 0 — Prototype (Week 1–2)
• Passkeys auth, Stellar wallet create/import
• Receive flow (QR / deep link), simple balance
• Payment Link MVP (testnet)
• Minimal ledger & exports (CSV)

Phase 1 — Ops Core (Month 1)
• AI agent wired to actions (create link, categorize)
• OCR (on-device + fallback), auto-categorization
• TrustGraph contract (vouch/score), profile screen
• CreditPool mock (simulated offers), repayments UI

Phase 2 — Rails & Yield (Month 2)
• Peanut rail adapter (send/receive option)
• Blend yield adapter (idle balance deposit/withdraw)
• Off-ramp: MP connector (pilot market)
• Tax dashboards (monthly VAT, income summary)

Phase 3 — Credit Go-Live (Month 3)
• Real CreditPool disbursement (testnet → limited mainnet)
• Risk params: min score, APR caps, delinquency rules
• Notifications (repayments, due dates, nudges)

Phase 4 — White-Label M2K (Month 4)
• Themes, multi-tenant orgs, course modules
• Mentor vouch dashboard & KPI analytics
• Grants/Pool funding portal (impact partners)

⸻

11. TODO (Engineering)
    • PWA shell, SW, offline cache
    • Passkeys auth flow (register/login)
    • Stellar account gen; balance & tx history
    • Payment Link service + QR & link page
    • Ledger write on payment success (webhooks)
    • OCR pipeline (tesseract + fallback)
    • AI actions (Vercel AI SDK) with confirmation guards
    • TrustGraph (contract + SDK + UI)
    • CreditPool (contract + schedule engine)
    • Peanut adapter (rail option toggle)
    • Blend adapter (idle funds → vault)
    • Mercado Pago off-ramp connector (sandbox)
    • Tax exports (CSV/PDF), categories & VAT codes
    • Sentry + product analytics (privacy-preserving)
    • Theming (M2K white-label), i18n (es/en)

⸻

12. Local Dev

# 1) Clone

git clone https://github.com/sozu-capital/sozu-credit.git
cd sozu-credit

# 2) Env

cp .env.example .env.local

# set: DATABASE_URL, STORAGE_BUCKET, STELLAR_RPC_URL, SOROBAN_KEYS,

# MP_CLIENT_ID/SECRET (optional), OCR_FALLBACK_API (optional)

# 3) Install & Run

pnpm i
pnpm dev

# 4) Contracts (Soroban)

cd contracts && make test && make deploy:testnet

Scripts
• pnpm dev — run web + API
• pnpm test — unit tests
• pnpm build — production build
• pnpm lint — code quality

⸻

13. ENV Reference (.env.example)

NODE_ENV=development
DATABASE_URL=postgres://...
STELLAR_RPC_URL=https://...
SOROBAN_SECRET_KEY=...
OCR_FALLBACK_API_URL=
MP_CLIENT_ID=
MP_CLIENT_SECRET=
BLOB_STORAGE_URL=
BLOB_STORAGE_TOKEN=
BLEND_ADAPTER_CONTRACT_ID=
PEANUT_ADAPTER_CONTRACT_ID=
TRUST_GRAPH_CONTRACT_ID=
CREDIT_POOL_CONTRACT_ID=
SENTRY_DSN=

⸻

14. UX Principles (Zen)
    • Clear one action per screen
    • Big readable numbers, neutral palette, high contrast
    • Haptics & micro-copy for confidence
    • Undo for destructive actions, confirmations for money moves
    • Always show “what happens next”

⸻

15. Licensing & Governance
    • Code: Apache-2.0 (pro-ecosystem)
    • Contracts: MIT or Apache-2.0
    • Governance: parameterized by Pool sponsors + community councils (APR caps, limits)
