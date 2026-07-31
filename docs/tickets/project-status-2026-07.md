# Project status — 2026-07-31

GitHub: `blessedux/sozu-wallet` · Vercel: `sozu-wallet`  
Staging: `dev` → `dev.sozu.capital` · Production: `main` → `app.sozu.capital`

## Closable when #8 merges

| Issue | Fix |
|-------|-----|
| #10 map.tsx GeoJSON | `types/geojson-namespace.d.ts` |
| #14 Vercel pipeline | Operator done; see residual ops |
| #9 Cancel custodial | `docs/tickets/cancelled-custodial.md` |
| #12 Profile save | `app/wallet/profile/page.tsx` → PUT `/api/wallet/profile` |
| #13 Vouch reviewer auth | `VOUCH_REVIEWER_USER_IDS` allowlist |

PR: https://github.com/blessedux/sozu-wallet/pull/8

## Active

| Issue | Status |
|-------|--------|
| #11 SOZU-22 | PR #7 — GeoJSON shim pushed; needs migration + Staging QA |
| #15 Visual UX feedback | Design track — not started |
| #16 Tracking | Use this doc + GitHub issues |

## Residual ops (dashboard)

1. **Enable Production deposits** (currently off — FX API returns unavailable):
   ```
   DEPOSITS_ENABLED=true
   NEXT_PUBLIC_DEPOSITS_ENABLED=true
   NEXT_PUBLIC_BETA_TIER=closed
   ```
   Redeploy `main`.
2. Adjust Staging Deployment Protection if passkey QA needs non-SSO access.
3. Set `VOUCH_REVIEWER_USER_IDS` (comma-separated Supabase UUIDs).
4. Disconnect/delete leftover **`sozu-cosed-beta`** (still creates duplicate Preview checks).
5. Close GitHub issues #9–#14 manually if automation lacks permission (agent got 403 on issue write).
