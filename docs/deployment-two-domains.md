# Two-domain deployment guide

One repo. Two Vercel projects. One shared Supabase.

## Overview

| Vercel project       | Domain                  | `NEXT_PUBLIC_BETA_TIER` | `DEPOSITS_ENABLED` |
| -------------------- | ----------------------- | ----------------------- | ------------------ |
| `sozu-credit-open`   | `credit.sozu.capital`   | `open`                  | `false`            |
| `sozu-credit-closed` | `app.sozu.capital`      | `closed`                | `true`             |

Both projects point at the **same GitHub repo** (this one), both track the `main` branch. Feature branches are short-lived; all deposit work ships through PRs to `main`.

## Setting up a second Vercel project

1. Go to [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → pick this repo.
2. Name the project `sozu-credit-closed`.
3. Under **Domains**, add `app.sozu.capital` and remove the default `*.vercel.app` alias (or keep it for previews).
4. Set all environment variables (see section below).
5. Repeat for `sozu-credit-open` / `credit.sozu.capital` if not already deployed.

## Environment variables — per-project differences

Set these differently in each project's Vercel dashboard:

```
# app.sozu.capital (closed beta — deposits on)
NEXT_PUBLIC_APP_URL=https://app.sozu.capital
NEXT_PUBLIC_RP_ID=app.sozu.capital
WALLET_CLIENT_DOMAIN=app.sozu.capital
NEXT_PUBLIC_BETA_TIER=closed
DEPOSITS_ENABLED=true
NEXT_PUBLIC_DEPOSITS_ENABLED=true

# credit.sozu.capital (open beta — deposits off)
NEXT_PUBLIC_APP_URL=https://credit.sozu.capital
NEXT_PUBLIC_RP_ID=credit.sozu.capital
WALLET_CLIENT_DOMAIN=credit.sozu.capital
NEXT_PUBLIC_BETA_TIER=open
DEPOSITS_ENABLED=false
NEXT_PUBLIC_DEPOSITS_ENABLED=false
```

## Environment variables — shared between both projects

Copy these identical values to both:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

STELLAR_FUNDER_SECRET=
STELLAR_NETWORK=
SOROBAN_RPC_URL=
SMART_ACCOUNT_FACTORY_ID=
SMART_ACCOUNT_FACTORY_METHOD=
SMART_ACCOUNT_GET_ADDRESS_VIEW=
TESTNET_USDC_CONTRACT_ADDRESS=
SEP10_CLIENT_SIGNING_SECRET=
SDP_ALLOWED_DOMAINS=
SDP_TENANT_NAME=
OZ_SMART_ACCOUNT_WASM_HASH_TESTNET=
OZ_WEBAUTHN_VERIFIER_CONTRACT_ID_TESTNET=
OZ_THRESHOLD_POLICY_CONTRACT_ID_TESTNET=

# Deposit / treasury (needed for closed beta only but harmless to set on both)
SOZU_CLP_BANK_NAME=
SOZU_CLP_BANK_ACCOUNT=
SOZU_CLP_BANK_RUT=
SOZU_CLP_BANK_EMAIL=
DEPOSIT_FX_CLP_PER_USDC=950
DEPOSIT_FX_SPREAD_BPS=100
BETA_AUTO_RELEASE_LIMIT_CLP=500000

# SumUp (card deposits — closed beta)
SUMUP_API_KEY=
SUMUP_MERCHANT_CODE=
SUMUP_WEBHOOK_SECRET=
```

## CLP / USDC live oracle

Deposit quotes use a **live CLP oracle** (`lib/deposits/clp-oracle.ts`):

1. **mindicador.cl** — Chile USD observation (primary)
2. **Frankfurter** (ECB) — fallback when CLP is available
3. **`DEPOSIT_FX_CLP_PER_USDC`** — static fallback if both fail

Optional **`DEPOSIT_FX_SPREAD_BPS`** (default `100` = 1%) is added to spot before quoting USDC.

Preview rate in UI: `GET /api/deposits/fx?amountClp=50000` (no auth).

## SumUp card → Sozu wallet flow

Only on **`app.sozu.capital`** (`DEPOSITS_ENABLED=true`):

1. User selects **Tarjeta** in deposit modal → `POST /api/deposits` with `method: card`
2. Server creates `deposit_intents` row in Supabase + SumUp **hosted checkout**
3. User pays on SumUp → webhook `POST /api/deposits/sumup/webhook`
4. Server verifies checkout via SumUp API → status `payment_received` or `pending_admin_review`
5. Admin / auto-release job credits **USDC to `destination_stellar_address`** (C wallet)

Configure SumUp webhook / checkout `return_url` to `https://app.sozu.capital/api/deposits/sumup/webhook`.

**Common 401 causes:**

| Symptom | Fix |
|---------|-----|
| Card checkout fails immediately | `SUMUP_API_KEY` must be **secret** `sup_sk_…`, not public `sup_pk_…` |
| Webhook returns 401 | Remove or fix `SUMUP_WEBHOOK_SECRET` — checkout callbacks often have **no** `x-payload-signature`; leave secret unset and we verify via SumUp API |
| Wrong secret type | `cc_sk_classic_…` is OAuth client secret, not necessarily the webhook HMAC secret |

Probe URL: `GET https://app.sozu.capital/api/deposits/sumup/webhook` → `{ ok: true }`.

## Passkey constraint

Passkeys are **origin-bound** by the WebAuthn spec. A credential registered on `credit.sozu.capital` cannot be used on `app.sozu.capital`, even though they share the same Supabase user records. Closed-beta users should register and transact on `app.sozu.capital`. If a user needs access on both subdomains, they add a passkey per-domain via Settings.

## SDP invite links

Current SDP disbursement invites are signed for `credit.sozu.capital` as `client_domain`. Do not change this until you explicitly add `app.sozu.capital` to the SDP allowed client domains and update `stellar.toml` on each domain. Until then, SEP-24 registration remains on credit only.

## Local development

To test the closed-beta deposit UI locally:

```bash
# .env.local
NEXT_PUBLIC_BETA_TIER=closed
DEPOSITS_ENABLED=true
NEXT_PUBLIC_DEPOSITS_ENABLED=true
DEPOSIT_FX_CLP_PER_USDC=950
SOZU_CLP_BANK_NAME="Sozu Capital SpA"
SOZU_CLP_BANK_ACCOUNT="00-000-00000-00"
SOZU_CLP_BANK_RUT="12.345.678-9"
SOZU_CLP_BANK_EMAIL="depositos@sozu.capital"
```
