# Vercel Migration Runbook: app.sozu.capital + dev.sozu.capital

**Status:** Ready to execute  
**Date:** 2026-07-31  
**Goal:** Consolidate Sozu Wallet onto a single Vercel project (`sozu-wallet`, renamed from `sozu-credit`) with Production (`app.sozu.capital`, closed beta) and Staging (`dev.sozu.capital`).

> **Read first:** [vercel-consolidation.md](./vercel-consolidation.md) — safe order for moving `app.sozu.capital` off `sozu-cosed-beta` before deleting that project.

## Prerequisites

- [x] `dev` branch created and pushed to GitHub
- [x] Documentation updated (deployment.md, .env.example, git-flow.md)
- [ ] Vercel dashboard access (owner or maintainer role on `sozu-credit` project)
- [ ] DNS verification (if needed): `sozu.capital` already on Vercel nameservers

## Part 1: Vercel Project Configuration

### 1.0 Rename project (optional but preferred)

1. Open the existing project (today: `sozu-credit`)
2. Settings → General → rename to **`sozu-wallet`**
3. Confirm GitHub repo link still works (after GitHub rename to `sozu-wallet`, reconnect if needed)

### 1.1 Configure Production Environment

**Project:** `sozu-wallet` (formerly `sozu-credit`, prj_7IxlpyHRoONJP0BpqkyJ7e1jHRDw)  
**Dashboard:** https://vercel.com/mentes-projects/sozu-credit (URL updates after rename)

1. Go to **Settings → Git**
2. Verify **Production Branch** is set to `main` (default)
3. Go to **Settings → Domains**
4. Add domain `app.sozu.capital` **only after** removing it from `sozu-cosed-beta` (see consolidation doc Phase B):
   - Click **+ Add**
   - Enter `app.sozu.capital`
   - Assign to **Production**
   - Set as **Primary** domain
5. If `credit.sozu.capital` is currently set as primary:
   - Demote to alias, redirect to `app.sozu.capital`, or remove after cutover

### 1.2 Create Staging Environment

**Dashboard:** https://vercel.com/blessedux/sozu-credit/settings/git

1. Scroll to **Custom Environments**
2. Click **Create Environment**
3. Environment name: **Staging** (exactly, capital S)
4. Assign branch: `dev`
5. Click **Create**

### 1.3 Add Staging Domain

**Dashboard:** https://vercel.com/blessedux/sozu-credit/settings/domains

1. Click **+ Add**
2. Enter `dev.sozu.capital`
3. Vercel will show environment selector
4. Select **Staging** environment
5. Click **Add**
6. Verify DNS propagation (usually instant on Vercel nameservers)

### 1.4 Move domain off sozu-cosed-beta (required before delete)

`app.sozu.capital` is live on **`sozu-cosed-beta` today**. Transfer before any delete:

1. Open `sozu-cosed-beta` → Settings → Domains
2. Remove `app.sozu.capital`
3. Immediately add it on `sozu-wallet` → Production (step 1.1)
4. Redeploy Production and run smoke checks in Part 4
5. **Only after 24–48h soak:** disconnect Git + delete `sozu-cosed-beta`

Deleting first = production outage.

## Part 2: Environment Variables

**Dashboard:** https://vercel.com/blessedux/sozu-credit/settings/environment-variables

### 2.1 Environment-Specific Variables (CRITICAL)

These **must** differ between Production and Staging due to passkey origin binding.

#### Set for Production Environment

Click **Add New** for each:

| Variable | Value | Environments |
|----------|-------|--------------|
| `NEXT_PUBLIC_APP_URL` | `https://app.sozu.capital` | **Production only** |
| `NEXT_PUBLIC_RP_ID` | `app.sozu.capital` | **Production only** |
| `WALLET_CLIENT_DOMAIN` | `app.sozu.capital` | **Production only** |

#### Set for Staging Environment

Click **Add New** for each:

| Variable | Value | Environments |
|----------|-------|--------------|
| `NEXT_PUBLIC_APP_URL` | `https://dev.sozu.capital` | **Staging only** |
| `NEXT_PUBLIC_RP_ID` | `dev.sozu.capital` | **Staging only** |
| `WALLET_CLIENT_DOMAIN` | `dev.sozu.capital` | **Staging only** |

#### Optional: Host-Bound Callback URLs

If you have explicit redirect URIs set, split them per environment:

**Production:**
- `GOOGLE_REDIRECT_URI=https://app.sozu.capital/api/gmail/callback`
- `SUMUP_REDIRECT_URL=https://app.sozu.capital/deposit/return`
- `SUMUP_WEBHOOK_URL=https://app.sozu.capital/api/deposits/sumup/webhook`

**Staging:**
- `GOOGLE_REDIRECT_URI=https://dev.sozu.capital/api/gmail/callback`
- `SUMUP_REDIRECT_URL=https://dev.sozu.capital/deposit/return`
- `SUMUP_WEBHOOK_URL=https://dev.sozu.capital/api/deposits/sumup/webhook`

If these are unset, the app auto-constructs them from `NEXT_PUBLIC_APP_URL`.

### 2.2 Shared Variables (Copy to Both Environments)

Ensure these exist on **Production**, **Staging**, AND **Preview**:

**Supabase** (same database for all environments):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**NextAuth:**
- `AUTH_SECRET` (generate new if missing: `openssl rand -base64 32`)

**Stellar / Soroban Testnet:**
- `STELLAR_FUNDER_SECRET`
- `STELLAR_NETWORK=testnet`
- `SOROBAN_RPC_URL=https://soroban-testnet.stellar.org`
- `SMART_ACCOUNT_FACTORY_ID`
- `SMART_ACCOUNT_FACTORY_METHOD=create_account`
- `SMART_ACCOUNT_GET_ADDRESS_VIEW=get_address`
- `TESTNET_USDC_CONTRACT_ADDRESS`
- `CIRCLE_TESTNET_USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`

**OpenZeppelin Smart Account:**
- `OZ_SMART_ACCOUNT_WASM_HASH_TESTNET`
- `OZ_WEBAUTHN_VERIFIER_CONTRACT_ID_TESTNET`
- `OZ_THRESHOLD_POLICY_CONTRACT_ID_TESTNET`

**SEP-10 Client Domain:**
- `SEP10_CLIENT_SIGNING_SECRET`
- `WALLET_DOCUMENTATION_URL=https://app.sozu.capital`

**SDP Integration:**
- `SDP_ALLOWED_DOMAINS`
- `SDP_TENANT_NAME`
- `SDP_ADMIN_EMAIL`
- `SDP_ADMIN_PASSWORD`
- `SDP_ADMIN_API_KEY`
- `SDP_API_URL`

**Faucet (Testnet):**
- `FAUCET_CONTRACT_ID`
- `FAUCET_TREASURY_SECRET`
- `FAUCET_TOKEN_CONTRACT_ID`
- `FAUCET_USER_COOLDOWN_HOURS=24`
- `FAUCET_GLOBAL_COOLDOWN_MINUTES`
- `FAUCET_DAILY_LIMIT`
- `FAUCET_CLAIM_AMOUNT`
- `FAUCET_HASH_SALT`
- `NEXT_PUBLIC_DEMO_FAUCET_PATH=/faucet/test-orb-001`

**Deposits (CLP Bank + SumUp):**
- `NEXT_PUBLIC_BETA_TIER=closed`
- `DEPOSITS_ENABLED=true`
- `NEXT_PUBLIC_DEPOSITS_ENABLED=true`
- `SOZU_CLP_BANK_NAME`
- `SOZU_CLP_BANK_ACCOUNT`
- `SOZU_CLP_BANK_RUT`
- `SOZU_CLP_BANK_EMAIL`
- `DEPOSIT_FX_CLP_PER_USDC=950`
- `DEPOSIT_FX_SPREAD_BPS=100`
- `BETA_AUTO_RELEASE_LIMIT_CLP=500000`

**SumUp (Card Deposits):**
- `SUMUP_API_KEY` (secret: `sup_sk_...`)
- `SUMUP_MERCHANT_CODE`
- `SUMUP_WEBHOOK_SECRET` (optional, leave unset if checkout callbacks have no signature)

**Google OAuth (Gmail Sync):**
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`

**Turnkey (Optional HD Wallet):**
- `TURNKEY_API_BASE_URL`
- `TURNKEY_ORGANIZATION_ID`
- `TURNKEY_API_PUBLIC_KEY`
- `TURNKEY_API_PRIVATE_KEY`

### 2.3 Verify Existing Variables

Check if any Production-only variables need to be copied to Staging:
1. Go to **Settings → Environment Variables**
2. Filter by **Production**
3. Look for any `AUTH_SECRET`, `SEP10_CLIENT_SIGNING_SECRET`, or `SDP_*` vars
4. If missing from Staging, add them

## Part 3: SDP Configuration (if using SEP-24)

If you're using SDP disbursement invites, update allowed client domains:

1. SDP admin panel → Settings → Allowed Client Domains
2. Add `app.sozu.capital` and `dev.sozu.capital`
3. Update `stellar.toml` on both domains (Vercel hosts this at `/.well-known/stellar.toml`)
4. Verify `SIGNING_KEY` matches your `SEP10_CLIENT_SIGNING_SECRET` public key

## Part 4: Redeploy & Smoke Test

### 4.1 Trigger Deployments

**Dashboard:** https://vercel.com/blessedux/sozu-credit/deployments

1. **Staging:** Push any commit to `dev` branch or trigger manual redeploy
   - Or: Dashboard → Deployments → find latest `dev` deploy → click **⋯** → **Redeploy**
2. **Production:** Push any commit to `main` branch or trigger manual redeploy
   - Or: Dashboard → Deployments → find latest `main` deploy → click **⋯** → **Redeploy**

Wait for both deployments to complete (green checkmark).

### 4.2 Smoke Test Checklist

#### Staging (dev.sozu.capital)

- [ ] Open https://dev.sozu.capital
- [ ] Verify page title = "Sozu Wallet" (check `<title>` tag or PWA install prompt)
- [ ] Verify apple-web-app-title = "Sozu Wallet" (iOS Safari → Add to Home Screen)
- [ ] Open DevTools → Console → check for `NEXT_PUBLIC_RP_ID`
  ```js
  // Should log: dev.sozu.capital
  console.log(window.location.hostname)
  ```
- [ ] Register a NEW passkey (don't reuse production passkey)
  - Settings → Security → Add Passkey
  - Should show RP ID = `dev.sozu.capital` in browser prompt
- [ ] Test Deposit → Faucet path:
  - Home → Deposit button → should route to `/faucet/test-orb-001`
- [ ] Check stellar.toml: https://dev.sozu.capital/.well-known/stellar.toml
  - Should list `SIGNING_KEY` matching your `SEP10_CLIENT_SIGNING_SECRET`

#### Production (app.sozu.capital)

- [ ] Open https://app.sozu.capital
- [ ] Verify page title = "Sozu Wallet"
- [ ] Verify apple-web-app-title = "Sozu Wallet" (iOS Safari → Add to Home Screen)
- [ ] Open DevTools → Console → check for `NEXT_PUBLIC_RP_ID`
  ```js
  // Should log: app.sozu.capital
  console.log(window.location.hostname)
  ```
- [ ] Register a NEW passkey (don't reuse staging passkey)
  - Settings → Security → Add Passkey
  - Should show RP ID = `app.sozu.capital` in browser prompt
- [ ] Test Deposit → Faucet path (testnet only):
  - Home → Deposit button → should route to `/faucet/test-orb-001`
- [ ] Check stellar.toml: https://app.sozu.capital/.well-known/stellar.toml
  - Should list `SIGNING_KEY` matching your `SEP10_CLIENT_SIGNING_SECRET`

### 4.3 Verify Passkey Isolation

**CRITICAL:** Passkeys must NOT work across environments.

1. Register passkey on `dev.sozu.capital` → sign out
2. Open `app.sozu.capital` → try to authenticate with same passkey
3. **Expected:** Passkey should fail (origin mismatch)
4. Register NEW passkey on `app.sozu.capital` → should succeed

If a passkey registered on Staging works on Production (or vice versa), the `NEXT_PUBLIC_RP_ID` environment variables are not correctly set.

## Part 5: Post-Cutover Cleanup

After verifying Staging + Production on `sozu-wallet`:

1. **GitHub:** Rename repo `SozuCredit` → `sozu-wallet`; set homepage `https://app.sozu.capital`
2. **Vercel:** Disconnect Git from `sozu-cosed-beta`, then delete/archive the project (stops duplicate Preview checks)
3. **DNS:** Redirect or retire `credit.sozu.capital`
4. **Branch protection:** Protect `main` and ideally `dev`
5. **SumUp / Google OAuth:** Confirm webhook and redirect URIs use `app.sozu.capital` / `dev.sozu.capital`

## Rollback Plan

If Production deployment fails:

1. Vercel Dashboard → Deployments
2. Find last working `main` deployment
3. Click **⋯** → **Redeploy**
4. If domains are broken:
   - Remove `app.sozu.capital` from `sozu-credit`
   - Re-add to `sozu-cosed-beta` (if still available)
   - DNS propagates in ~5 minutes

## Verification Commands

```bash
# Check DNS propagation
dig app.sozu.capital +short
dig dev.sozu.capital +short

# Should both resolve to Vercel IPs (76.76.21.*)

# Check stellar.toml
curl https://app.sozu.capital/.well-known/stellar.toml
curl https://dev.sozu.capital/.well-known/stellar.toml

# Check passkey RP ID in browser console
# Open dev.sozu.capital, then:
console.log(window.location.hostname) // dev.sozu.capital

# Open app.sozu.capital, then:
console.log(window.location.hostname) // app.sozu.capital
```

## Troubleshooting

### Passkeys not working

- Check Vercel env vars: `NEXT_PUBLIC_RP_ID` must match hostname
- Clear browser cache and cookies
- Try incognito/private window
- Check browser console for WebAuthn errors

### Domain not resolving

- Verify domain is added in Vercel dashboard
- Check DNS: `dig <domain> +short` should show Vercel IPs
- Wait 5-10 minutes for DNS propagation
- Check Vercel status page: https://www.vercel-status.com

### Deployment fails

- Check build logs in Vercel dashboard
- Verify all required env vars are set (especially `AUTH_SECRET`, `SEP10_CLIENT_SIGNING_SECRET`)
- Check for missing dependencies in package.json
- Run `bun run build` locally to reproduce

### SumUp webhooks returning 401

- `SUMUP_API_KEY` must be secret key (`sup_sk_...`), not public key
- Remove `SUMUP_WEBHOOK_SECRET` if SumUp isn't sending `x-payload-signature`
- Update webhook URL in SumUp dashboard to match new domain

## Reference

- [Vercel Custom Environments](https://vercel.com/docs/deployments/environments)
- [Vercel Custom Domains](https://vercel.com/docs/projects/domains)
- [WebAuthn RP ID Spec](https://w3c.github.io/webauthn/#relying-party-identifier)
- [docs/deployment.md](./deployment.md) — Full deployment guide
- [docs/agents/git-flow.md](./agents/git-flow.md) — Git workflow
