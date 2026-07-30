# Vercel Migration Runbook: app.sozu.capital + dev.sozu.capital

**Status:** Ready to execute  
**Date:** 2026-07-30  
**Goal:** Consolidate Sozu Wallet onto single Vercel project (`sozu-credit`) with Production (`app.sozu.capital`) and Staging (`dev.sozu.capital`) environments.

## Prerequisites

- [x] `dev` branch created and pushed to GitHub
- [x] Documentation updated (deployment.md, .env.example, git-flow.md)
- [ ] Vercel dashboard access (owner or maintainer role on `sozu-credit` project)
- [ ] DNS verification (if needed): `sozu.capital` already on Vercel nameservers

## Part 1: Vercel Project Configuration

### 1.1 Configure Production Environment

**Project:** `sozu-credit` (prj_7IxlpyHRoONJP0BpqkyJ7e1jHRDw)  
**Dashboard:** https://vercel.com/blessedux/sozu-credit

1. Go to **Settings → Git**
2. Verify **Production Branch** is set to `main` (default)
3. Go to **Settings → Domains**
4. Add domain `app.sozu.capital`:
   - Click **+ Add**
   - Enter `app.sozu.capital`
   - Vercel will auto-configure DNS (already on Vercel nameservers)
   - Set as **Primary** domain (if not already)
5. If `credit.sozu.capital` is currently set as primary:
   - Demote to alias or remove (keep as alias only if you need open-beta traffic)

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

### 1.4 Remove Domain from sozu-cosed-beta (if needed)

If `app.sozu.capital` is currently on a different project:

1. Go to the old project dashboard
2. Settings → Domains
3. Find `app.sozu.capital`
4. Click **Remove** or **Edit** → select new project
5. Vercel may handle transfer automatically if both projects are in same team

**Note:** Do NOT delete `sozu-cosed-beta` project yet; keep idle until cutover verified.

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

## Part 5: Post-Cutover Cleanup (Optional)

After verifying both environments work:

1. **DNS:** Remove or archive `credit.sozu.capital` (if no longer needed)
2. **Vercel:** Archive or delete `sozu-cosed-beta` project
3. **GitHub:** Update branch protection rules:
   - Protect `main` (require PR reviews)
   - Protect `dev` (require PR reviews, ideally)
4. **SumUp:** Update webhook URLs in SumUp dashboard (if Production URL changed)
5. **Google OAuth:** Update authorized redirect URIs in Google Cloud Console

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
