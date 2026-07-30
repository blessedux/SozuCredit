# Vercel Cutover Status

**Date:** 2026-07-30  
**Agent:** Cloud Agent (cursor/app-and-dev-domains-3d62)  
**Goal:** Consolidate Sozu Wallet onto single Vercel project with app.sozu.capital (Production) and dev.sozu.capital (Staging)

## ✅ Completed Tasks

### 1. Git Branch Structure
- [x] Created `dev` branch from `main` ([commit 311011e](https://github.com/blessedux/SozuCredit/commit/311011e))
- [x] Pushed `dev` branch to origin
- [x] Both branches are now tracking correctly

### 2. Documentation
- [x] Created [`docs/agents/git-flow.md`](docs/agents/git-flow.md) — Git workflow guide for agents and developers
- [x] Created [`docs/deployment.md`](docs/deployment.md) — Comprehensive deployment guide for Production/Staging
- [x] Created [`docs/vercel-migration-runbook.md`](docs/vercel-migration-runbook.md) — Step-by-step Vercel cutover instructions
- [x] Updated [`.env.example`](.env.example) — Documented Production vs Staging URL/RP ID variables
- [x] Updated [`lib/app-config.ts`](lib/app-config.ts) — Updated betaTier comment to reflect new model

### 3. Automation
- [x] Created [`scripts/vercel-set-env-vars.sh`](scripts/vercel-set-env-vars.sh) — Script to automate env var setup via Vercel CLI

## 🔒 Blocked Tasks (Require Manual Vercel Access)

The following tasks require Vercel dashboard authentication that cloud agents cannot provide. These must be completed by a human with Vercel project access.

### 4. Vercel Project Configuration
- [ ] **Create Staging environment** on `sozu-credit` project
  - Dashboard → Settings → Git → Custom Environments → Create "Staging"
  - Assign branch: `dev`
- [ ] **Add Production domain** `app.sozu.capital`
  - Dashboard → Settings → Domains → Add `app.sozu.capital`
  - Set as primary Production domain
- [ ] **Add Staging domain** `dev.sozu.capital`
  - Dashboard → Settings → Domains → Add `dev.sozu.capital`
  - Assign to Staging environment
- [ ] **Move domain** `app.sozu.capital` from `sozu-cosed-beta` (if needed)

**Instructions:** See [`docs/vercel-migration-runbook.md`](docs/vercel-migration-runbook.md) Part 1

### 5. Environment Variables
- [ ] **Production environment** (main branch):
  - `NEXT_PUBLIC_APP_URL=https://app.sozu.capital`
  - `NEXT_PUBLIC_RP_ID=app.sozu.capital`
  - `WALLET_CLIENT_DOMAIN=app.sozu.capital`
- [ ] **Staging environment** (dev branch):
  - `NEXT_PUBLIC_APP_URL=https://dev.sozu.capital`
  - `NEXT_PUBLIC_RP_ID=dev.sozu.capital`
  - `WALLET_CLIENT_DOMAIN=dev.sozu.capital`
- [ ] **Copy shared secrets** to Staging (if missing):
  - `AUTH_SECRET`
  - `SEP10_CLIENT_SIGNING_SECRET`
  - All Supabase, Stellar, SDP, Faucet, and Deposit variables

**Instructions:** See [`docs/vercel-migration-runbook.md`](docs/vercel-migration-runbook.md) Part 2  
**Automation:** Run [`scripts/vercel-set-env-vars.sh`](scripts/vercel-set-env-vars.sh) after authenticating with `npx vercel login`

### 6. Deployment & Smoke Testing
- [ ] **Trigger deployments** for both environments
  - Production: Push to `main` or manual redeploy
  - Staging: Push to `dev` or manual redeploy
- [ ] **Smoke test Staging** (`dev.sozu.capital`):
  - Verify page title = "Sozu Wallet"
  - Register new passkey (RP ID = `dev.sozu.capital`)
  - Test Deposit → Faucet path
  - Verify stellar.toml
- [ ] **Smoke test Production** (`app.sozu.capital`):
  - Verify page title = "Sozu Wallet"
  - Register new passkey (RP ID = `app.sozu.capital`)
  - Test Deposit → Faucet path
  - Verify stellar.toml
- [ ] **Verify passkey isolation**: Staging passkey must NOT work on Production (and vice versa)

**Instructions:** See [`docs/vercel-migration-runbook.md`](docs/vercel-migration-runbook.md) Part 4

## 📋 Quick Start for Manual Completion

1. **Authenticate with Vercel:**
   ```bash
   npx vercel login
   ```

2. **Follow the runbook:**
   Open [`docs/vercel-migration-runbook.md`](docs/vercel-migration-runbook.md) and complete:
   - Part 1: Project configuration (environments, domains)
   - Part 2: Environment variables (manual or via script)
   - Part 4: Deployment and smoke testing

3. **Optional automation:**
   ```bash
   # After Vercel CLI authentication
   ./scripts/vercel-set-env-vars.sh
   ```

## 🔍 Verification Commands

```bash
# Check DNS propagation
dig app.sozu.capital +short
dig dev.sozu.capital +short

# Check stellar.toml
curl https://app.sozu.capital/.well-known/stellar.toml
curl https://dev.sozu.capital/.well-known/stellar.toml

# Check deployments
npx vercel ls sozu-credit
```

## 📚 Reference Documents

| Document | Purpose |
|----------|---------|
| [`docs/vercel-migration-runbook.md`](docs/vercel-migration-runbook.md) | Complete step-by-step Vercel cutover guide |
| [`docs/deployment.md`](docs/deployment.md) | Deployment architecture and environment setup |
| [`docs/agents/git-flow.md`](docs/agents/git-flow.md) | Git workflow for feature → dev → main promotion |
| [`scripts/vercel-set-env-vars.sh`](scripts/vercel-set-env-vars.sh) | Automation script for environment variables |
| [`.env.example`](.env.example) | Environment variable reference |

## 🚀 Post-Cutover Cleanup

After verifying both environments work correctly:

1. Archive or delete `sozu-cosed-beta` Vercel project (keep idle initially for rollback)
2. Remove `credit.sozu.capital` domain (if no longer needed)
3. Update SumUp webhook URLs in SumUp dashboard
4. Update Google OAuth redirect URIs in Google Cloud Console
5. Configure GitHub branch protection rules for `main` and `dev`

## 📞 Support

- Vercel issues: Check [Vercel status](https://www.vercel-status.com)
- WebAuthn/passkey issues: See runbook troubleshooting section
- General questions: Reference [`docs/deployment.md`](docs/deployment.md)

---

**Agent Note:** All programmatic work is complete. The remaining tasks require human authentication with Vercel dashboard or authenticated CLI. The comprehensive runbook provides step-by-step instructions to complete the cutover.
