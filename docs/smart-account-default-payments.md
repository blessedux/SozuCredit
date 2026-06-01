# Smart account (C) default payments

Sozu Credit and Sozu Pay share the same Supabase tag directory (`profiles.username` → `stellar_wallets.public_key`).

## Defaults

| Item | Address |
|------|---------|
| User / org tag directory | **C…** smart account when provisioned |
| Sozu Pay org treasury tag | **C…** (`sorobanC ?? classicG`) |
| Sozu Credit send (non-manual) | Soroban **USDC `transfer`** via Circle SAC or Blend USDC |
| Legacy fallback | **G…** classic `Operation.payment` + UI notice |

## New Sozu Credit users

1. Passkey registers in `passkeys` table.
2. Client runs `ensureSmartWallet()` → **OpenZeppelin** deploy (preferred) via `smart-account-kit`.
3. `stellar_wallets`: `public_key` = **C**, `wallet_type` = `oz`, `oz_credential_id` = WebAuthn id.
4. If OZ env missing, falls back to **factory** (`SMART_ACCOUNT_FACTORY_ID`) with `signer_public_key` = **G**.

Run in Supabase:

- `docs/supabase-stellar-wallet-signer.sql`
- `docs/supabase-stellar-wallet-oz.sql`

## Sends

| Sender `wallet_type` | Sign path | Notes |
|----------------------|-----------|-------|
| `oz` + `get_context_rules` on C | `oz_passkey` — `kit.signAuthEntry` | Preferred path, same as SozuPay |
| `oz` without `get_context_rules` | `oz_passkey_local` — manual WebAuthn fallback | Only if contract lacks `get_context_rules` |
| `factory` | `smart_g_signer` — G fee payer + `authorizeEntry` | Factory wallets |
| `legacy` | Classic `Operation.payment` | G address recipients |

> **`contractSupportsOzKitSigning`** calls `get_context_rules` and returns `true` if the simulation succeeds — this determines whether `oz_passkey` (kit) or `oz_passkey_local` (manual) is used.

**Important:** A **C** address cannot be the Soroban transaction `source`. The **funder G** (`STELLAR_FUNDER_SECRET`) pays fees; the **C** account authorizes the token transfer via Soroban auth entries.

## Why keep the G signer?

| Role | Address | Purpose |
|------|---------|---------|
| Smart wallet (holds USDC) | **C…** | Soroban contract account — balance, Stellar Expert |
| Fee payer (funder relay) | **G…** (`STELLAR_FUNDER_SECRET`) | Pays Soroban fees, co-signs the tx server-side |
| Passkey signer key | **G…** (`signer_public_key`) | Derived from the passkey credential (for keyData) |
| Recipient | **C…** or **G…** | Resolved from shared tag directory |

## Env (align with Sozu Pay testnet)

```
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK=testnet
STELLAR_FUNDER_SECRET=<funded G keypair secret>
TESTNET_USDC_CONTRACT_ADDRESS=CBIELTK6...   # Circle SAC
OZ_SMART_ACCOUNT_WASM_HASH_TESTNET=3e51f5b2...
OZ_WEBAUTHN_VERIFIER_CONTRACT_ID_TESTNET=CATPTBRW...
OZ_THRESHOLD_POLICY_CONTRACT_ID_TESTNET=CDDQLFG...
NEXT_PUBLIC_APP_URL=http://localhost:3001   # ← MUST match the URL users access the app from
NEXT_PUBLIC_RP_ID=localhost                 # ← MUST be set explicitly; must match NEXT_PUBLIC_APP_URL's hostname
```

> **Critical:** `NEXT_PUBLIC_RP_ID` must match the hostname used when passkeys were _registered_.  
> Mismatch (e.g. registered via ngrok, signing from localhost) causes silent WebAuthn failure → `__check_auth` on-chain.

## Troubleshooting: `__check_auth` / `Error(Auth, InvalidAction)`

This error means the smart account's on-chain signature verifier rejected the WebAuthn proof.

**Step 1 — Diagnose** (no browser needed)

```bash
# Check contract type
node scripts/probe-wallet.mjs <C...>
# Should show: recommendedPath: oz_kit

# Check build pipeline
node scripts/validate-prepared-envelope.mjs <C...> <dest_G> <user_id>
# Should show: ✅ All envelope shape checks passed.
```

**Step 2 — Confirm rpID alignment**

The rpID used at passkey _registration_ must match the rpID used at _signing_.

```bash
# Both should be the same hostname
grep NEXT_PUBLIC_RP_ID .env.local        # SozuCredit
grep NEXT_PUBLIC_APP_URL .env.local      # Must match RP_ID hostname
```

If `NEXT_PUBLIC_APP_URL` was ever pointing to an ngrok URL, any passkeys registered then are
permanently tied to that hostname. Those wallets are **stuck** — they cannot send from the current localhost origin.

**Step 3 — Recovery options**

| Scenario | Action |
|----------|--------|
| Passkey registered under different origin | Sign out → register new passkey → new wallet deployed at correct URL |
| User still has access to old origin (ngrok still running) | Use that URL for signing until migration |
| USDC stuck on old C address | User must use original device/passkey (from original origin) to send USDC out |

**Step 4 — A/B signing path test** (dev only)

Set in `.env.local` or browser console:

```bash
NEXT_PUBLIC_FORCE_SIGN_PATH=kit     # Force kit.signAuthEntry only
NEXT_PUBLIC_FORCE_SIGN_PATH=manual  # Force manual signAuthEntryWithStoredPasskey only
# Or in browser console:
window.__SOZU_FORCE_SIGN_PATH = "kit"
```

## Payment API error codes

| `code` | Meaning | User action |
|--------|---------|------------|
| `SOROBAN_SIM_AUTH_FAILED` | `__check_auth` — WebAuthn proof rejected | Check rpID alignment; re-register passkey at canonical URL |
| `TX_MALFORMED` | Soroban envelope structurally invalid | Refresh and retry; report if persistent |
| `TX_BAD_AUTH` | Missing or invalid signature | Retry; check funder G is funded |
| `PASSKEY_NOT_ON_SMART_ACCOUNT` | Credential ID not found in contract keyData | Re-link smart wallet in Settings |
| `INSUFFICIENT_BALANCE` | Not enough USDC | Add USDC via faucet or deposit |
| `PASSKEY_MISSING` | Credential ID not in DB | Sign out and sign in with passkey |

## Manual send mode

Paste **C** or **G** explicitly. **G** recipients show a legacy notice and use Horizon `Operation.payment`.

## Mainnet readiness checklist

- [ ] Separate `OZ_*_PUBLIC` vars (different wasm hash, verifier, policy from testnet)
- [ ] Separate `STELLAR_FUNDER_SECRET` for mainnet (funded with XLM on PUBLIC)
- [ ] `STELLAR_NETWORK=public`
- [ ] Circle SAC contract ID for mainnet (not testnet `CBIELTK6…`)
- [ ] `NEXT_PUBLIC_APP_URL` = production domain (e.g. `https://app.sozucredit.com`)
- [ ] `NEXT_PUBLIC_RP_ID` = production domain hostname (e.g. `app.sozucredit.com`)
- [ ] `STELLAR_FUNDER_SECRET` stored in secrets manager, not in `.env` file
- [ ] CI smoke: `node scripts/probe-wallet.mjs <known-test-C>` returns `oz_kit`
- [ ] CI smoke: `node scripts/validate-prepared-envelope.mjs ...` exits 0
- [ ] 3× consecutive testnet sends with new passkeys before mainnet deploy
