# 🔴 CRITICAL: Vercel Authentication Required

## Current Status

✅ **Completed (2/5 tasks)**:
- Created and pushed `dev` branch
- Completed all documentation and code updates

🔒 **Blocked (3/5 tasks)** - Require Vercel authentication:
- Configure Vercel project environments and domains
- Set environment variables per environment  
- Trigger deployments and smoke testing

## Why Blocked?

The remaining tasks require **Vercel dashboard or CLI access** with authentication. Cloud agents cannot complete OAuth flows or access Vercel APIs without a `VERCEL_TOKEN`.

## ⚡ Quick Resolution (Choose One)

### Option A: Add VERCEL_TOKEN to Cloud Agent (Recommended)

1. **Create a Vercel token:**
   - Go to https://vercel.com/account/tokens
   - Click **Create Token**
   - Name it: `cloud-agent-sozucredit`
   - Copy the token (starts with `vercel_...`)

2. **Add to Cursor Dashboard:**
   - Go to https://cursor.com/settings (or Cursor Dashboard → Cloud Agents → Secrets)
   - Click **+ Add Secret**
   - Name: `VERCEL_TOKEN`
   - Value: Paste your token
   - Scope: User or Team
   - Repository: `blessedux/SozuCredit`
   - Click **Save**

3. **Re-run this agent:**
   - The agent will automatically use the token to complete the remaining tasks
   - Or run manually: `VERCEL_TOKEN=your_token ./scripts/complete-vercel-setup.sh`

### Option B: Manual Completion via Dashboard

Follow the comprehensive runbook: **[`docs/vercel-migration-runbook.md`](docs/vercel-migration-runbook.md)**

Estimated time: 15-20 minutes

### Option C: Semi-Automated via Local CLI

```bash
# On your local machine with Vercel CLI access:
git pull origin dev
npx vercel login
./scripts/complete-vercel-setup.sh
```

Then manually complete dashboard-only steps (environments, domains).

## 📋 Exact Tasks Remaining

### 1. Configure Vercel Project
**Location:** https://vercel.com/blessedux/sozu-credit/settings

- [ ] **Create custom Staging environment**
  - Settings → Git → Custom Environments → **Create "Staging"**
  - Assign branch: `dev`
  
- [ ] **Add Production domain**
  - Settings → Domains → Add `app.sozu.capital`
  - Set as primary Production domain
  
- [ ] **Add Staging domain**
  - Settings → Domains → Add `dev.sozu.capital`
  - Assign to Staging environment

### 2. Set Environment Variables
**Location:** https://vercel.com/blessedux/sozu-credit/settings/environment-variables

**Production** (main branch):
```bash
NEXT_PUBLIC_APP_URL=https://app.sozu.capital
NEXT_PUBLIC_RP_ID=app.sozu.capital
WALLET_CLIENT_DOMAIN=app.sozu.capital
```

**Staging** (dev branch):
```bash
NEXT_PUBLIC_APP_URL=https://dev.sozu.capital
NEXT_PUBLIC_RP_ID=dev.sozu.capital
WALLET_CLIENT_DOMAIN=dev.sozu.capital
```

**Copy shared secrets to Staging** (if missing):
- `AUTH_SECRET`
- `SEP10_CLIENT_SIGNING_SECRET`
- All Supabase, Stellar, SDP, Faucet, Deposit variables

### 3. Deploy & Smoke Test

**Trigger deployments:**
- Production: Push to `main` or dashboard redeploy
- Staging: Push to `dev` or dashboard redeploy

**Smoke test checklist:**
- [ ] Open https://dev.sozu.capital
- [ ] Verify title = "Sozu Wallet"
- [ ] Register passkey (RP ID = `dev.sozu.capital`)
- [ ] Test Deposit → Faucet path
- [ ] Repeat for https://app.sozu.capital
- [ ] **CRITICAL:** Verify passkey isolation (staging passkey must NOT work on production)

## 📚 Documentation Ready

All documentation and automation scripts are complete and committed to `dev` branch:

| File | Purpose |
|------|---------|
| [`docs/vercel-migration-runbook.md`](docs/vercel-migration-runbook.md) | **START HERE** - Complete step-by-step guide |
| [`scripts/complete-vercel-setup.sh`](scripts/complete-vercel-setup.sh) | Automated setup (requires VERCEL_TOKEN) |
| [`docs/deployment.md`](docs/deployment.md) | Deployment architecture reference |
| [`docs/agents/git-flow.md`](docs/agents/git-flow.md) | Git workflow for future work |
| [`VERCEL_CUTOVER_STATUS.md`](VERCEL_CUTOVER_STATUS.md) | Detailed status tracking |

## 🎯 Recommended Next Action

**Add `VERCEL_TOKEN` to Cursor Dashboard**, then either:
1. Re-run this cloud agent on the same task
2. Or run `./scripts/complete-vercel-setup.sh` locally

This will automatically complete the remaining environment variable configuration, then you can finish domains/environments in the dashboard (5 minutes).

---

**Agent Status:** All programmatic work complete. Blocked on Vercel authentication.  
**Last Updated:** 2026-07-30 04:17 UTC  
**Branch:** `dev` (ready for Staging deployment once Vercel configured)
